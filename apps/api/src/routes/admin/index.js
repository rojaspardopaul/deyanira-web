const { Router } = require('express');
const { isAdmin, requireRole } = require('../../middleware/auth');
const { uploadImage, uploadVideo } = require('../../lib/cloudinary');
const { auditMiddleware } = require('../../lib/audit');
const cache = require('../../lib/cache');
const { revalidateFrontend } = require('../../lib/revalidate');
const { parsePagination, paginate } = require('../../lib/pagination');
const { validate } = require('../../lib/validate');
const { BadRequest } = require('../../lib/errors');
const S = require('./schemas');
const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');
const accountingRouter = require('./accounting');
const mfaRouter = require('./mfa');
const eventTypesAdminRouter = require('./event-types');
const { crearRouterAdminCitas } = require('../../modules/appointments/presentation/appointments.admin.routes');
const { crearRouterAdminAdelantos } = require('../../modules/booking-payments/presentation/booking-payments.admin.routes');
const { crearRouterAdminRecibos } = require('../../modules/receipts/presentation/receipts.admin.routes');
const { crearRouterAdminFinanzas } = require('../../modules/financial/presentation/financial.admin.routes');
const { sendOrderStatusUpdate } = require('../../lib/notifications/email');
const { randomUUID } = require('crypto');

const router = Router();

// Todas las rutas admin requieren JWT válido + CSRF token (verificado en isAdmin)
router.use(isAdmin);

// Cache-Control: las respuestas admin nunca deben cachearse
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// Audit log de mutaciones
router.use(auditMiddleware);

// Invalidación de caché tras mutaciones admin exitosas. Centralizado por prefijo
// de ruta, para no instrumentar cada handler. Cada entrada invalida:
//   · `cache`: prefijos de la caché in-memory del backend (src/lib/cache.js)
//   · `tags` : tags de la caché de datos de Next (vía webhook /api/revalidate)
const INVALIDATION_MAP = [
  { match: /^\/(services|service-categories)/,                   cache: ['services'],    tags: ['services'] },
  { match: /^\/(staff|unavailability)/,                          cache: ['staff'],       tags: ['staff'] },
  { match: /^\/settings/,                                        cache: ['settings'],    tags: ['settings'] },
  { match: /^\/promotions/,                                      cache: ['promotions'],  tags: ['promotions'] },
  { match: /^\/(catalogs|catalog-items|event-types|packages|addons|benefits)/, cache: ['catalogs'], tags: ['catalogs', 'event-types'] },
  { match: /^\/products/,                                        cache: [],              tags: ['products'] },
  { match: /^\/gallery/,                                         cache: [],              tags: ['gallery'] },
];
router.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'OPTIONS') return next();
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const tags = new Set();
    for (const entry of INVALIDATION_MAP) {
      if (entry.match.test(req.path)) {
        if (entry.cache.length) cache.invalidate(...entry.cache);
        entry.tags.forEach((t) => tags.add(t));
      }
    }
    // Purga la caché de Next on-demand (fire-and-forget, no bloquea la respuesta).
    if (tags.size) revalidateFrontend([...tags]);
  });
  next();
});

// MFA endpoints (enrollment, activate, deactivate)
router.use('/mfa', mfaRouter);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Normaliza la lista de certificados/títulos de una estilista (array de strings).
function sanitizeCertifications(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean).slice(0, 20);
}

// Role helpers (requireRole importado de middleware/auth)
const isSuperAdmin = requireRole('super_admin');
// eslint-disable-next-line no-unused-vars
const isAdminOrAbove = requireRole('super_admin', 'admin');

// ── Perfil del admin logueado ─────────────────────────────────
router.get('/me', async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { id: true, name: true, email: true, role: true, staffId: true, isActive: true },
    });
    if (!admin) return res.status(404).json({ error: 'Admin no encontrado' });
    res.json(admin);
  } catch (err) { next(err); }
});

function pick(obj, keys) {
  const result = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) result[key] = obj[key];
  }
  return result;
}

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed'];
const PROMOTION_TYPES = ['percent', 'fixed'];
const GALLERY_CATEGORIES = ['maquillaje', 'cabello', 'unas', 'cejas', 'general'];

// ── Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', async (_req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [appointmentsToday, pendingOrders, totalCustomers, recentAppointments] =
      await Promise.all([
        prisma.appointment.count({ where: { date: { gte: today, lt: tomorrow } } }),
        prisma.order.count({ where: { status: 'pending' } }),
        prisma.customer.count(),
        prisma.appointment.findMany({
          where: { date: { gte: today } },
          include: { service: true, staff: true },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
          take: 10,
        }),
      ]);

    res.json({ appointmentsToday, pendingOrders, totalCustomers, recentAppointments });
  } catch (err) { next(err); }
});

// ── Gestión admin de citas (módulo, Strangler Fig completado) ─
// El módulo appointments es la ÚNICA implementación de la gestión admin de citas:
// GET/POST /appointments, POST /appointments/confirm-group, PATCH /appointments/:id
// y POST /appointments/package (alta de paquete + adelanto). Ya no queda lógica de
// citas en este god-file. Lo de abajo (/booking-payments/*) es gestión de adelantos.
router.use(crearRouterAdminCitas());

// ── Adelantos / pagos de reserva (módulo booking-payments) ────
// Toda la gestión admin de adelantos vive en el módulo booking-payments:
// GET /booking-payments (listado), POST /booking-payments/:id/verify (aprobar/
// rechazar comprobante) y POST /booking-payments/:id/record (registro manual).
router.use(crearRouterAdminAdelantos());

