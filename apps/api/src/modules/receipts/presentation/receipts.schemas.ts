// Esquemas Zod de entrada del módulo de recibos (panel admin).

import { z } from 'zod';

const METODOS = ['cash', 'yape', 'plin', 'transfer', 'culqi'] as const;
const money = z.number().finite().nonnegative();

const ItemSchema = z
  .object({
    description: z.string().min(1).max(200),
    qty: z.number().int().positive().max(999).default(1),
    unitPen: money,
    amountPen: money,
  })
  .strict();

const PagoSchema = z
  .object({
    amountPen: z.number().finite().positive(),
    method: z.enum(METODOS).default('cash'),
    paidAt: z.string().max(40).nullish(),
    note: z.string().max(300).nullish(),
  })
  .strict();

export const CrearReciboSchema = z
  .object({
    customerName: z.string().min(1).max(150),
    customerEmail: z.string().max(150).nullish(),
    customerPhone: z.string().max(40).nullish(),
    customerId: z.string().uuid().nullish(),
    title: z.string().max(200).nullish(),
    items: z.array(ItemSchema).min(1).max(50),
    bookingGroupId: z.string().uuid().nullish(),
    packageId: z.string().uuid().nullish(),
    notes: z.string().max(1000).nullish(),
    payments: z.array(PagoSchema).max(20).optional(),
  })
  .strict();

export const AgregarPagoSchema = z
  .object({
    amountPen: z.number().finite().positive(),
    method: z.enum(METODOS).default('cash'),
    paidAt: z.string().max(40).nullish(),
    note: z.string().max(300).nullish(),
  })
  .strict();
