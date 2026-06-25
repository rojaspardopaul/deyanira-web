// Contrato del dominio de pedidos (tienda). Fuente única FE↔BE.

import { z } from 'zod';
import { UUID_RE, EMAIL_RE, PHONE_RE } from './regex';

const PAYMENT_METHODS = ['culqi', 'yape'] as const;
const MAX_ITEMS = 50;
const MAX_QTY_PER_ITEM = 99;

export const OrderItemSchema = z.object({
  productId: z.string().regex(UUID_RE),
  qty: z.number().int().min(1).max(MAX_QTY_PER_ITEM),
});

// NO .strict(): el frontend envía totales calculados que el servidor recalcula e
// ignora; Zod los descarta.
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

// Comprobante de pago (Yape/Plin/transferencia). Imagen como data URL base64.
export const ComprobanteSchema = z
  .object({
    image: z.string().startsWith('data:image/').max(8 * 1024 * 1024),
    method: z.enum(['yape', 'plin', 'transfer']).optional(),
  })
  .strict();

export type CrearPedidoInput = z.infer<typeof CrearPedidoSchema>;
export type ComprobanteInput = z.infer<typeof ComprobanteSchema>;
