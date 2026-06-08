const { z } = require('zod');

// Validación estricta de variables de entorno con fail-fast en arranque.
// Las claves marcadas opcionales no romperán el boot, pero deshabilitan features.
const EnvSchema = z.object({
  NODE_ENV:      z.enum(['development', 'test', 'production']).default('development'),
  PORT:          z.string().regex(/^\d+$/).default('3001'),

  DATABASE_URL:  z.string().url('DATABASE_URL inválida'),
  DIRECT_URL:    z.string().url('DIRECT_URL inválida').optional(),

  // Auth — obligatorio en prod
  ADMIN_JWT_SECRET:   z.string().min(32, 'ADMIN_JWT_SECRET debe tener >= 32 chars'),
  ADMIN_JWT_LIFETIME: z.string().default('8h'),
  SUPABASE_JWT_SECRET: z.string().min(20).optional(),

  // CORS — obligatorio en prod (lista separada por comas)
  FRONTEND_URL:       z.string().url().optional(),
  ALLOWED_ORIGINS:    z.string().optional(),

  // Cookies
  COOKIE_DOMAIN:      z.string().optional(),

  // Supabase
  SUPABASE_URL:                z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY:   z.string().min(20).optional(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY:    z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Culqi
  CULQI_PUBLIC_KEY: z.string().optional(),
  CULQI_SECRET_KEY: z.string().optional(),
  CULQI_WEBHOOK_SECRET: z.string().min(20).optional(),

  // Resend
  RESEND_API_KEY:     z.string().optional(),
  EMAIL_FROM:         z.string().optional(),
  SALON_ADMIN_EMAIL:  z.string().email().optional(),

  // WhatsApp
  WHATSAPP_NUMBER:  z.string().optional(),
  SALON_WHATSAPP:   z.string().optional(),
  YAPE_NUMBER:      z.string().optional(),

  // URLs públicas (consumidas en emails)
  NEXT_PUBLIC_WEB_URL: z.string().url().optional(),

  // Bcrypt cost factor (10 desarrollo, 12 prod)
  BCRYPT_COST: z.string().regex(/^\d+$/).optional(),

  // Cloudflare Turnstile (captcha anti-bot). Opcional: sin esta llave el
  // middleware de verificación es no-op (dev/local).
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // Secreto compartido para invocar el webhook /api/revalidate del frontend
  // (purga de caché Next on-demand tras mutaciones admin). Opcional: sin él,
  // la revalidación on-demand queda deshabilitada (solo revalidate por tiempo).
  REVALIDATE_SECRET: z.string().optional(),

  // Feature flag de cutover del módulo de pagos (Strangler). 'true' monta
  // modules/payments (Culqi + webhook); 'false' (default) mantiene el legacy.
  PAGOS_MODULO_NUEVO: z.enum(['true', 'false']).default('false'),
});

// Reglas de obligatoriedad en producción
const PROD_REQUIRED = ['FRONTEND_URL', 'CULQI_SECRET_KEY', 'RESEND_API_KEY', 'SUPABASE_JWT_SECRET'];

function loadEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(i => `  · ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(`[FATAL] Variables de entorno inválidas:\n${issues}`);
    process.exit(1);
  }

  const env = parsed.data;

  if (env.NODE_ENV === 'production') {
    const missing = PROD_REQUIRED.filter(k => !env[k]);
    if (missing.length) {
      console.error(`[FATAL] En production faltan: ${missing.join(', ')}`);
      process.exit(1);
    }
    if (env.ADMIN_JWT_SECRET.length < 48) {
      console.warn('[WARN] ADMIN_JWT_SECRET tiene menos de 48 chars. Se recomienda 64+.');
    }
  }

  return env;
}

const env = loadEnv();

module.exports = env;
module.exports.env = env;
