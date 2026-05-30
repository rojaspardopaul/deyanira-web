# Security Policy

## Reporte responsable

Si encuentras una vulnerabilidad, por favor **NO** abras un Issue público.
Envíanos un correo a `security@deyanira.pe` con:
- Descripción técnica
- Pasos para reproducir
- Impacto estimado
- (Opcional) PoC

Respondemos en menos de 72 horas.

## Versiones soportadas

| Versión | Soporte de seguridad |
|---------|----------------------|
| latest  | ✅                    |
| < latest | ❌                    |

## Stack de seguridad implementado

- **Auth admin**: JWT firmado HS256 en cookie HttpOnly + Secure + SameSite=Lax + CSRF double-submit.
- **Auth clientes**: Supabase Auth (`@supabase/ssr`) — token Bearer en Authorization header.
- **Rate limiting**: global (100/min) + estricto para login (10/15min), payments (10/min), reservas (5/10min).
- **CSP estricta**: ver `apps/web/next.config.js`.
- **Helmet**: CSP + HSTS + COOP + frame-deny en el API.
- **Validación de input**: Zod en cada handler de mutación.
- **Singleton Prisma**: 1 pool de conexiones por proceso.
- **Logs estructurados**: JSON-line, con redacción automática de claves sensibles.
- **Bcrypt cost 12** en producción.
- **Constant-time login** (dummy hash anti-timing).

## Rotación de secretos

| Secreto | Frecuencia |
|---------|-----------|
| `ADMIN_JWT_SECRET` | cada 90 días — invalida todas las sesiones admin |
| `SUPABASE_SERVICE_ROLE_KEY` | cada 180 días desde Supabase Dashboard |
| `CULQI_SECRET_KEY` | cuando expire token Culqi o se sospeche compromiso |
| `RESEND_API_KEY` | cada 365 días |

## Dependencias

- `npm audit` corre en CI con `--audit-level=high`.
- Dependabot actualiza semanalmente (ver `.github/dependabot.yml`).
- CodeQL escanea cada PR.
- Gitleaks busca secretos hardcodeados.
