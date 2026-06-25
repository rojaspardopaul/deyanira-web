# Guía de despliegue a producción — Deyanira Makeup Beauty

Arquitectura de producción:

| Pieza | Plataforma | Notas |
|---|---|---|
| **Web** (Next.js) | **Vercel** | `apps/web` · ya hay `apps/web/vercel.json` con headers de seguridad |
| **API** (Express) | **Railway** | `apps/api` · contenedor Docker · `railway.json` en la raíz |
| **BD + Auth clientes** | **Supabase** | PostgreSQL + Auth |
| Pagos | Culqi | PEN · usar llaves **live** en prod |
| Emails | Resend | requiere dominio verificado |
| Imágenes | Cloudinary | |

Proyecto Railway en uso: `c77b5566-24c9-4d5f-ba5a-9623bf5f4114`.

> **Regla de oro:** nada de secretos en el repo. Todos los valores van en los
> paneles de Vercel/Railway, nunca en `.env` commiteados.

---

## 0. Pre-requisitos (una sola vez)

- [ ] Dominio `deyanira.pe` con acceso al panel DNS.
- [ ] Cuentas: Vercel, Railway, Supabase (prod), Cloudinary, Culqi (modo live), Resend.
- [ ] Llaves **live** de Culqi (`pk_live_…`, `sk_live_…`).
- [ ] Dominio de envío verificado en Resend (p. ej. `deyaniramakeup.pe`).
- [ ] Generar secretos fuertes:
  ```bash
  # ADMIN_JWT_SECRET (64+ chars) y REVALIDATE_SECRET
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

---

## 1. Base de datos (Supabase prod)

El schema tiene cambios nuevos sin aplicar (módulo financiero, recibos, modificadores
de servicio). Este proyecto **no usa migraciones versionadas**, usa `db push`.

```bash
# Con DATABASE_URL/DIRECT_URL apuntando a la BD de PRODUCCIÓN:
npm run db:push          # aplica el schema a la BD de prod

# Backfill de movimientos financieros (poblar el ledger con datos históricos):
npm --workspace apps/api run backfill:finanzas
```

> Haz un **backup/snapshot** en Supabase antes del `db push`. `db push` puede pedir
> confirmación si detecta cambios destructivos — revísalos.

---

## 2. API → Railway

El `railway.json` (raíz) ya apunta al `Dockerfile` y al healthcheck `/api/health`.

1. En el proyecto Railway → **New Service → Deploy from GitHub repo** → `rojaspardopaul/deyanira-web`.
2. **Settings del servicio:**
   - **Root Directory:** `/` (la raíz del repo — el Dockerfile necesita `packages/` y `apps/api`).
   - **Config-as-code:** `railway.json` (se detecta solo).
   - Builder: **Dockerfile** (ya definido en `railway.json` → `apps/api/Dockerfile`).
   - **NO** definir Start Command: la imagen ya arranca con `tsx` vía su `ENTRYPOINT`/`CMD`.
3. **Variables** (Settings → Variables). No definir `PORT` (Railway lo inyecta):

   ```
   NODE_ENV=production
   DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   DIRECT_URL=postgresql://...pooler.supabase.com:5432/postgres
   ADMIN_JWT_SECRET=<64+ chars generados>
   ADMIN_JWT_LIFETIME=8h
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service role>
   SUPABASE_JWT_SECRET=<JWT secret de Supabase>
   FRONTEND_URL=https://deyanira.pe
   ALLOWED_ORIGINS=https://deyanira.pe,https://www.deyanira.pe
   COOKIE_DOMAIN=.deyanira.pe
   BCRYPT_COST=12
   CLOUDINARY_CLOUD_NAME=<...>
   CLOUDINARY_API_KEY=<...>
   CLOUDINARY_API_SECRET=<...>
   CULQI_PUBLIC_KEY=pk_live_<...>
   CULQI_SECRET_KEY=sk_live_<...>
   CULQI_WEBHOOK_SECRET=<si usas webhooks de Culqi>
   RESEND_API_KEY=re_<...>
   EMAIL_FROM=Deyanira Makeup Beauty <admin@deyaniramakeup.pe>
   SALON_ADMIN_EMAIL=admin@deyanira.pe
   WHATSAPP_NUMBER=+51XXXXXXXXX
   SALON_WHATSAPP=+51XXXXXXXXX
   YAPE_NUMBER=+51XXXXXXXXX
   NEXT_PUBLIC_WEB_URL=https://deyanira.pe
   TURNSTILE_SECRET_KEY=<opcional, anti-bot>
   REVALIDATE_SECRET=<32+ chars — MISMO valor que en Vercel>
   ```

   > `env.js` hace **fail-fast**: en prod son obligatorios `FRONTEND_URL`,
   > `CULQI_SECRET_KEY`, `RESEND_API_KEY`, `SUPABASE_JWT_SECRET` (+ `DATABASE_URL`,
   > `ADMIN_JWT_SECRET`). Si falta alguno, el contenedor no arranca y lo dirá en logs.

4. **Networking → Generate Domain** (o dominio propio `api.deyanira.pe`).
5. Verifica el deploy: `GET https://<dominio-railway>/api/health` → `200`.

