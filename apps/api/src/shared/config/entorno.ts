// Superficie tipada de configuración para el código nuevo (TS).
//
// La implementación canónica (validación Zod + fail-fast en arranque) permanece
// deliberadamente en lib/env.js durante la Fase 0: es la ruta crítica de boot y
// no la tocamos más allá de añadir flags. Aquí solo le ponemos tipos para que los
// módulos/casos de uso consuman `entorno.X` con autocompletado.

/* eslint-disable @typescript-eslint/no-var-requires */
const env = require('../../lib/env') as Entorno;

export interface Entorno {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: string;

  DATABASE_URL: string;
  DIRECT_URL?: string;

  ADMIN_JWT_SECRET: string;
  ADMIN_JWT_LIFETIME: string;
  SUPABASE_JWT_SECRET?: string;

  FRONTEND_URL?: string;
  ALLOWED_ORIGINS?: string;
  COOKIE_DOMAIN?: string;

  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;

  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;

  CULQI_PUBLIC_KEY?: string;
  CULQI_SECRET_KEY?: string;
  CULQI_WEBHOOK_SECRET?: string;

  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  SALON_ADMIN_EMAIL?: string;

  WHATSAPP_NUMBER?: string;
  SALON_WHATSAPP?: string;
  YAPE_NUMBER?: string;

  NEXT_PUBLIC_WEB_URL?: string;
  BCRYPT_COST?: string;
  TURNSTILE_SECRET_KEY?: string;
  REVALIDATE_SECRET?: string;
}

export { env };
export default env;
