import { z } from 'zod';
import { EMAIL_RE, PHONE_RE } from './regex';

// Hoja de Reclamación (Libro de Reclamaciones — INDECOPI). Esquema compartido
// FE↔BE. Campos exigidos por la normativa peruana.
export const ReclamacionSchema = z
  .object({
    // Consumidor
    consumidorNombre: z.string().trim().min(2).max(120),
    consumidorTipoDoc: z.enum(['DNI', 'CE', 'Pasaporte', 'RUC']),
    consumidorNumDoc: z.string().trim().min(6).max(20),
    consumidorDomicilio: z.string().trim().min(3).max(200),
    consumidorTelefono: z.string().regex(PHONE_RE).max(20).optional().or(z.literal('')),
    consumidorEmail: z.string().regex(EMAIL_RE).max(150),
    esMenor: z.boolean().optional(),
    apoderadoNombre: z.string().trim().max(120).optional().or(z.literal('')),
    // Bien contratado
    bienTipo: z.enum(['PRODUCTO', 'SERVICIO']),
    montoReclamado: z.number().nonnegative().max(1_000_000).optional().nullable(),
    bienDescripcion: z.string().trim().min(3).max(500),
    // Detalle del reclamo/queja
    tipo: z.enum(['RECLAMO', 'QUEJA']),
    detalle: z.string().trim().min(5).max(2000),
    pedido: z.string().trim().min(3).max(1000),
    // Anti-spam
    website: z.string().max(100).optional(),
    turnstileToken: z.string().max(2048).optional(),
  })
  .strict();

export type ReclamacionInput = z.infer<typeof ReclamacionSchema>;
