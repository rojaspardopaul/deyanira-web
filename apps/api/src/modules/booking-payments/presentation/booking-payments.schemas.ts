// Esquemas Zod de entrada del módulo de adelantos (flujo público). El id del pago
// es un UUIDv4 (122 bits) → actúa como challenge para el flujo guest.

import { z } from 'zod';

/* eslint-disable @typescript-eslint/no-var-requires */
const { EMAIL_RE } = require('../../../lib/validate') as { EMAIL_RE: RegExp };

export const PagoCulqiSchema = z
  .object({
    culqiToken: z.string().min(10).max(120),
    email: z.string().regex(EMAIL_RE, 'email inválido').max(150),
  })
  .strict();

export const ComprobanteAdelantoSchema = z
  .object({
    image: z.string().startsWith('data:image/').max(8 * 1024 * 1024),
    method: z.enum(['yape', 'plin', 'transfer']),
  })
  .strict();
