// Singleton PrismaClient — evita conexiones múltiples al pooler de Supabase.
// Cargar SIEMPRE desde aquí; nunca hacer `new PrismaClient()` en otras rutas.
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
