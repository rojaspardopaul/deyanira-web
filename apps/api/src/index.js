// ── BOOTSTRAP ─────────────────────────────────────────────────
require('dotenv').config();
const env = require('./lib/env');   // valida + fail-fast antes de require pesados
const logger = require('./lib/logger');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const routes = require('./routes');
const { HttpError } = require('./lib/errors');

const app = express();
const PORT = parseInt(env.PORT, 10);
const isProd = env.NODE_ENV === 'production';

// ── Trust proxy (Cloud Run / Railway / Vercel) ────────────────
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.disable('etag');

// ── Compresión gzip/brotli — alivia payloads JSON grandes (catálogos, listados) ──
app.use(compression());

// ── Request ID + structured access log ────────────────────────
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const start = Date.now();
  res.on('finish', () => {
    // No registrar 304s ni health checks
    if (req.path === '/api/health' || req.path === '/api/health/ready') return;
    logger.info('http', {
      id: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - start,
      ip: req.ip,
      ua: req.headers['user-agent']?.slice(0, 120),
    });
  });
  next();
});

// ── Helmet con CSP estricta ───────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy:   { policy: 'same-origin' },
  crossOriginEmbedderPolicy: false,           // evita romper imágenes externas
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc:   ["'none'"],
      scriptSrc:    ["'self'"],
      connectSrc:   ["'self'"],
      imgSrc:       ["'self'", 'data:', 'https://res.cloudinary.com', 'https://*.supabase.co'],
      styleSrc:     ["'self'"],
      objectSrc:    ["'none'"],
      frameAncestors: ["'none'"],
      baseUri:      ["'none'"],
      formAction:   ["'self'"],
    },
  },
  hsts: isProd
    ? { maxAge: 63072000, includeSubDomains: true, preload: true }
    : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  frameguard: { action: 'deny' },
}));

// Permissions-Policy explícito (helmet ya envía algunos)
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );
  next();
});

// ── CORS — solo orígenes autorizados ─────────────────────────
const allowedOrigins = (env.ALLOWED_ORIGINS
  ? env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : []
)
  .concat(env.FRONTEND_URL ? [env.FRONTEND_URL] : [])
  .concat(isProd ? [] : ['http://localhost:3000']);

