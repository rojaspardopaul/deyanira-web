// Esquemas Zod para validación consistente de los handlers admin.
// Estrategia: cada esquema declara y valida los campos críticos (requeridos,
// tipos, rangos, enums) y usa `.passthrough()` para NO descartar los demás
// campos que el handler normaliza por su cuenta (slug sanitize, slice, etc.).
// Así la validación queda centralizada en Zod sin alterar la lógica existente.

const { z } = require('zod');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const PROMOTION_TYPES = ['percent', 'fixed'];
const GALLERY_CATEGORIES = ['maquillaje', 'cabello', 'unas', 'cejas', 'general'];
const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'awaiting_verification', 'paid', 'failed'];

const uuid = z.string().regex(UUID_RE, 'ID inválido');
const IdParam = z.object({ id: uuid });

// ── Servicios ──────────────────────────────────────────────────
const ServiceCreate = z.object({
  name: z.string().trim().min(1, 'name requerido'),
  slug: z.string().trim().min(1, 'slug requerido'),
  pricePen: z.coerce.number().min(0, 'pricePen inválido'),
  duration: z.coerce.number().int('duration inválido').min(1, 'duration inválido (1–480)').max(480, 'duration inválido (1–480)'),
}).passthrough();

const ServiceUpdate = z.object({
  name: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  pricePen: z.coerce.number().min(0).optional(),
  duration: z.coerce.number().int().min(1).max(480).optional(),
}).passthrough();

// ── Categorías de servicios ────────────────────────────────────
const CategoryCreate = z.object({
  name: z.string().trim().min(1, 'name requerido'),
  slug: z.string().trim().min(1, 'slug requerido'),
}).passthrough();

// ── Productos ──────────────────────────────────────────────────
const ProductCreate = z.object({
  name: z.string().trim().min(1, 'name requerido'),
  // El slug se genera en el backend a partir del nombre si no se envía.
  slug: z.string().trim().min(1).optional(),
  pricePen: z.coerce.number().min(0, 'pricePen inválido'),
  images: z.array(z.string()).optional(),
}).passthrough();

const ProductUpdate = z.object({
  name: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  pricePen: z.coerce.number().min(0).optional(),
  images: z.array(z.string()).optional(),
}).passthrough();

// ── Staff ──────────────────────────────────────────────────────
const StaffCreate = z.object({
  name: z.string().trim().min(1, 'name es requerido'),
}).passthrough();

const ScheduleItem = z.object({
  dayOfWeek: z.number().int().min(0, 'dayOfWeek debe ser 0–6').max(6, 'dayOfWeek debe ser 0–6'),
  startTime: z.string().regex(TIME_RE, 'startTime debe ser HH:MM'),
  endTime: z.string().regex(TIME_RE, 'endTime debe ser HH:MM'),
}).passthrough();
const SchedulesBody = z.object({
  schedules: z.array(ScheduleItem),
}).passthrough();

// ── Bloqueos de disponibilidad ─────────────────────────────────
const UnavailabilityCreate = z.object({
  date: z.string().regex(DATE_RE, 'date es requerido (YYYY-MM-DD)'),
  staffId: z.string().regex(UUID_RE, 'staffId inválido').optional().nullable(),
  startTime: z.string().regex(TIME_RE, 'startTime debe ser HH:MM').optional().nullable(),
  endTime: z.string().regex(TIME_RE, 'endTime debe ser HH:MM').optional().nullable(),
}).passthrough().refine(
  (d) => Boolean(d.startTime) === Boolean(d.endTime),
  { message: 'Se requieren startTime y endTime juntos', path: ['startTime'] },
);

// ── Galería ────────────────────────────────────────────────────
// Acepta dos modos:
//   a) `imageUrl` ya subido a Cloudinary (flujo nuevo: subida múltiple imágenes/videos)
//   b) `file` base64 (compat: el backend lo sube como imagen)
const GalleryUpload = z.object({
  file: z.string().min(1).optional(),
  imageUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional().nullable(),
  mediaType: z.enum(['image', 'video']).optional(),
  caption: z.string().max(200).optional().nullable(),
  category: z.enum(GALLERY_CATEGORIES, { errorMap: () => ({ message: 'Categoría de galería inválida' }) }).optional().nullable(),
}).passthrough().refine((d) => Boolean(d.file) || Boolean(d.imageUrl), {
  message: 'Falta el archivo o la URL del medio', path: ['imageUrl'],
});

const GalleryUpdate = z.object({
  category: z.enum(GALLERY_CATEGORIES, { errorMap: () => ({ message: 'Categoría de galería inválida' }) }).optional().nullable(),
}).passthrough();

// ── Blog ───────────────────────────────────────────────────────
const BlogCreate = z.object({
  title: z.string().trim().min(1, 'title requerido'),
  slug: z.string().trim().min(1, 'slug requerido'),
  content: z.string().min(1, 'content requerido'),
}).passthrough();

// ── Promociones ────────────────────────────────────────────────
const PromotionCreate = z.object({
  code: z.string().trim().min(1, 'code requerido'),
  type: z.enum(PROMOTION_TYPES, { errorMap: () => ({ message: 'type debe ser "percent" o "fixed"' }) }),
  value: z.coerce.number(),
}).passthrough().refine(
  (d) => d.type !== 'percent' || (d.value >= 1 && d.value <= 100),
  { message: 'Descuento en porcentaje debe ser 1–100', path: ['value'] },
);

const PromotionUpdate = z.object({
  type: z.enum(PROMOTION_TYPES, { errorMap: () => ({ message: 'type debe ser "percent" o "fixed"' }) }).optional(),
  value: z.coerce.number().optional(),
}).passthrough();

// ── Clientes ───────────────────────────────────────────────────
const CustomerCreate = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
}).passthrough();

// ── Pedidos ────────────────────────────────────────────────────
const OrderUpdate = z.object({
  status: z.enum(ORDER_STATUSES, { errorMap: () => ({ message: 'Estado de pedido inválido' }) }).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES, { errorMap: () => ({ message: 'Estado de pago inválido' }) }).optional(),
}).passthrough();

module.exports = {
  IdParam,
  ServiceCreate, ServiceUpdate,
  CategoryCreate,
  ProductCreate, ProductUpdate,
  StaffCreate, SchedulesBody,
  UnavailabilityCreate,
  GalleryUpload, GalleryUpdate,
  BlogCreate,
  PromotionCreate, PromotionUpdate,
  CustomerCreate,
  OrderUpdate,
};
