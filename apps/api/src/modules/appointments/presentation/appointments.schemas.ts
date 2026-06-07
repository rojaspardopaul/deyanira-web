// Esquemas Zod de entrada del módulo. Réplica fiel de CreateBody legacy, reutilizando
// los regex centralizados de lib/validate.

import { z } from 'zod';

/* eslint-disable @typescript-eslint/no-var-requires */
const { UUID_RE, TIME_RE, DATE_RE, EMAIL_RE, PHONE_RE } = require('../../../lib/validate') as {
  UUID_RE: RegExp;
  TIME_RE: RegExp;
  DATE_RE: RegExp;
  EMAIL_RE: RegExp;
  PHONE_RE: RegExp;
};

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
