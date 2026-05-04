require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Trust proxy (Cloud Run / Railway) ────────────────────────
app.set('trust proxy', 1);

// ── Seguridad de headers ──────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS — solo orígenes autorizados ─────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Permitir peticiones sin origin (mobile apps, curl en desarrollo)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origen no permitido'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsers ──────────────────────────────────────────────
// Límite estándar para la mayoría de rutas
app.use((req, res, next) => {
  const isUpload = req.path.includes('/upload') || req.path.includes('/gallery/upload');
  express.json({ limit: isUpload ? '12mb' : '1mb' })(req, res, next);
});

// ── Rate limiters ─────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta de nuevo en un minuto.' },
});

// Límite estricto para endpoints de pago — 10 intentos/minuto por IP
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de pago, espera un minuto.' },
  skipSuccessfulRequests: false,
});

// Límite para disponibilidad/búsquedas — 60/minuto
const queryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas consultas, espera un momento.' },
});

app.use(globalLimiter);
app.use('/api/payments', paymentLimiter);
app.use('/api/appointments/availability', queryLimiter);
app.use('/api/products', queryLimiter);

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Rutas ─────────────────────────────────────────────────────
app.use('/api', routes);

// ── Error handler ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  // No exponer detalles internos en producción
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) console.error(err);

  const status = err.status || err.statusCode || 500;
  const message = status < 500
    ? err.message
    : (isDev ? err.message : 'Error interno del servidor');

  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`API Deyanira corriendo en http://localhost:${PORT}`);
});
