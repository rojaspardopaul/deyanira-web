import { z } from 'zod';

/* eslint-disable @typescript-eslint/no-var-requires */
const { UUID_RE, EMAIL_RE } = require('../../../lib/validate') as { UUID_RE: RegExp; EMAIL_RE: RegExp };

export const PagoCulqiSchema = z.object({
  orderId: z.string().regex(UUID_RE, 'orderId inválido'),
  culqiToken: z.string().min(10).max(120),
  email: z.string().regex(EMAIL_RE, 'email inválido').max(150),
});

export const ConfirmarYapeSchema = z.object({
  orderId: z.string().regex(UUID_RE, 'orderId inválido'),
  reference: z.string().min(1).max(100).optional(),
});
