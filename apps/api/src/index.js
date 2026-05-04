require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────
app.set('trust proxy', 1);

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json({ limit: '4mb' }));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta de nuevo en un minuto.' },
}));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Rutas ─────────────────────────────────────────────────────
app.use('/api', routes);

// ── Error handler ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 API Deyanira corriendo en http://localhost:${PORT}`);
});
