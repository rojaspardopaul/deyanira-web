// Esquema Zod del checkout. Réplica fiel de OrderBody legacy.

import { z } from 'zod';

/* eslint-disable @typescript-eslint/no-var-requires */
const { UUID_RE, EMAIL_RE, PHONE_RE } = require('../../../lib/validate') as {
  UUID_RE: RegExp;
  EMAIL_RE: RegExp;
  PHONE_RE: RegExp;
};

const PAYMENT_METHODS = ['culqi', 'yape'] as const;
const MAX_ITEMS = 50;
const MAX_QTY_PER_ITEM = 99;

// Comprobante de pago (Yape/Plin/transferencia). Imagen como data URL base64.
export const ComprobanteSchema = z
  .object({
    image: z.string().startsWith('data:image/').max(8 * 1024 * 1024),
    method: z.enum(['yape', 'plin', 'transfer']).optional(),
  })
  .strict();

const OrderItemSchema = z.object({
  productId: z.string().regex(UUID_RE),
  qty: z.number().int().min(1).max(MAX_QTY_PER_ITEM),
});

// NO usamos .strict(): el frontend envía además totales calculados (subtotalPen,
// shippingPen, discountPen, totalPen, shipCity) que el servidor RECALCULA y por
// tanto ignora (anti-tampering). Zod, por defecto, descarta esas claves desconocidas
// en vez de rechazar el pedido. (El OrderBody legacy era .strict() y rompía con
// este mismo body.)
export const CrearPedidoSchema = z.object({
  items: z.array(OrderItemSchema).min(1).max(MAX_ITEMS),
  shipName: z.string().trim().min(1).max(100),
  shipPhone: z.string().regex(PHONE_RE, 'Teléfono inválido'),
  shipEmail: z.string().regex(EMAIL_RE, 'Email inválido').max(150).optional().nullable(),
  shipAddress: z.string().trim().min(5).max(200),
  shipDistrict: z.string().trim().min(2).max(50),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  couponCode: z.string().trim().min(1).max(50).optional().nullable(),
});
