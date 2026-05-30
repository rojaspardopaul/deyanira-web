// Helpers de validación con Zod para route handlers.
// Uso: router.post('/', validate({ body: SchemaBody }), handler)

const { z, ZodError } = require('zod');
const { BadRequest } = require('./errors');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// E.164 light (Perú): 7-15 dígitos, opcional '+'
const PHONE_RE = /^\+?\d{7,15}$/;

// ── Primitivos Zod reutilizables ──────────────────────────────
// Bloques de construcción consistentes para todos los handlers (público + admin),
// para no repetir regex/pick manuales. Uso: f.uuid, f.dateStr, f.pagination, etc.
const f = {
  uuid:     z.string().regex(UUID_RE, 'ID inválido'),
  dateStr:  z.string().regex(DATE_RE, 'Fecha inválida (YYYY-MM-DD)'),
  timeStr:  z.string().regex(TIME_RE, 'Hora inválida (HH:mm)'),
  email:    z.string().regex(EMAIL_RE, 'Email inválido').max(150),
  phone:    z.string().regex(PHONE_RE, 'Teléfono inválido').max(20),
  money:    z.coerce.number().min(0).max(1_000_000),
  // Campo señuelo anti-bot: debe llegar vacío (los bots lo rellenan).
  honeypot: z.string().max(0).optional(),
  // Token de Cloudflare Turnstile (verificado por middleware aparte).
  turnstileToken: z.string().max(2048).optional(),
  // Paginación estándar (query): page>=1, pageSize 1..100 (default 50).
  pagination: {
    page:     z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  },
};

function validate({ body, query, params }) {
  return (req, _res, next) => {
    try {
      if (body)   req.body   = body.parse(req.body);
      if (query)  req.query  = query.parse(req.query);
      if (params) req.params = params.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const first = err.issues[0];
        const path = first.path.join('.') || 'campo';
        return next(BadRequest(`${path}: ${first.message}`, 'validation_error'));
      }
      next(err);
    }
  };
}

module.exports = { validate, f, UUID_RE, TIME_RE, DATE_RE, EMAIL_RE, PHONE_RE };
