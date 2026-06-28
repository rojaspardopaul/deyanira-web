// Contrato del dominio de citas/reservas. Fuente única FE↔BE.

import { z } from 'zod';
import { UUID_RE, TIME_RE, DATE_RE, EMAIL_RE, PHONE_RE } from './regex';

export const DisponibilidadQuerySchema = z.object({
  staffId: z.string().optional(),
  serviceId: z.string().regex(UUID_RE),
  date: z.string().regex(DATE_RE),
  duration: z.string().regex(/^\d+$/).optional(),
  forPackage: z.enum(['1', 'true']).optional(),
});

export const CrearCitaSchema = z
  .object({
    staffId: z.string().optional().nullable(),
    serviceId: z.string().regex(UUID_RE),
    date: z.string().regex(DATE_RE),
    startTime: z.string().regex(TIME_RE),
    endTime: z.string().regex(TIME_RE),
    notes: z.string().max(500).optional().nullable(),
    guestName: z.string().trim().min(1).max(100).optional(),
    guestPhone: z.string().regex(PHONE_RE).max(20).optional(),
    guestEmail: z.string().regex(EMAIL_RE).max(150).optional(),
    atHome: z.boolean().optional(),
    atHomeAddress: z.string().max(200).optional(),
    atHomeDistrict: z.string().max(80).optional(),
    onDutyStaff: z.boolean().optional(),
    modifierSelections: z.record(z.any()).optional(),
    turnstileToken: z.string().max(2048).optional(),
    website: z.string().max(100).optional(),
  })
  .strict();

const BatchItemSchema = z
  .object({
    serviceId: z.string().regex(UUID_RE),
    staffId: z.string().optional().nullable(),
    onDuty: z.boolean().optional(),
    date: z.string().regex(DATE_RE).optional(),
    startTime: z.string().regex(TIME_RE).optional(),
    addonPricePen: z.number().min(0).optional(),
    modifierSelections: z.record(z.any()).optional(),
  })
  .strict();

export const CrearReservaSchema = z
  .object({
    packageId: z.string().regex(UUID_RE).optional().nullable(),
    items: z.array(BatchItemSchema).min(1).max(20),
    date: z.string().regex(DATE_RE),
    startTime: z.string().regex(TIME_RE),
    notes: z.string().max(500).optional().nullable(),
    guestName: z.string().trim().min(1).max(100).optional(),
    guestPhone: z.string().regex(PHONE_RE).max(20).optional(),
    guestEmail: z.string().regex(EMAIL_RE).max(150).optional(),
    atHome: z.boolean().optional(),
    atHomeAddress: z.string().max(200).optional(),
    atHomeDistrict: z.string().max(80).optional(),
    clientPickup: z.boolean().optional(),
    turnstileToken: z.string().max(2048).optional(),
    website: z.string().max(100).optional(),
  })
  .strict();

export type CrearCitaInput = z.infer<typeof CrearCitaSchema>;
export type CrearReservaInput = z.infer<typeof CrearReservaSchema>;
export type DisponibilidadQuery = z.infer<typeof DisponibilidadQuerySchema>;
