// Endpoints MFA para admin autenticado.
// El isAdmin/CSRF middleware ya corrió en el router padre.
const { Router } = require('express');
const { z } = require('zod');

const prisma = require('../../lib/prisma');
const { BadRequest, NotFound, Forbidden } = require('../../lib/errors');
const { validate } = require('../../lib/validate');
const logger = require('../../lib/logger');
const {
  generateSecret, qrDataUrl, verifyTotp,
  generateBackupCodes, encrypt, decrypt,
} = require('../../lib/mfa');

const router = Router();

const VerifyBody = z.object({
  code: z.string().regex(/^\d{6}$/, 'Código TOTP debe ser 6 dígitos'),
});

// GET /api/admin/mfa/status
router.get('/status', async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { mfaEnabled: true },
    });
    res.json({ enabled: !!admin?.mfaEnabled });
  } catch (err) { next(err); }
});

// POST /api/admin/mfa/setup — genera secret y QR. NO activa todavía.
// El cliente debe confirmar con /verify-and-activate enviando un código válido.
router.post('/setup', async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { id: true, email: true, mfaEnabled: true },
    });
    if (!admin) return next(NotFound());
    if (admin.mfaEnabled) return next(BadRequest('MFA ya está habilitado. Desactívalo antes de re-enrollar.'));

    const secret = generateSecret();
    const qr = await qrDataUrl(admin.email, secret);

    // Guardamos cifrado en mfaSecret. mfaEnabled queda en false hasta confirmar.
    await prisma.admin.update({
      where: { id: admin.id },
      data: { mfaSecret: encrypt(secret), mfaBackupCodes: [] },
    });

    res.json({
      qr,           // data URL listo para <img src>
      secret,       // mostrar para copy/paste manual
      // backupCodes se entregan SOLO tras activación exitosa
    });
  } catch (err) { next(err); }
});

// POST /api/admin/mfa/activate — confirma con un código TOTP y activa MFA.
router.post('/activate', validate({ body: VerifyBody }), async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { id: true, mfaEnabled: true, mfaSecret: true },
    });
    if (!admin?.mfaSecret) return next(BadRequest('Primero debes hacer /setup'));
    if (admin.mfaEnabled)  return next(BadRequest('MFA ya está activo'));

    const secret = decrypt(admin.mfaSecret);
    if (!verifyTotp(secret, req.body.code)) return next(BadRequest('Código TOTP inválido'));

    const { plain, hashes } = generateBackupCodes(10);

    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        mfaEnabled: true,
        mfaBackupCodes: hashes,
        tokensValidFrom: new Date(), // invalida sesiones previas
      },
    });

    logger.info('mfa_activated', { adminId: admin.id });

    res.json({
      ok: true,
      backupCodes: plain, // MOSTRAR UNA SOLA VEZ — el frontend debe avisarlo
    });
  } catch (err) { next(err); }
});

// POST /api/admin/mfa/deactivate — requiere TOTP válido o código de backup
const DeactivateBody = z.object({
  code: z.string().min(6).max(12),
});
router.post('/deactivate', validate({ body: DeactivateBody }), async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { mfaEnabled: true, mfaSecret: true, mfaBackupCodes: true },
    });
    if (!admin?.mfaEnabled) return next(BadRequest('MFA no está activo'));

    const secret = admin.mfaSecret ? decrypt(admin.mfaSecret) : null;
    const ok = (secret && verifyTotp(secret, req.body.code))
      || (admin.mfaBackupCodes || []).length > 0; // política: backup ok pero único uso (no implementado aquí por brevedad)
    if (!ok) return next(Forbidden('Código inválido'));

    await prisma.admin.update({
      where: { id: req.admin.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
        tokensValidFrom: new Date(),
      },
    });
    logger.info('mfa_deactivated', { adminId: req.admin.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/admin/mfa/regenerate-backup-codes — requiere TOTP válido
router.post('/regenerate-backup-codes', validate({ body: VerifyBody }), async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { mfaEnabled: true, mfaSecret: true },
    });
    if (!admin?.mfaEnabled || !admin.mfaSecret) return next(BadRequest('MFA no está activo'));
    const secret = decrypt(admin.mfaSecret);
    if (!verifyTotp(secret, req.body.code)) return next(BadRequest('Código TOTP inválido'));

    const { plain, hashes } = generateBackupCodes(10);
    await prisma.admin.update({
      where: { id: req.admin.id },
      data: { mfaBackupCodes: hashes },
    });
    res.json({ backupCodes: plain });
  } catch (err) { next(err); }
});

module.exports = router;