// ── Recibos (módulo receipts) ─────────────────────────────────
// Recibos de cualquier cobro con historial de abonos, PDF y envío por correo:
// GET/POST /receipts, GET /receipts/:id, POST /receipts/:id/payments|cancel|
// send-email, GET /receipts/:id/pdf.
router.use(crearRouterAdminRecibos());

// ── Centro Financiero (módulo financial) ──────────────────────
// Libro mayor central (financial_movements) + cuentas. KPIs del dashboard,
// timeline de movimientos, alta/anulación manual y CRUD de cajas:
// GET /finanzas/resumen|serie|movimientos|cuentas, POST /finanzas/movimientos,
// POST /finanzas/movimientos/:id/anular, POST|PATCH /finanzas/cuentas.
// La captura manual heredada (/accounting/*) se conserva y proyecta al ledger.
router.use(crearRouterAdminFinanzas());

// ── Servicios ─────────────────────────────────────────────────
router.get('/services', async (_req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      include: {
        category: true,
        staffServices: { include: { staff: { select: { id: true, name: true } } } },
        modifierGroups: {
          include: { options: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
        conditionalRules: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ categoryId: 'asc' }, { name: 'asc' }],
    });
    res.json(services);
  } catch (err) { next(err); }
});

router.get('/services/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    const service = await prisma.service.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        staffServices: { include: { staff: { select: { id: true, name: true } } } },
        modifierGroups: {
          include: { options: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
        conditionalRules: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json(service);
  } catch (err) { next(err); }
});

router.post('/services', validate({ body: S.ServiceCreate }), async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'name', 'slug', 'description', 'categoryId',
      'pricePen', 'comparePricePen', 'duration', 'imageUrl', 'isActive',
      'parallelGroup', 'daysBeforeMain',
      'longDescriptionMd', 'recommendationMd', 'scheduleInfoMd',
      'catalogSlug',
    ]);
    // Tipos/requeridos/rangos ya garantizados por Zod (S.ServiceCreate).
    // Aquí solo normalización de campos opcionales.
    if (data.daysBeforeMain === '' || data.daysBeforeMain === null) data.daysBeforeMain = null;
    else if (data.daysBeforeMain != null) data.daysBeforeMain = Number(data.daysBeforeMain);
    if (data.parallelGroup === '') data.parallelGroup = null;
    if (data.catalogSlug === '') data.catalogSlug = null;
    data.pricePen = Number(data.pricePen);
    if (data.comparePricePen === '' || data.comparePricePen == null) data.comparePricePen = null;
    else data.comparePricePen = Number(data.comparePricePen);
    data.duration = Number(data.duration);
    const service = await prisma.service.create({
      data,
      include: { category: true, staffServices: { include: { staff: { select: { id: true, name: true } } } } },
    });
    res.status(201).json(service);
  } catch (err) { next(err); }
});

router.patch('/services/:id', validate({ params: S.IdParam, body: S.ServiceUpdate }), async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'name', 'slug', 'description', 'categoryId',
      'pricePen', 'comparePricePen', 'duration', 'imageUrl', 'isActive',
      'parallelGroup', 'daysBeforeMain',
      'longDescriptionMd', 'recommendationMd', 'scheduleInfoMd',
      'catalogSlug',
    ]);
    if (data.daysBeforeMain === '' || data.daysBeforeMain === null) data.daysBeforeMain = null;
    else if (data.daysBeforeMain != null) data.daysBeforeMain = Number(data.daysBeforeMain);
    if (data.parallelGroup === '') data.parallelGroup = null;
    if (data.catalogSlug === '') data.catalogSlug = null;
    if (data.pricePen != null) data.pricePen = Number(data.pricePen);
    if (data.comparePricePen === '' || data.comparePricePen === null) data.comparePricePen = null;
    else if (data.comparePricePen != null) data.comparePricePen = Number(data.comparePricePen);
    if (data.duration != null) data.duration = Number(data.duration);
    const service = await prisma.service.update({
      where: { id: req.params.id },
      data,
      include: { category: true, staffServices: { include: { staff: { select: { id: true, name: true } } } } },
    });
    res.json(service);
  } catch (err) { next(err); }
});

