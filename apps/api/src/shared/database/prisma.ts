// Superficie tipada del cliente Prisma para el código nuevo (TS).
//
// La implementación canónica (singleton + graceful shutdown) vive en lib/prisma.js
// (JS) a propósito: así el código legacy y los tests la resuelven con require nativo
// sin tropezar con la resolución de .ts. Aquí solo le ponemos el tipo PrismaClient.
import type { PrismaClient } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-var-requires */
const prisma = require('../../lib/prisma') as PrismaClient;

export = prisma;
