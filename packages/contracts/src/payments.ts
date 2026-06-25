// Contrato del dominio de pagos. Fuente única FE↔BE.

import { z } from 'zod';
import { UUID_RE, EMAIL_RE } from './regex';

export const PagoCulqiSchema = z.object({
  orderId: z.string().regex(UUID_RE, 'orderId inválido'),
  culqiToken: z.string().min(10).max(120),
  email: z.string().regex(EMAIL_RE, 'email inválido').max(150),
});

export const ConfirmarYapeSchema = z.object({
  orderId: z.string().regex(UUID_RE, 'orderId inválido'),
  reference: z.string().min(1).max(100).optional(),
});

export type PagoCulqiInput = z.infer<typeof PagoCulqiSchema>;
export type ConfirmarYapeInput = z.infer<typeof ConfirmarYapeSchema>;