router.delete('/services/:id', validate({ params: S.IdParam }), async (req, res, next) => {
  try {
    await prisma.service.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Reemplaza la lista de estilistas asignadas a un servicio
router.put('/services/:id/staff', validate({ params: S.IdParam }), async (req, res, next) => {
  try {
    const { staffIds } = req.body;
    if (!Array.isArray(staffIds)) return res.status(400).json({ error: 'staffIds debe ser un array' });
    if (staffIds.some(id => !UUID_RE.test(id))) return res.status(400).json({ error: 'IDs de estilista inválidos' });

    await prisma.$transaction([
      prisma.staffService.deleteMany({ where: { serviceId: req.params.id } }),
      ...(staffIds.length > 0 ? [prisma.staffService.createMany({
        data: staffIds.map(staffId => ({ staffId, serviceId: req.params.id })),
        skipDuplicates: true,
      })] : []),
    ]);

    const updated = await prisma.staffService.findMany({
      where: { serviceId: req.params.id },
      include: { staff: { select: { id: true, name: true } } },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// Sincroniza el `parallelGroup` de un servicio + los servicios con los que
// se puede hacer en paralelo. Mantiene la consistencia del grupo en una
// sola transacción:
//   - Si `withIds` está vacío: este servicio sale del grupo y se limpian
//     servicios que queden huérfanos (grupo de 1).
//   - Si `withIds` tiene elementos: se reutiliza el grupo existente de
//     alguno de ellos (o se genera uno nuevo) y todos quedan en el mismo
//     grupo. Servicios del grupo anterior de este servicio que ya no
//     estén en la lista quedan huérfanos → se limpian si corresponde.
router.post('/services/:id/parallel-with', validate({ params: S.IdParam }), async (req, res, next) => {
  try {
    const { withIds } = req.body;
    if (!Array.isArray(withIds)) return res.status(400).json({ error: 'withIds debe ser un array' });
    if (withIds.some(id => !UUID_RE.test(id))) return res.status(400).json({ error: 'IDs inválidos' });
    if (withIds.includes(req.params.id)) {
      return res.status(400).json({ error: 'No puedes incluir el mismo servicio en su lista de paralelos' });
    }

    const self = await prisma.service.findUnique({
      where: { id: req.params.id },
      select: { id: true, parallelGroup: true },
    });
    if (!self) return res.status(404).json({ error: 'Servicio no encontrado' });

    const oldGroup = self.parallelGroup;

    // Caso 1: limpiar — no hay paralelos
    if (withIds.length === 0) {
      await prisma.$transaction(async (tx) => {
        await tx.service.update({ where: { id: self.id }, data: { parallelGroup: null } });
        // Si el grupo anterior queda con un solo miembro, también lo limpiamos
        if (oldGroup) {
          const remaining = await tx.service.findMany({
            where: { parallelGroup: oldGroup },
            select: { id: true },
          });
          if (remaining.length === 1) {
            await tx.service.update({ where: { id: remaining[0].id }, data: { parallelGroup: null } });
          }
        }
      });
      return res.json({ parallelGroup: null, memberIds: [self.id] });
    }

    // Caso 2: hay paralelos — reutilizar grupo existente o crear uno nuevo
    const others = await prisma.service.findMany({
      where: { id: { in: withIds } },
      select: { id: true, parallelGroup: true },
    });
    if (others.length !== withIds.length) {
      return res.status(400).json({ error: 'Algún servicio no existe' });
    }
    // Prioridad: grupo del propio servicio si lo tiene, sino el primer grupo encontrado
    let targetGroup = oldGroup || others.find(s => s.parallelGroup)?.parallelGroup || null;
    if (!targetGroup) {
      // Generamos un identificador estable y legible
      targetGroup = `pg-${Math.random().toString(36).slice(2, 10)}`;
    }

    await prisma.$transaction(async (tx) => {
      const idsToSet = [self.id, ...withIds];
      await tx.service.updateMany({
        where: { id: { in: idsToSet } },
        data: { parallelGroup: targetGroup },
      });
      // Limpieza: si el grupo viejo era distinto y quedó con un solo miembro, romperlo
      if (oldGroup && oldGroup !== targetGroup) {
        const remaining = await tx.service.findMany({
          where: { parallelGroup: oldGroup },
          select: { id: true },
        });
        if (remaining.length === 1) {
          await tx.service.update({ where: { id: remaining[0].id }, data: { parallelGroup: null } });
        }
      }
    });

    const members = await prisma.service.findMany({
      where: { parallelGroup: targetGroup },
      select: { id: true, name: true },
    });
    res.json({ parallelGroup: targetGroup, memberIds: members.map(m => m.id), members });
  } catch (err) { next(err); }
});

// ── Modificadores dinámicos por servicio ──────────────────────
// PUT /admin/services/:id/modifiers — reemplaza atómicamente la configuración
// completa (grupos + opciones + reglas) de un servicio.
//
// Body:
//   {
//     groups: [{
//       id?, name, helpText?, fieldType, displayType?, required, sortOrder,
//       minValue?, maxValue?, stepValue?, defaultValue?,
//       options: [{
//         id?, label, value?, imageUrl?, iconName?,
//         modifierType, modifierValue, durationDelta, isDefault, sortOrder
//       }]
//     }],
//     rules: [{
//       id?, name, conditions, effect, effectValue, isActive, sortOrder
//     }]
//   }
const {
  VALID_FIELD_TYPES: PRICING_FIELD_TYPES,
  VALID_MODIFIER_TYPES: PRICING_MODIFIER_TYPES,
  VALID_RULE_EFFECTS: PRICING_RULE_EFFECTS,
} = require('../../lib/pricing/calculate');

router.put('/services/:id/modifiers', validate({ params: S.IdParam }), async (req, res, next) => {
  try {
    const serviceId = req.params.id;
    const { groups, rules } = req.body || {};
    if (!Array.isArray(groups)) return res.status(400).json({ error: 'groups debe ser un array' });
    if (rules != null && !Array.isArray(rules)) {
      return res.status(400).json({ error: 'rules debe ser un array' });
    }

    // Validación previa rápida
    for (const g of groups) {
      if (!g.name || typeof g.name !== 'string') {
        return res.status(400).json({ error: `Grupo sin nombre` });
      }
      if (!PRICING_FIELD_TYPES.includes(g.fieldType)) {
        return res.status(400).json({ error: `fieldType inválido: ${g.fieldType}` });
      }
      if (!Array.isArray(g.options)) {
        return res.status(400).json({ error: `Grupo "${g.name}" sin options` });
      }
      for (const o of g.options) {
        if (!o.label) return res.status(400).json({ error: `Opción sin label en "${g.name}"` });
        if (o.modifierType && !PRICING_MODIFIER_TYPES.includes(o.modifierType)) {
          return res.status(400).json({ error: `modifierType inválido: ${o.modifierType}` });
        }
      }
    }
    if (Array.isArray(rules)) {
      for (const r of rules) {
        if (!r.name) return res.status(400).json({ error: 'Regla sin nombre' });
        if (!PRICING_RULE_EFFECTS.includes(r.effect)) {
          return res.status(400).json({ error: `effect inválido: ${r.effect}` });
        }
      }
    }

    const exists = await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'Servicio no encontrado' });

    // Estrategia simple y atómica: borrar y recrear. Como cada save reemplaza
    // toda la configuración del servicio, no necesitamos diff fino.
    await prisma.$transaction(async (tx) => {
      await tx.serviceModifierGroup.deleteMany({ where: { serviceId } });
      await tx.serviceConditionalRule.deleteMany({ where: { serviceId } });

      for (let gi = 0; gi < groups.length; gi++) {
        const g = groups[gi];
        const createdGroup = await tx.serviceModifierGroup.create({
          data: {
            serviceId,
            name: String(g.name).trim(),
            helpText: g.helpText || null,
            fieldType: g.fieldType,
            displayType: g.displayType || null,
            required: Boolean(g.required),
            sortOrder: Number.isFinite(Number(g.sortOrder)) ? Number(g.sortOrder) : gi,
            minValue: g.minValue != null && g.minValue !== '' ? Number(g.minValue) : null,
            maxValue: g.maxValue != null && g.maxValue !== '' ? Number(g.maxValue) : null,
            stepValue: g.stepValue != null && g.stepValue !== '' ? Number(g.stepValue) : null,
            defaultValue:
              g.defaultValue != null ? (typeof g.defaultValue === 'string' ? g.defaultValue : JSON.stringify(g.defaultValue)) : null,
          },
        });
        if (g.options.length > 0) {
          await tx.serviceModifierOption.createMany({
            data: g.options.map((o, oi) => ({
              groupId: createdGroup.id,
              label: String(o.label).trim(),
              value: o.value || null,
              imageUrl: o.imageUrl || null,
              iconName: o.iconName || null,
              modifierType: o.modifierType || 'fixed',
              modifierValue: o.modifierValue != null ? Number(o.modifierValue) : 0,
              durationDelta: o.durationDelta != null ? parseInt(o.durationDelta, 10) || 0 : 0,
              isDefault: Boolean(o.isDefault),
              sortOrder: Number.isFinite(Number(o.sortOrder)) ? Number(o.sortOrder) : oi,
            })),
          });
        }
      }

      if (Array.isArray(rules) && rules.length > 0) {
        for (let ri = 0; ri < rules.length; ri++) {
          const r = rules[ri];
          await tx.serviceConditionalRule.create({
            data: {
              serviceId,
              name: String(r.name).trim(),
              conditions: r.conditions ?? [],
              effect: r.effect,
              effectValue: r.effectValue ?? {},
              isActive: r.isActive !== false,
              sortOrder: Number.isFinite(Number(r.sortOrder)) ? Number(r.sortOrder) : ri,
            },
          });
        }
      }
    });

    const fresh = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        modifierGroups: {
          include: { options: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
        conditionalRules: { orderBy: { sortOrder: 'asc' } },
      },
    });
    res.json(fresh);
  } catch (err) { next(err); }
});

// ── Categorías de servicios ────────────────────────────────────
router.get('/service-categories', async (_req, res, next) => {
  try {
    const cats = await prisma.serviceCategory.findMany({
      include: { _count: { select: { services: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(cats);
  } catch (err) { next(err); }
});

router.post('/service-categories', validate({ body: S.CategoryCreate }), async (req, res, next) => {
  try {
    const { name, slug, icon, sortOrder, isActive } = req.body;
    const cat = await prisma.serviceCategory.create({
      data: {
        name: String(name).slice(0, 100),
        slug: String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50),
        icon: icon ? String(icon).slice(0, 10) : null,
        sortOrder: sortOrder != null ? Number(sortOrder) : 0,
        isActive: isActive !== false,
      },
      include: { _count: { select: { services: true } } },
    });
    res.status(201).json(cat);
  } catch (err) { next(err); }
});

router.patch('/service-categories/:id', validate({ params: S.IdParam }), async (req, res, next) => {
  try {
    const data = pick(req.body, ['name', 'icon', 'sortOrder', 'isActive']);
    if (data.sortOrder != null) data.sortOrder = Number(data.sortOrder);
    const cat = await prisma.serviceCategory.update({
      where: { id: req.params.id },
      data,
      include: { _count: { select: { services: true } } },
    });
    res.json(cat);
  } catch (err) { next(err); }
});

router.delete('/service-categories/:id', validate({ params: S.IdParam }), async (req, res, next) => {
  try {
    await prisma.serviceCategory.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Productos ─────────────────────────────────────────────────
router.get('/products', async (req, res, next) => {
  try {
    const include = { category: true };
    const orderBy = { createdAt: 'desc' };
    const pg = parsePagination(req.query);
    if (pg.hasPage) {
      const result = await paginate(prisma.product, { where: undefined, include, orderBy }, pg);
      return res.json(result);
    }
    const products = await prisma.product.findMany({ include, take: 1000 });
    res.json(products);
  } catch (err) { next(err); }
});

router.post('/products', validate({ body: S.ProductCreate }), async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'name', 'slug', 'description', 'categoryId', 'brand',
      'pricePen', 'comparePrice', 'stock', 'images', 'isActive',
    ]);
    // name/slug/pricePen/images validados por Zod (S.ProductCreate).
    data.pricePen = Number(data.pricePen);
    if (data.stock != null) data.stock = Math.max(0, Number(data.stock));
    if (data.comparePrice != null) data.comparePrice = Number(data.comparePrice);
    const product = await prisma.product.create({ data });
    res.status(201).json(product);
  } catch (err) { next(err); }
});

router.patch('/products/:id', validate({ params: S.IdParam, body: S.ProductUpdate }), async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'name', 'slug', 'description', 'categoryId', 'brand',
      'pricePen', 'comparePrice', 'stock', 'images', 'isActive',
    ]);
    if (data.pricePen != null) data.pricePen = Number(data.pricePen);
    if (data.stock != null) data.stock = Math.max(0, Number(data.stock));
    if (data.comparePrice != null) data.comparePrice = Number(data.comparePrice);
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
    });
    res.json(product);
  } catch (err) { next(err); }
});

router.delete('/products/:id', validate({ params: S.IdParam }), async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Pedidos ───────────────────────────────────────────────────
router.get('/orders', async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = status && ORDER_STATUSES.includes(status) ? { status } : undefined;
    const include = { items: true, customer: true };
    const orderBy = { createdAt: 'desc' };

    const pg = parsePagination(req.query);
    if (pg.hasPage) {
      const result = await paginate(prisma.order, { where, include, orderBy }, pg);
      return res.json(result);
    }
    const orders = await prisma.order.findMany({ where, include, orderBy, take: 1000 });
    res.json(orders);
  } catch (err) { next(err); }
});

router.patch('/orders/:id', validate({ params: S.IdParam, body: S.OrderUpdate }), async (req, res, next) => {
  try {
    const data = pick(req.body, ['status', 'paymentStatus']);
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data,
      include: { items: true },
    });

    // Enviar email de actualización si el estado del pedido cambió y hay email
    const orderEmail = order.shipEmail;
    const NOTIFY_STATUSES = ['processing', 'shipped', 'delivered', 'cancelled'];
    if (data.status && NOTIFY_STATUSES.includes(data.status) && orderEmail) {
      sendOrderStatusUpdate({ order, email: orderEmail, newStatus: data.status }).catch(console.error);
    }

    // Proyección al libro mayor: venta de productos cuando el pedido queda pagado.
    // Idempotente por (source order + orderId), así que no duplica con Culqi.
    if (data.paymentStatus === 'paid') {
      const { proyectarMovimiento } = require('../../modules/financial');
      proyectarMovimiento({
        tipo: 'venta',
        monto: Number(order.totalPen),
        descripcion: `Pedido de productos`,
        fecha: new Date(order.createdAt).toISOString().slice(0, 10),
        categoria: 'productos',
        metodoPago: order.paymentMethod || null,
        source: 'order',
        orderId: order.id,
        customerId: order.customerId || null,
      }).catch(() => {});
    }

    res.json(order);
  } catch (err) { next(err); }
});