app.use(cors({
  origin: (origin, cb) => {
    // En producción exigimos Origin presente y autorizado.
    if (!origin) {
      // Solo permitir same-origin / curl en dev. En prod rechazar.
      if (isProd) return cb(new Error('CORS: Origin requerido'));
      return cb(null, true);
    }
    if (allowedOrigins.includes(origin)) return cb(null, true);
    logger.warn('cors_rejected', { origin });
    cb(new Error('CORS: origen no permitido'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 600,
}));

// ── Cookie parser ─────────────────────────────────────────────
app.use(cookieParser());

// ── Seam multi-tenant ─────────────────────────────────────────
// Establece req.tenant (hoy = tenant único). Listo para resolver por host/JWT
// cuando el proyecto evolucione a SaaS multiempresa.
const { contextoTenant } = require('./shared/context/tenantMiddleware');
app.use(contextoTenant);

// ── Body parsers — límite por verbo, no por path ──────────────
// JSON: 1mb por defecto. Upload de imágenes hasta 12mb. Upload de video (base64)
// hasta 60mb (admin, baja frecuencia) — un MP4 de ~40MB ≈ 53MB en base64.
const STANDARD_LIMIT = '1mb';
const UPLOAD_LIMIT   = '12mb';
const VIDEO_LIMIT    = '60mb';

const standardJson = express.json({ limit: STANDARD_LIMIT, strict: true });
const uploadJson   = express.json({ limit: UPLOAD_LIMIT,   strict: true });
const videoJson    = express.json({ limit: VIDEO_LIMIT,    strict: true });

// Rutas de upload de imagen (path exacto + admin)
const UPLOAD_PATHS = new Set([
  '/api/admin/upload',
  '/api/admin/gallery/upload',
]);
// Rutas de upload de video (base64 grande)
const VIDEO_PATHS = new Set([
  '/api/admin/upload-video',
]);
// Rutas que necesitan el RAW body (verificación HMAC de webhook)
const RAW_BODY_PREFIXES = ['/api/payments/webhook/'];

app.use((req, res, next) => {
  if (RAW_BODY_PREFIXES.some(p => req.path.startsWith(p))) return next();
  if (VIDEO_PATHS.has(req.path))  return videoJson(req, res, next);
  // Subida de comprobantes (Yape/Plin): /api/.../:id/proof lleva imagen base64.
  if (UPLOAD_PATHS.has(req.path) || req.path.endsWith('/proof')) return uploadJson(req, res, next);
  return standardJson(req, res, next);
});

// ── Sanitización NoSQL/operator-injection ─────────────────────
// Neutraliza claves con `$` o `.` (operadores Mongo/Prisma) en body/query/params.
// replaceWith evita rechazar el request; solo reescribe la clave peligrosa.
app.use(mongoSanitize({ replaceWith: '_' }));

// ── Rate limiters ─────────────────────────────────────────────
const baseLimiter = (opts) => rateLimit({
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, espera un momento.' },
  ...opts,
});

const globalLimiter         = baseLimiter({ windowMs: 60 * 1000,           max: 200 });
const paymentLimiter        = baseLimiter({ windowMs: 60 * 1000,           max: 10,  message: { error: 'Demasiados intentos de pago, espera un minuto.' } });
const queryLimiter          = baseLimiter({ windowMs: 60 * 1000,           max: 60 });
const appointmentCreateLim  = baseLimiter({ windowMs: 10 * 60 * 1000,      max: 5,   message: { error: 'Demasiadas reservas. Espera unos minutos.' } });
const orderCreateLimiter    = baseLimiter({ windowMs: 10 * 60 * 1000,      max: 8,   message: { error: 'Demasiados pedidos. Espera unos minutos.' } });
const adminLoginLimiter     = baseLimiter({ windowMs: 15 * 60 * 1000,      max: 10,  message: { error: 'Demasiados intentos de acceso.' } });
const passwordResetLimiter  = baseLimiter({ windowMs: 60 * 60 * 1000,      max: 5 });

app.use(globalLimiter);

// ── Anti-abuso: reputación de IP (bloqueo temporal) ───────────
const { progressiveSlowDown, ipReputation } = require('./middleware/abuseGuard');
app.use(ipReputation);

// ⚠ rutas reales — el bug anterior aplicaba el limiter a una ruta inexistente
app.use('/api/auth/admin/login',                  adminLoginLimiter, progressiveSlowDown);
app.use('/api/payments',                          paymentLimiter);
app.use('/api/appointments/availability',         queryLimiter);
app.use('/api/products',                          queryLimiter);
app.use('/api/promotions/validate',               queryLimiter);
// rate limit + slow-down en POSTs sensibles
app.use((req, res, next) => {
  const isApptCreate = req.method === 'POST' && (req.path === '/api/appointments' || req.path === '/api/appointments/batch');
  if (isApptCreate)                                              return appointmentCreateLim(req, res, () => progressiveSlowDown(req, res, next));
  if (req.method === 'POST' && req.path === '/api/orders')       return orderCreateLimiter(req, res, next);
  next();
});

// ── Health checks ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.get('/api/health/ready', async (_req, res) => {
  try {
    const prisma = require('./lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', ts: new Date().toISOString() });
  } catch (err) {
    logger.error('health_ready_failed', { msg: err.message });
    res.status(503).json({ status: 'unavailable' });
  }
});

// ── Rutas ─────────────────────────────────────────────────────
app.use('/api', routes);

// ── 404 ───────────────────────────────────────────────────────
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// ── Error handler ─────────────────────────────────────────────
// CRÍTICO: no exponer detalles internos en 5xx.
// Para errores 4xx personalizados (HttpError), se envía message + code.
// Para 5xx solo "Error interno del servidor".
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const requestId = req.id;

  if (status >= 500) {
    logger.error('unhandled', {
      id: requestId,
      msg: err.message,
      stack: !isProd && err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // Errores conocidos (HttpError) o 4xx con `expose`
  if (err instanceof HttpError || (status >= 400 && status < 500 && err.expose !== false)) {
    return res.status(status).json({
      error: err.message || 'Solicitud inválida',
      code: err.code || undefined,
      requestId,
    });
  }

  // CORS y similares también 4xx
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: err.message, requestId });
  }

  // 5xx: nunca filtrar
  res.status(500).json({
    error: 'Error interno del servidor',
    requestId,
  });
});

// ── Listen ────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info('api_started', { port: PORT, env: env.NODE_ENV });
});

// Barrido periódico: libera reservas con adelanto pendiente vencido (suelta horarios)
const { releaseExpiredDeposits } = require('./lib/payments/bookingDeposit');
const _depositSweep = setInterval(() => {
  releaseExpiredDeposits()
    .then((n) => { if (n > 0) logger.info('deposits_released', { count: n }); })
    .catch((err) => logger.error('deposit_sweep_failed', { msg: err.message }));
}, 30 * 60 * 1000);
_depositSweep.unref();

// Cierre graceful
const shutdown = () => {
  logger.info('shutdown_signal');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

module.exports = app;