---

## 3. Web → Vercel

1. **New Project** → importar `rojaspardopaul/deyanira-web`.
2. **Root Directory:** `apps/web`. Framework: Next.js (autodetectado). Vercel
   instala desde la raíz del monorepo (workspaces) automáticamente.
3. **Environment Variables** (Production):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   NEXT_PUBLIC_API_URL=https://api.deyanira.pe
   NEXT_PUBLIC_APP_URL=https://deyanira.pe
   NEXT_PUBLIC_WEB_URL=https://deyanira.pe
   NEXT_PUBLIC_CULQI_PUBLIC_KEY=pk_live_<...>
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=<opcional>
   NEXT_PUBLIC_GOOGLE_MAPS_KEY=<...>
   NEXT_PUBLIC_WHATSAPP_NUMBER=+51XXXXXXXXX
   NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
   REVALIDATE_SECRET=<MISMO valor que en Railway>
   ```

   > El build de Next ahora **sí** valida TS/ESLint (escape hatch: `SKIP_TS=true` /
   > `SKIP_LINT=true`, solo emergencias). El build ya pasa en verde localmente.

4. Deploy y verifica que cargue la home y que `NEXT_PUBLIC_API_URL` apunte al API.

---

## 4. DNS y dominios

| Registro | Apunta a |
|---|---|
| `deyanira.pe` y `www.deyanira.pe` | Vercel (según el panel de Vercel: A/CNAME) |
| `api.deyanira.pe` | dominio del servicio Railway (CNAME) |

Tras propagar DNS, confirma `ALLOWED_ORIGINS` (Railway) y `NEXT_PUBLIC_API_URL`
(Vercel) coherentes con los dominios finales. `COOKIE_DOMAIN=.deyanira.pe` permite
compartir cookie entre `www.*` y `api.*`.

---

## 5. Verificación post-deploy

- [ ] `https://api.deyanira.pe/api/health` → 200; `/api/health/ready` → 200 (BD OK).
- [ ] Home pública carga; catálogo/servicios traen datos del API (sin errores CORS).
- [ ] Login admin (`/admin`) funciona (JWT).
- [ ] Flujo de reserva de punta a punta (disponibilidad → crear cita).
- [ ] Pago de prueba con Culqi **live** (monto mínimo) y verificar webhook si aplica.
- [ ] Email transaccional llega (confirmación de cita) vía Resend.
- [ ] Generar un **recibo PDF** desde admin → confirma que Puppeteer/Chromium
      funciona en el contenedor (era un bloqueante; ya corregido en el Dockerfile).
- [ ] Revisar logs de Railway: sin `[FATAL]` de env ni crashes de arranque.

---

## Notas de los arreglos de este despliegue

- **Dockerfile** ahora arranca con `tsx` (no `node`): el código carga módulos `.ts`
  (DDD) y `@deyanira/contracts` (TS), que `node` puro no resuelve.
- **Chromium del sistema** instalado en la imagen + `PUPPETEER_EXECUTABLE_PATH`
  (el Chromium empaquetado de Puppeteer no corre sobre Alpine/musl).
- Se copia `packages/` y el manifest de `apps/web` en la imagen para que
  `@deyanira/contracts` resuelva y `npm ci` valide el lock del monorepo.
- Corregidos 2 errores de tipos del frontend que rompían el build de Vercel
  (`ServiceModifiersBuilder.tsx`, `useAppointments.ts`).