// ── Staff ─────────────────────────────────────────────────────
const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Horario por defecto del salón (Lun–Sáb 08:00–20:00)
const DEFAULT_SCHEDULES = [1,2,3,4,5,6].map(day => ({
  dayOfWeek: day, startTime: '08:00', endTime: '20:00',
}));

router.get('/staff', async (_req, res, next) => {
  try {
    const staff = await prisma.staff.findMany({
      include: { schedules: { orderBy: { dayOfWeek: 'asc' } }, staffServices: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json(staff);
  } catch (err) { next(err); }
});

// PUT /staff/reorder — reordena las estilistas según el array de ids (índice = orden).
// Definido ANTES de /staff/:id para que no lo capture la ruta param.
router.put('/staff/reorder', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => UUID_RE.test(id)) : [];
    if (ids.length === 0) return res.status(400).json({ error: 'ids debe ser un array de UUIDs' });
    await prisma.$transaction(ids.map((id, i) => prisma.staff.update({ where: { id }, data: { sortOrder: i } })));
    res.json({ ok: true, count: ids.length });
  } catch (err) { next(err); }
});

router.get('/staff/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    const staff = await prisma.staff.findUnique({
      where: { id: req.params.id },
      include: { schedules: { orderBy: { dayOfWeek: 'asc' } }, staffServices: true },
    });
    if (!staff) return res.status(404).json({ error: 'Estilista no encontrada' });
    res.json(staff);
  } catch (err) { next(err); }
});

