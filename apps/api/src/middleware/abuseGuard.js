// Defensa anti-abuso para endpoints públicos sensibles.
// Tres capas complementarias al rate-limit fijo existente:
//   1. slowDown      — añade latencia creciente tras N requests (frena fuerza bruta)
//   2. ipReputation  — cuenta respuestas abusivas (401/403/409/429) por IP y, al
//                      superar un umbral, bloquea temporalmente esa IP
//   3. honeypot      — campo señuelo oculto: si viene relleno, es un bot → 400
//
// El estado vive en la caché in-memory (src/lib/cache.js). En despliegue
// multi-instancia conviene mover este estado a Redis.

const slowDown = require('express-slow-down');
const cache = require('../lib/cache');
const logger = require('../lib/logger');
const { TooMany, BadRequest } = require('../lib/errors');

// ── 1. Slow-down progresivo ───────────────────────────────────
// Tras `delayAfter` requests en la ventana, cada request extra suma 500ms,
// con tope de 20s. No bloquea: solo encarece el abuso automatizado.
const progressiveSlowDown = slowDown({
  windowMs: 10 * 60 * 1000,
  delayAfter: 5,
  delayMs: (used, req) => {
    const over = used - req.slowDown.limit;
    return Math.min(over * 500, 20_000);
  },
  maxDelayMs: 20_000,
  validate: { delayMs: false }, // silencia el warning de migración v2
});

// ── 2. Reputación de IP ───────────────────────────────────────
const ABUSE_WINDOW_MS = 5 * 60 * 1000;  // ventana de conteo
const ABUSE_THRESHOLD = 40;             // respuestas abusivas para bloquear
const BLOCK_MS        = 10 * 60 * 1000; // duración del bloqueo

// Status que cuentan como "abusivos" (no contamos 404: ruido normal de scanners).
const ABUSIVE = new Set([400, 401, 403, 409, 429]);

function ipReputation(req, res, next) {
  const ip = req.ip || 'unknown';
  const blockKey = `block:${ip}`;

  // ¿IP bloqueada? → 429 inmediato con Retry-After.
  const blockedUntil = cache.get(blockKey);
  if (blockedUntil) {
    const retry = Math.max(1, Math.ceil((blockedUntil - Date.now()) / 1000));
    res.setHeader('Retry-After', String(retry));
    return next(TooMany('Acceso temporalmente restringido por actividad sospechosa.'));
  }

  // Cuenta la respuesta cuando termina.
  res.on('finish', () => {
    if (!ABUSIVE.has(res.statusCode)) return;
    const countKey = `abuse:${ip}`;
    const n = (cache.get(countKey) || 0) + 1;
    cache.set(countKey, n, ABUSE_WINDOW_MS);
    if (n >= ABUSE_THRESHOLD) {
      cache.set(blockKey, Date.now() + BLOCK_MS, BLOCK_MS);
      cache.del(countKey);
      logger.warn('ip_soft_blocked', { ip, count: n, ua: req.headers['user-agent']?.slice(0, 120) });
    }
  });

  next();
}

// ── 3. Honeypot ───────────────────────────────────────────────
// El frontend renderiza un campo oculto (display:none / aria-hidden) que un
// humano nunca rellena. Si llega con valor, casi seguro es un bot → 400 genérico.
function honeypot(fieldName = 'website') {
  return (req, _res, next) => {
    const val = req.body?.[fieldName];
    if (typeof val === 'string' && val.trim() !== '') {
      logger.warn('honeypot_triggered', { ip: req.ip, field: fieldName });
      return next(BadRequest('Solicitud inválida.'));
    }
    next();
  };
}

module.exports = { progressiveSlowDown, ipReputation, honeypot };
