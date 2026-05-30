const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');

const prisma = require('../../lib/prisma');
const env = require('../../lib/env');
const logger = require('../../lib/logger');
const { Unauthorized, BadRequest, NotFound } = require('../../lib/errors');
const { validate, EMAIL_RE } = require('../../lib/validate');
const {
  ADMIN_COOKIE, CSRF_COOKIE, isAdmin, verifyAdminToken,
} = require('../../middleware/auth');
const { decrypt } = require('../../lib/crypto');
const { verifyTotp, consumeBackupCode } = require('../../lib/mfa');
const { sha256Hex, randomToken } = require('../../lib/crypto');

const router = Router();

const LoginBody = z.object({
  email: z.string().regex(EMAIL_RE, 'Email inválido').max(150),
  password: z.string().min(6).max(200),
  mfaCode: z.string().min(6).max(12).optional(),
});

// ── Helpers ───────────────────────────────────────────────────
function cookieOptions(maxAgeSec) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: maxAgeSec * 1000,
  };
}

function csrfCookieOptions(maxAgeSec) {
  return {
    httpOnly: false,            // frontend lee la cookie para enviar X-CSRF-Token
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: maxAgeSec * 1000,
  };
}

// Bcrypt dummy hash precomputado para anti-timing attack (cost 12).
const DUMMY_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8rEXwQfH/JxL.7Tjf5gN0H3kF.S2DC';

function lifetimeSeconds() {
  const lt = env.ADMIN_JWT_LIFETIME || '8h';
  const m = lt.match(/^(\d+)([smhd])$/);
  if (!m) return 8 * 3600;
  return parseInt(m[1], 10) * ({ s: 1, m: 60, h: 3600, d: 86400 }[m[2]] || 3600);
}

// Token de sesión incluye iat. Se invalida si admin.tokensValidFrom > iat.
function signAdminToken(admin, maxAge) {
  return jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      staffId: admin.staffId || null,
    },
    env.ADMIN_JWT_SECRET,
    { expiresIn: maxAge, algorithm: 'HS256', issuer: 'deyanira-api', audience: 'admin' }
  );
}