router.post('/staff', validate({ body: S.StaffCreate }), async (req, res, next) => {
  try {
    const { schedules, serviceIds } = req.body;
    const data = pick(req.body, ['name', 'role', 'photoUrl', 'bio', 'isActive']);
    if (req.body.certifications !== undefined) data.certifications = sanitizeCertifications(req.body.certifications);
    data.sortOrder = await prisma.staff.count(); // nuevas estilistas van al final

    // Si no se especifican horarios, usar el horario por defecto
    const schedulesToCreate = Array.isArray(schedules) && schedules.length > 0
      ? schedules.map(s => pick(s, ['dayOfWeek', 'startTime', 'endTime']))
      : DEFAULT_SCHEDULES;

    const staff = await prisma.staff.create({
      data: {
        ...data,
        schedules: { create: schedulesToCreate },
        staffServices: Array.isArray(serviceIds) && serviceIds.every(id => UUID_RE.test(id))
          ? { create: serviceIds.map(id => ({ serviceId: id })) }
          : undefined,
      },
      include: { schedules: { orderBy: { dayOfWeek: 'asc' } }, staffServices: true },
    });
    res.status(201).json(staff);
  } catch (err) { next(err); }
});

router.patch('/staff/:id', validate({ params: S.IdParam }), async (req, res, next) => {
  try {
    const data = pick(req.body, ['name', 'role', 'photoUrl', 'bio', 'isActive']);
    if (req.body.certifications !== undefined) data.certifications = sanitizeCertifications(req.body.certifications);
    const staff = await prisma.staff.update({
      where: { id: req.params.id },
      data,
      include: { schedules: { orderBy: { dayOfWeek: 'asc' } } },
    });
    res.json(staff);
  } catch (err) { next(err); }
});

