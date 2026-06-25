# syntax=docker/dockerfile:1.7
# ── Build stage ──────────────────────────────────────────────
FROM node:26-alpine AS builder

# Seguridad: no ejecutar como root incluso en build
RUN apk add --no-cache dumb-init openssl

WORKDIR /app

# Puppeteer: NO descargar el Chromium empaquetado (no corre sobre musl/Alpine).
# En runtime usamos el Chromium del sistema vía PUPPETEER_EXECUTABLE_PATH.
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Capa caché: instalar deps primero. Copiamos TODOS los manifests de workspaces
# (incluido apps/web) para que package-lock valide; luego acotamos el install al
# workspace del API con --workspace, así NO instalamos las deps del frontend.
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json  apps/web/
COPY packages packages
COPY apps/api/prisma apps/api/prisma

# Solo deps del API (+ raíz) — determinístico. tsx, prisma y @prisma/client
# están en las dependencies de apps/api, así que quedan disponibles en runtime.
RUN npm ci --omit=dev --workspace apps/api --include-workspace-root \
 && npx --yes prisma generate --schema apps/api/prisma/schema.prisma

# Copiar el source
COPY apps/api ./apps/api

# ── Runtime stage (mínima) ───────────────────────────────────
FROM node:26-alpine AS runner

# Chromium del sistema para Puppeteer (recibos PDF). El binario empaquetado de
# puppeteer no corre sobre musl/Alpine, así que usamos el de los repos de Alpine.
RUN apk add --no-cache dumb-init openssl curl \
      chromium nss freetype harfbuzz ca-certificates ttf-freefont \
 && addgroup -S app -g 10001 \
 && adduser  -S app -G app -u 10001

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    PORT=3001 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copia mínima (no source de tests, no .git, no env). Con npm workspaces TODO se
# hoistea al node_modules raíz; no existe apps/api/node_modules, no se copia.
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/apps/api/prisma     ./apps/api/prisma
COPY --from=builder --chown=app:app /app/apps/api/src        ./apps/api/src
COPY --from=builder --chown=app:app /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=app:app /app/package.json        ./package.json
# Paquete workspace @deyanira/contracts (TS crudo, lo carga tsx en runtime)
COPY --from=builder --chown=app:app /app/packages           ./packages

USER app

EXPOSE 3001

# Healthcheck profundo: incluye verificación de BD vía /api/health/ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3001/api/health || exit 1

# El código importa módulos .ts (DDD) y @deyanira/contracts (TS), así que el
# runtime es tsx (no `node`, que no resuelve .ts). tsx está en dependencies.
# dumb-init reenvía SIGTERM correctamente → graceful shutdown.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node_modules/.bin/tsx", "apps/api/src/index.js"]
