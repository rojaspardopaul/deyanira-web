const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const env = require('../lib/env');
const logger = require('../lib/logger');
const { Unauthorized, Forbidden } = require('../lib/errors');

const ADMIN_COOKIE = 'admin_session';
const CSRF_COOKIE  = 'admin_csrf';

// ── Helpers de tokens ─────────────────────────────────────────
function extractBearer(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

function extractAdminToken(req) {
  // Preferimos cookie HttpOnly. Authorization se conserva sólo en server-to-server (no público).
  return req.cookies?.[ADMIN_COOKIE] || extractBearer(req);
}

// Verifica JWT de Supabase Auth (clientes registrados)
async function verifySupabaseToken(token) {
  // Ruta rápida: verificación local HS256 (proyectos Supabase con secreto simétrico legacy).
  if (env.SUPABASE_JWT_SECRET) {
    try {
      const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET, {
        algorithms: ['HS256'],
      });
      return { id: payload.sub, email: payload.email, user_metadata: payload.user_metadata };
    } catch {
      // El token NO es HS256 (p. ej. proyecto migrado a llaves asimétricas ES256):
      // no rechazamos, caemos al fallback por red que valida cualquier algoritmo.
    }
  }
  // Fallback: verificar vía API de Supabase (más lento, hace red por request)
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

async function isCustomer(req, _res, next) {
  const token = extractBearer(req);
  if (!token) return next(Unauthorized());
  const user = await verifySupabaseToken(token);
  if (!user) return next(Unauthorized('Token inválido'));
  req.user = user;
  next();
}

async function optionalCustomer(req, _res, next) {
  const token = extractBearer(req);
  if (token) {
    const user = await verifySupabaseToken(token);
    if (user) req.user = user;
  }
  next();
}

// ── Admin ─────────────────────────────────────────────────────
function verifyAdminToken(token) {
  try {
    return jwt.verify(token, env.ADMIN_JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

// CSRF: double-submit cookie. El frontend lee `admin_csrf` (no HttpOnly)
// y lo reenvía como header `X-CSRF-Token`. Si no coincide, rechazamos
// mutaciones (POST/PUT/PATCH/DELETE).
function checkCsrf(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true;
  const cookieCsrf = req.cookies?.[CSRF_COOKIE];
  const headerCsrf = req.headers['x-csrf-token'];
  if (!cookieCsrf || !headerCsrf) return false;
  // Igualdad en tiempo constante
  if (cookieCsrf.length !== headerCsrf.length) return false;
  let diff = 0;
  for (let i = 0; i < cookieCsrf.length; i++) {
    diff |= cookieCsrf.charCodeAt(i) ^ headerCsrf.charCodeAt(i);
  }
  return diff === 0;
}

function isAdmin(req, _res, next) {
  const token = extractAdminToken(req);
  if (!token) return next(Unauthorized());
  const payload = verifyAdminToken(token);
  if (!payload) return next(Unauthorized('Sesión expirada o inválida'));

  // CSRF: sólo si el token vino por cookie (no por Bearer server-to-server)
  if (req.cookies?.[ADMIN_COOKIE] && !checkCsrf(req)) {
    logger.warn('csrf_mismatch', { id: req.id, path: req.path });
    return next(Forbidden('CSRF token inválido'));
  }

  req.admin = payload;
  next();
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.admin) return next(Unauthorized());
    if (!roles.includes(req.admin.role)) return next(Forbidden('Sin permisos suficientes'));
    next();
  };
}

module.exports = {
  isCustomer, isAdmin, optionalCustomer, requireRole,
  ADMIN_COOKIE, CSRF_COOKIE,
  verifyAdminToken, verifySupabaseToken,
};
