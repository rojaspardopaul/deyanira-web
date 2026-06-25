// Esquemas Zod de entrada del módulo financiero (panel admin).

import { z } from 'zod';
import { TIPOS_MOVIMIENTO, METODOS_PAGO } from '../domain/TipoMovimiento';

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const RegistrarMovimientoSchema = z
  .object({
    tipo: z.enum(TIPOS_MOVIMIENTO as [string, ...string[]]),
    direccion: z.enum(['in', 'out']).optional(),
    monto: z.coerce.number().finite().positive().max(1_000_000),
    descripcion: z.string().min(1).max(300),
    fecha: z.string().regex(DATE_RE, 'Fecha inválida (YYYY-MM-DD)'),
    categoria: z.string().max(60).nullish(),
    metodoPago: z.enum(METODOS_PAGO as unknown as [string, ...string[]]).nullish(),
    accountId: z.string().uuid().nullish(),
    customerId: z.string().uuid().nullish(),
    staffId: z.string().uuid().nullish(),
    receiptUrl: z.string().max(500).nullish(),
  })
  .strict();

export const AnularMovimientoSchema = z
  .object({
    motivo: z.string().max(300).nullish(),
  })
  .strict();

export const CrearCuentaSchema = z
  .object({
    name: z.string().min(1).max(60),
    type: z.enum(['cash', 'wallet', 'bank', 'card']).default('cash'),
    sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  })
  .strict();

export const ActualizarCuentaSchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    type: z.enum(['cash', 'wallet', 'bank', 'card']).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  })
  .strict();
