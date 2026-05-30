// Verificación de Cloudflare Turnstile (captcha invisible) para endpoints
// públicos sensibles (reservar, registro).
//
// Diseño "fail-open en ausencia de config": si TURNSTILE_SECRET_KEY no está
// definida, el middleware es un no-op. Así dev/local y entornos sin la llave
// siguen funcionando; en producción se exige configurarla.
//
// El frontend envía el token en `req.body.turnstileToken` (o cabecera
// `cf-turnstile-response`). Cloudflare lo valida contra siteverify.

const env = require('../lib/env');
const logger = require('../lib/logger');
const { BadRequest } = require('../lib/errors');

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyToken(token, ip) {
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (ip) body.append('remoteip', ip);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(VERIFY_URL, { method: 'POST', body, signal: ctrl.signal });
    const data = await r.json();
    return Boolean(data.success);
  } finally {
    clearTimeout(t);
  }
}

// Middleware factory. `required=true` rechaza si falta el token.
function turnstile() {
  return async (req, _res, next) => {
    // Sin secret configurado → no-op (dev/local).
    if (!env.TURNSTILE_SECRET_KEY) return next();

    const token = req.body?.turnstileToken || req.headers['cf-turnstile-response'];
    if (!token || typeof token !== 'string') {
      return next(BadRequest('Verificación anti-bot requerida.', 'turnstile_missing'));
    }

    try {
      const ok = await verifyToken(token, req.ip);
      if (!ok) return next(BadRequest('Verificación anti-bot fallida. Recarga e inténtalo de nuevo.', 'turnstile_failed'));
      next();
    } catch (err) {
      // Si Cloudflare no responde, no bloqueamos al usuario legítimo: dejamos
      // pasar pero registramos. El rate-limit/slow-down sigue protegiendo.
      logger.warn('turnstile_verify_error', { msg: err.message });
      next();
    }
  };
}

module.exports = { turnstile, verifyToken };
