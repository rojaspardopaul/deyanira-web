// Singleton PrismaClient — evita conexiones múltiples al pooler de Supabase.
// Cargar SIEMPRE desde aquí; nunca hacer `new PrismaClient()` en otras rutas.
//
// NOTA (Fase 0): la implementación canónica permanece en este .js para que el
// código legacy (~26 require) y los tests (vitest) la resuelvan con require nativo.
// El código nuevo en TS la consume tipada vía shared/database/prisma.ts (wrapper).
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma__ ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['error', 'warn'],
    errorFormat: 'minimal',
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma__ = prisma;
}

// Graceful shutdown
async function disconnect() {
  try { await prisma.$disconnect(); } catch {}
}
process.on('beforeExit', disconnect);
process.on('SIGTERM',  () => disconnect().finally(() => process.exit(0)));
process.on('SIGINT',   () => disconnect().finally(() => process.exit(0)));

module.exports = prisma;