// ── POST /api/auth/admin/login ────────────────────────────────
router.post('/admin/login', validate({ body: LoginBody }), async (req, res, next) => {
  try {
    const { email, password, mfaCode } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const admin = await prisma.admin.findUnique({ where: { email: normalizedEmail } });
    const hashToCheck = admin?.passwordHash || DUMMY_HASH;
    const validPass = await bcrypt.compare(password, hashToCheck);

    if (!admin || !admin.isActive || !validPass) {
      logger.warn('admin_login_failed', { email: normalizedEmail, ip: req.ip });
      return next(Unauthorized('Credenciales inválidas'));
    }

    // ── MFA ──
    if (admin.mfaEnabled) {
      if (!mfaCode) {
        // El frontend recibe esta señal y pide el código en un segundo paso.
        return res.status(401).json({
          error: 'mfa_required',
          mfaRequired: true,
        });
      }
      const secret = admin.mfaSecret ? decrypt(admin.mfaSecret) : null;
      const isTotpOk = secret && verifyTotp(secret, mfaCode);

      let isBackupOk = false;
      let newBackupCodes = null;
      if (!isTotpOk) {
        const consumed = consumeBackupCode(admin.mfaBackupCodes || [], mfaCode);
        if (consumed) {
          isBackupOk = true;
          newBackupCodes = consumed;
        }
      }
      if (!isTotpOk && !isBackupOk) {
        logger.warn('admin_mfa_failed', { adminId: admin.id, ip: req.ip });
        return next(Unauthorized('Código MFA inválido'));
      }
      if (newBackupCodes) {
        await prisma.admin.update({
          where: { id: admin.id },
          data: { mfaBackupCodes: newBackupCodes },
        });
      }
    }

    const maxAge = lifetimeSeconds();
    const token = signAdminToken(admin, maxAge);
    const csrfToken = crypto.randomBytes(24).toString('base64url');

    res.cookie(ADMIN_COOKIE, token,     cookieOptions(maxAge));
    res.cookie(CSRF_COOKIE,  csrfToken, csrfCookieOptions(maxAge));

    // Actualizar metadatos de último login
    prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date(), lastLoginIp: req.ip || null },
    }).catch(() => { /* no bloquear */ });

    logger.info('admin_login_ok', { adminId: admin.id, role: admin.role });

    res.json({
      ok: true,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        staffId: admin.staffId || null,
      },
      csrfToken,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/admin/logout ───────────────────────────────
router.post('/admin/logout', (req, res) => {
  res.clearCookie(ADMIN_COOKIE, cookieOptions(0));
  res.clearCookie(CSRF_COOKIE,  csrfCookieOptions(0));
  res.json({ ok: true });
});

// ── GET /api/auth/admin/me ────────────────────────────────────
router.get('/admin/me', async (req, res, next) => {
  try {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (!token) return next(Unauthorized());
    const payload = verifyAdminToken(token);
    if (!payload) return next(Unauthorized('Sesión expirada'));

    // Comprobar tokensValidFrom: invalida sesiones tras cambio crítico.
    const fresh = await prisma.admin.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true, staffId: true, isActive: true, tokensValidFrom: true },
    });
    if (!fresh || !fresh.isActive) return next(Unauthorized('Cuenta inactiva'));
    if (fresh.tokensValidFrom && payload.iat * 1000 < fresh.tokensValidFrom.getTime()) {
      return next(Unauthorized('Sesión revocada — vuelve a iniciar sesión'));
    }

    res.json({
      admin: {
        id: fresh.id,
        email: fresh.email,
        name: fresh.name,
        role: fresh.role,
        staffId: fresh.staffId,
      },
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/admin/csrf ─────────────────────────────────
router.post('/admin/csrf', isAdmin, (_req, res) => {
  const csrfToken = crypto.randomBytes(24).toString('base64url');
  res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions(lifetimeSeconds()));
  res.json({ csrfToken });
});

// ── POST /api/auth/admin/password-reset/request ───────────────
// No-enum: siempre 200 OK incluso si el email no existe.
const ResetReqBody = z.object({ email: z.string().regex(EMAIL_RE).max(150) });
router.post('/admin/password-reset/request', validate({ body: ResetReqBody }), async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase().trim();
    const admin = await prisma.admin.findUnique({ where: { email }, select: { id: true, email: true, isActive: true } });

    if (admin && admin.isActive) {
      const token = randomToken(32);
      const tokenHash = sha256Hex(token);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

      // Invalida resets previos no usados de este admin
      await prisma.adminPasswordReset.deleteMany({
        where: { adminId: admin.id, usedAt: null },
      });

      await prisma.adminPasswordReset.create({
        data: { adminId: admin.id, tokenHash, expiresAt, ip: req.ip || null },
      });

      // Enviar email
      try {
        const { sendAdminPasswordResetEmail } = require('../../lib/notifications/email-admin');
        const resetUrl = `${env.NEXT_PUBLIC_WEB_URL || ''}/admin/password-reset?token=${token}`;
        await sendAdminPasswordResetEmail({ email: admin.email, resetUrl });
      } catch (err) {
        logger.error('admin_reset_email_failed', { msg: err.message });
      }
    }

    // Misma respuesta siempre (no leak de existencia)
    res.json({ ok: true, message: 'Si el correo está registrado, recibirás un enlace de recuperación.' });
  } catch (err) { next(err); }
});

// ── POST /api/auth/admin/password-reset/confirm ───────────────
const ResetConfirmBody = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(200),
});
router.post('/admin/password-reset/confirm', validate({ body: ResetConfirmBody }), async (req, res, next) => {
  try {
    const tokenHash = sha256Hex(req.body.token);
    const reset = await prisma.adminPasswordReset.findUnique({
      where: { tokenHash },
      include: { admin: false },
    });
    if (!reset) return next(NotFound('Token inválido'));
    if (reset.usedAt) return next(BadRequest('Token ya utilizado'));
    if (reset.expiresAt < new Date()) return next(BadRequest('Token expirado'));

    const BCRYPT_COST = parseInt(env.BCRYPT_COST || (env.NODE_ENV === 'production' ? '12' : '10'), 10);
    const passwordHash = await bcrypt.hash(req.body.password, BCRYPT_COST);

    await prisma.$transaction([
      prisma.admin.update({
        where: { id: reset.adminId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          tokensValidFrom: new Date(), // invalida sesiones
        },
      }),
      prisma.adminPasswordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
    ]);

    logger.info('admin_password_reset', { adminId: reset.adminId });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
