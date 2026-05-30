# syntax=docker/dockerfile:1.7
# ── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder

# Seguridad: no ejecutar como root incluso en build
RUN apk add --no-cache dumb-init openssl

WORKDIR /app

# Capa caché: instalar deps primero
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma

# Workspaces — npm ci es deterministic
RUN npm ci --omit=dev --workspaces --include-workspace-root \
 && npx --yes prisma generate --schema apps/api/prisma/schema.prisma

# Copiar el source
COPY apps/api ./apps/api

# ── Runtime stage (mínima) ───────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init openssl curl \
 && addgroup -S app -g 10001 \
 && adduser  -S app -G app -u 10001

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    PORT=3001

WORKDIR /app

# Copia mínima (no source de tests, no .git, no env)
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=app:app /app/apps/api/prisma     ./apps/api/prisma
COPY --from=builder --chown=app:app /app/apps/api/src        ./apps/api/src
COPY --from=builder --chown=app:app /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=app:app /app/package.json        ./package.json

USER app

EXPOSE 3001

# Healthcheck profundo: incluye verificación de BD vía /api/health/ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3001/api/health || exit 1

# dumb-init reenvía SIGTERM correctamente → graceful shutdown
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/src/index.js"]