router.delete('/staff/:id', validate({ params: S.IdParam }), async (req, res, next) => {
  try {
    await prisma.staff.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Horarios del staff ────────────────────────────────────────
// Reemplaza todos los horarios de un staff (operación PUT semántica)
router.put('/staff/:id/schedules', validate({ params: S.IdParam, body: S.SchedulesBody }), async (req, res, next) => {
  try {
    const { schedules } = req.body;
    await prisma.$transaction([
      prisma.staffSchedule.deleteMany({ where: { staffId: req.params.id } }),
      prisma.staffSchedule.createMany({
        data: schedules.map(s => ({
          staffId: req.params.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      }),
    ]);
    const updated = await prisma.staffSchedule.findMany({
      where: { staffId: req.params.id },
      orderBy: { dayOfWeek: 'asc' },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// ── Bloqueos de disponibilidad (Unavailability) ───────────────
router.get('/unavailability', async (req, res, next) => {
  try {
    const { staffId, from, to } = req.query;
    const where = {};
    if (staffId) {
      if (staffId === 'all') where.staffId = null;
      else if (UUID_RE.test(staffId)) where.staffId = staffId;
    }
    if (from && DATE_RE.test(from)) {
      where.date = { ...where.date, gte: new Date(from + 'T00:00:00Z') };
    }
    if (to && DATE_RE.test(to)) {
      where.date = { ...where.date, lte: new Date(to + 'T00:00:00Z') };
    }
    const blocks = await prisma.staffUnavailability.findMany({
      where,
      include: { staff: { select: { id: true, name: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    res.json(blocks);
  } catch (err) { next(err); }
});

router.post('/unavailability', validate({ body: S.UnavailabilityCreate }), async (req, res, next) => {
  try {
    const { staffId, date, startTime, endTime, reason } = req.body;
    // date/staffId/startTime/endTime y la regla "ambas o ninguna" validadas por Zod.
    const block = await prisma.staffUnavailability.create({
      data: {
        staffId: staffId || null,
        date: new Date(date + 'T00:00:00Z'),
        startTime: startTime || null,
        endTime: endTime || null,
        reason: reason ? String(reason).slice(0, 200) : null,
      },
      include: { staff: { select: { id: true, name: true } } },
    });
    res.status(201).json(block);
  } catch (err) { next(err); }
});

router.delete('/unavailability/:id', validate({ params: S.IdParam }), async (req, res, next) => {
  try {
    await prisma.staffUnavailability.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Galería ───────────────────────────────────────────────────
router.get('/gallery', async (_req, res, next) => {
  try {
    const photos = await prisma.gallery.findMany({ orderBy: { sortOrder: 'asc' }, take: 1000 });
    res.json(photos);
  } catch (err) { next(err); }
});

// Hosts permitidos para URLs ya subidas (evita SSRF / URLs externas).
function isCloudinaryUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && (url.hostname === 'res.cloudinary.com' || url.hostname.endsWith('.cloudinary.com'));
  } catch { return false; }
}

router.post('/gallery/upload', validate({ body: S.GalleryUpload }), async (req, res, next) => {
  try {
    const { file, imageUrl, thumbnailUrl, category, caption } = req.body;

    let mediaUrl;
    let posterUrl = null;
    if (imageUrl) {
      // Flujo nuevo: el medio (imagen o video) ya se subió a Cloudinary desde el
      // cliente vía /admin/upload o /admin/upload-video. Solo se persiste el registro.
      if (!isCloudinaryUrl(imageUrl)) return next(BadRequest('URL de medio no permitida'));
      if (thumbnailUrl && !isCloudinaryUrl(thumbnailUrl)) return next(BadRequest('URL de miniatura no permitida'));
      mediaUrl = imageUrl;
      posterUrl = thumbnailUrl || null;
    } else {
      // Compat: base64 → se sube como imagen.
      const uploaded = await uploadImage(file, 'galeria');
      mediaUrl = uploaded.url;
    }

    const photo = await prisma.gallery.create({
      data: {
        imageUrl: mediaUrl,
        thumbnailUrl: posterUrl,
        category: category || null,
        caption: caption ? String(caption).slice(0, 200) : null,
      },
    });
    res.status(201).json(photo);
  } catch (err) { next(err); }
});

router.patch('/gallery/:id', validate({ params: S.IdParam, body: S.GalleryUpdate }), async (req, res, next) => {
  try {
    const data = pick(req.body, ['category', 'caption', 'sortOrder', 'isPublished']);
    if (data.sortOrder != null) data.sortOrder = Number(data.sortOrder);
    const photo = await prisma.gallery.update({ where: { id: req.params.id }, data });
    res.json(photo);
  } catch (err) { next(err); }
});

router.delete('/gallery/:id', validate({ params: S.IdParam }), async (req, res, next) => {
  try {
    await prisma.gallery.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Blog ──────────────────────────────────────────────────────
router.get('/blog', async (_req, res, next) => {
  try {
    const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
    res.json(posts);
  } catch (err) { next(err); }
});

router.post('/blog', validate({ body: S.BlogCreate }), async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'title', 'slug', 'excerpt', 'content', 'coverUrl', 'isPublished', 'publishedAt',
    ]);
    const post = await prisma.blogPost.create({ data });
    res.status(201).json(post);
  } catch (err) { next(err); }
});

router.patch('/blog/:id', validate({ params: S.IdParam }), async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'title', 'slug', 'excerpt', 'content', 'coverUrl', 'isPublished', 'publishedAt',
    ]);
    const post = await prisma.blogPost.update({ where: { id: req.params.id }, data });
    res.json(post);
  } catch (err) { next(err); }
});

router.delete('/blog/:id', validate({ params: S.IdParam }), async (req, res, next) => {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Promociones ───────────────────────────────────────────────
router.get('/promotions', async (_req, res, next) => {
  try {
    const promos = await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(promos);
  } catch (err) { next(err); }
});

router.post('/promotions', validate({ body: S.PromotionCreate }), async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'code', 'type', 'value', 'minOrderPen',
      'applicableTo', 'usageLimit', 'expiresAt', 'isActive',
    ]);
    // code/type/value y el rango percent 1–100 validados por Zod (S.PromotionCreate).
    data.value = Number(data.value);
    if (data.minOrderPen != null) data.minOrderPen = Number(data.minOrderPen);
    if (data.usageLimit != null) data.usageLimit = Number(data.usageLimit);
    const promo = await prisma.promotion.create({ data });
    res.status(201).json(promo);
  } catch (err) { next(err); }
});

router.patch('/promotions/:id', validate({ params: S.IdParam, body: S.PromotionUpdate }), async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'code', 'type', 'value', 'minOrderPen',
      'applicableTo', 'usageLimit', 'expiresAt', 'isActive',
    ]);
    if (data.value != null) data.value = Number(data.value);
    if (data.minOrderPen != null) data.minOrderPen = Number(data.minOrderPen);
    const promo = await prisma.promotion.update({ where: { id: req.params.id }, data });
    res.json(promo);
  } catch (err) { next(err); }
});

// ── Clientes ──────────────────────────────────────────────────
router.get('/customers', async (req, res, next) => {
  try {
    const { search } = req.query;
    const where = search
      ? {
          OR: [
            { name:  { contains: String(search), mode: 'insensitive' } },
            { email: { contains: String(search), mode: 'insensitive' } },
            { phone: { contains: String(search), mode: 'insensitive' } },
          ],
        }
      : {};
    const include = { _count: { select: { appointments: true, orders: true } } };
    const orderBy = { createdAt: 'desc' };
    const pg = parsePagination(req.query);
    if (pg.hasPage) {
      const result = await paginate(prisma.customer, { where, include, orderBy }, pg);
      return res.json(result);
    }
    const customers = await prisma.customer.findMany({
      where,
      orderBy,
      take: search ? 20 : 500,
      include,
    });
    res.json(customers);
  } catch (err) { next(err); }
});

router.post('/customers', validate({ body: S.CustomerCreate }), async (req, res, next) => {
  try {
    const { name, phone, email } = req.body;
    const { randomUUID } = require('crypto');
    const customer = await prisma.customer.create({
      data: {
        id:    randomUUID(),
        name:  String(name).trim().slice(0, 100),
        phone: phone  ? String(phone).replace(/\D/g, '').slice(0, 20)  : null,
        email: email  ? String(email).slice(0, 100) : null,
      },
      include: { _count: { select: { appointments: true, orders: true } } },
    });
    res.status(201).json(customer);
  } catch (err) { next(err); }
});

router.patch('/customers/:id', validate({ params: S.IdParam }), async (req, res, next) => {
  try {
    const data = {};
    if (req.body.name     !== undefined) data.name     = String(req.body.name).slice(0, 100);
    if (req.body.phone    !== undefined) data.phone    = req.body.phone    ? String(req.body.phone).replace(/\D/g, '').slice(0, 20)  : null;
    if (req.body.email    !== undefined) data.email    = req.body.email    ? String(req.body.email).slice(0, 100) : null;
    if (req.body.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
    if (!Object.keys(data).length) return res.json({ ok: true });
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data,
      include: { _count: { select: { appointments: true, orders: true } } },
    });
    res.json(customer);
  } catch (err) { next(err); }
});

router.delete('/customers/:id', validate({ params: S.IdParam }), async (req, res, next) => {
  try {
    const count = await prisma.appointment.count({ where: { customerId: req.params.id } });
    if (count > 0) {
      return res.status(409).json({ error: `No se puede eliminar: el cliente tiene ${count} cita(s). Desactívalo en su lugar.` });
    }
    await prisma.customer.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Configuración ─────────────────────────────────────────────
router.get('/settings', async (_req, res, next) => {
  try {
    const setting = await prisma.setting.findFirst();
    res.json(setting || {});
  } catch (err) { next(err); }
});

router.patch('/settings', async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'salonName', 'phone', 'whatsapp', 'email', 'address', 'district', 'city',
      'lat', 'lng', 'hoursWeekday', 'hoursSaturday', 'hoursSunday',
      'facebookUrl', 'instagramUrl', 'tiktokUrl',
      'bookingNoticeHours', 'cancellationHours',
      'atHomeEnabled', 'atHomeBasePen', 'atHomeBaseKm', 'atHomeRatePen',
      'storeEnabled',
      'bookingTimerSeconds',
      'bookingMinHour', 'packageMinHour',
      'logoUrl', 'logoDarkUrl', 'logoIconUrl', 'teamPhotoUrl', 'salonPhotoUrl',
      'homeSlides',
      // Datos de pago / adelanto
      'depositExpiryHours',
      'yapeNumber', 'yapeName', 'plinNumber',
      'bankName', 'bankAccount', 'bankCci', 'bankAccountHolder',
    ]);
    if (data.homeSlides !== undefined && !Array.isArray(data.homeSlides)) {
      return res.status(400).json({ error: 'homeSlides debe ser un array' });
    }
    const TIME_HHMM = /^\d{2}:\d{2}$/;
    if (data.bookingMinHour && !TIME_HHMM.test(data.bookingMinHour)) {
      return res.status(400).json({ error: 'bookingMinHour debe tener formato HH:MM' });
    }
    if (data.packageMinHour === '' || data.packageMinHour === null) data.packageMinHour = null;
    else if (data.packageMinHour && !TIME_HHMM.test(data.packageMinHour)) {
      return res.status(400).json({ error: 'packageMinHour debe tener formato HH:MM' });
    }
    if (data.lat != null) data.lat = Number(data.lat);
    if (data.lng != null) data.lng = Number(data.lng);
    if (data.bookingNoticeHours != null) data.bookingNoticeHours = Number(data.bookingNoticeHours);
    if (data.cancellationHours != null) data.cancellationHours = Number(data.cancellationHours);
    if (data.atHomeEnabled != null) data.atHomeEnabled = Boolean(data.atHomeEnabled);
    if (data.atHomeBasePen != null) data.atHomeBasePen = Number(data.atHomeBasePen);
    if (data.atHomeBaseKm != null) data.atHomeBaseKm = Number(data.atHomeBaseKm);
    if (data.atHomeRatePen != null) data.atHomeRatePen = Number(data.atHomeRatePen);
    if (data.bookingTimerSeconds != null) data.bookingTimerSeconds = Math.max(60, Number(data.bookingTimerSeconds));
    if (data.depositExpiryHours != null) data.depositExpiryHours = Math.max(1, Number(data.depositExpiryHours));

    const existing = await prisma.setting.findFirst();
    const setting = existing
      ? await prisma.setting.update({ where: { id: existing.id }, data })
      : await prisma.setting.create({ data });
    res.json(setting);
  } catch (err) { next(err); }
});

// ── Upload de imágenes ────────────────────────────────────────
router.post('/upload', async (req, res, next) => {
  try {
    const { file, folder } = req.body;
    if (!file) return res.status(400).json({ error: 'Imagen requerida' });

    const ALLOWED_FOLDERS = [
      'galeria', 'productos', 'servicios', 'staff', 'blog', 'general', 'logos',
      // Subcarpetas semánticas para tener orden en Cloudinary
      'eventos', 'paquetes', 'catalogos', 'addons', 'carrusel',
    ];
    const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : 'general';

    const result = await uploadImage(file, safeFolder);
    res.json(result);
  } catch (err) { next(err); }
});

// ── Upload de videos (carrusel del home, etc.) ────────────────
router.post('/upload-video', async (req, res, next) => {
  try {
    const { file, folder } = req.body;
    if (!file) return res.status(400).json({ error: 'Video requerido' });
    const ALLOWED_FOLDERS = ['carrusel', 'general'];
    const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : 'general';
    const result = await uploadVideo(file, safeFolder);
    res.json(result);
  } catch (err) { next(err); }
});

// ── Contabilidad ──────────────────────────────────────────
router.use('/accounting', accountingRouter);

// ── Event Types, Paquetes, Add-ons, Beneficios ────────────
router.use(eventTypesAdminRouter);

// ── Gestión de usuarios admin (super_admin only) ──────────────
router.get('/users', isSuperAdmin, async (_req, res, next) => {
  try {
    const users = await prisma.admin.findMany({
      select: { id: true, name: true, email: true, role: true, staffId: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (err) { next(err); }
});

router.post('/users', isSuperAdmin, async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs');
    const { randomUUID } = require('crypto');
    const { name, email, password, role, staffId } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email y password son requeridos' });
    }
    const VALID_ROLES = ['super_admin', 'admin', 'estilista'];
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    if (role === 'estilista' && staffId && !UUID_RE.test(staffId)) {
      return res.status(400).json({ error: 'staffId inválido' });
    }
    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Ya existe un usuario con ese email' });

    if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
      return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 200 caracteres' });
    }
    const BCRYPT_COST = parseInt(process.env.BCRYPT_COST || (process.env.NODE_ENV === 'production' ? '12' : '10'), 10);
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await prisma.admin.create({
      data: {
        id: randomUUID(),
        name: String(name).slice(0, 100),
        email: String(email).toLowerCase().slice(0, 150),
        passwordHash,
        role: role || 'admin',
        staffId: (role === 'estilista' && staffId) ? staffId : null,
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true, staffId: true, isActive: true, createdAt: true },
    });
    logger.info('admin_user_created', { actor: req.admin.id, target: user.id, role: user.role });
    res.status(201).json(user);
  } catch (err) { next(err); }
});

router.patch('/users/:id', isSuperAdmin, async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs');
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    const { name, email, password, role, staffId, isActive } = req.body;
    const VALID_ROLES = ['super_admin', 'admin', 'estilista'];
    if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Rol inválido' });

    const data = {};
    let bumpTokens = false;
    if (name)     data.name = String(name).slice(0, 100);
    if (email)    data.email = String(email).toLowerCase().slice(0, 150);
    if (role)     { data.role = role; bumpTokens = true; }
    if (staffId !== undefined) data.staffId = staffId || null;
    if (isActive !== undefined) {
      data.isActive = Boolean(isActive);
      if (!data.isActive) bumpTokens = true;
    }
    if (password) {
      if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
        return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 200 caracteres' });
      }
      const BCRYPT_COST = parseInt(process.env.BCRYPT_COST || (process.env.NODE_ENV === 'production' ? '12' : '10'), 10);
      data.passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      data.passwordChangedAt = new Date();
      bumpTokens = true;
    }
    if (bumpTokens) {
      // Invalida la sesión actual del admin objetivo
      data.tokensValidFrom = new Date();
    }
    // Anti-lockout: super_admin no puede auto-degradarse ni desactivarse
    if (req.params.id === req.admin.id) {
      if (data.role && data.role !== 'super_admin') {
        return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
      }
      if (data.isActive === false) {
        return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });
      }
    }

    const user = await prisma.admin.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, role: true, staffId: true, isActive: true, createdAt: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

router.delete('/users/:id', isSuperAdmin, async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    if (req.params.id === req.admin.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    await prisma.admin.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
