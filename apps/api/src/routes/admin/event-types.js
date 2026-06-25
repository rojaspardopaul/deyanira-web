// CRUD admin para EventType, ServicePackage, PackageItem, ServiceAddon, EventBenefit
// Montado bajo /api/admin (ya pasa por isAdmin + auditMiddleware en admin/index.js)

const { Router } = require('express');
const prisma = require('../../lib/prisma');

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function pick(obj, keys) {
  const result = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) result[key] = obj[key];
  }
  return result;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ── EVENT TYPES ─────────────────────────────────────────────────

router.get('/event-types', async (_req, res, next) => {
  try {
    const list = await prisma.eventType.findMany({
      include: {
        _count: { select: { packages: true, benefits: true, addons: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(list);
  } catch (err) { next(err); }
});

router.get('/event-types/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    const et = await prisma.eventType.findUnique({
      where: { id: req.params.id },
      include: {
        packages: {
          orderBy: { sortOrder: 'asc' },
          include: { items: { orderBy: { sortOrder: 'asc' }, include: { service: { select: { id: true, name: true } } } } },
        },
        benefits: { orderBy: { sortOrder: 'asc' } },
        addons: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!et) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(et);
  } catch (err) { next(err); }
});

router.post('/event-types', async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'name', 'slug', 'tagline', 'shortDesc', 'heroImageUrl',
      'presentationMd', 'policiesMd', 'accentColor', 'icon',
      'sortOrder', 'highlight', 'isActive',
    ]);
    if (!data.name) return res.status(400).json({ error: 'name es requerido' });
    data.slug = data.slug ? slugify(data.slug) : slugify(data.name);
    if (data.accentColor && !HEX_RE.test(data.accentColor)) {
      return res.status(400).json({ error: 'accentColor debe ser un HEX (#RRGGBB)' });
    }
    if (data.sortOrder != null) data.sortOrder = Number(data.sortOrder);

    const et = await prisma.eventType.create({ data });
    res.status(201).json(et);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ya existe un evento con ese slug' });
    next(err);
  }
});

router.patch('/event-types/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    const data = pick(req.body, [
      'name', 'slug', 'tagline', 'shortDesc', 'heroImageUrl',
      'presentationMd', 'policiesMd', 'accentColor', 'icon',
      'sortOrder', 'highlight', 'isActive',
    ]);
    if (data.slug) data.slug = slugify(data.slug);
    if (data.accentColor && !HEX_RE.test(data.accentColor)) {
      return res.status(400).json({ error: 'accentColor debe ser un HEX (#RRGGBB)' });
    }
    if (data.sortOrder != null) data.sortOrder = Number(data.sortOrder);
    const et = await prisma.eventType.update({ where: { id: req.params.id }, data });
    res.json(et);
  } catch (err) { next(err); }
});

router.delete('/event-types/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    await prisma.eventType.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2003') return res.status(409).json({ error: 'No se puede eliminar: hay citas vinculadas a paquetes de este evento' });
    next(err);
  }
});

// ── PACKAGES ────────────────────────────────────────────────────

router.get('/packages', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.eventTypeId && UUID_RE.test(String(req.query.eventTypeId))) {
      where.eventTypeId = String(req.query.eventTypeId);
    }
    const packages = await prisma.servicePackage.findMany({
      where,
      include: {
        eventType: { select: { id: true, name: true, slug: true } },
        items: { orderBy: { sortOrder: 'asc' }, include: { service: { select: { id: true, name: true } } } },
        _count: { select: { appointments: true } },
      },
      orderBy: [{ eventTypeId: 'asc' }, { sortOrder: 'asc' }],
    });
    res.json(packages);
  } catch (err) { next(err); }
});

router.post('/packages', async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'eventTypeId', 'name', 'slug', 'subtitle', 'description', 'imageUrl',
      'pricePen', 'comparePricePen', 'groupSize', 'groupLabel', 'hasTrial', 'highlighted',
      'sortOrder', 'isActive',
      'trialAddonServiceId', 'trialAddonPricePen',
      'requiresDeposit', 'depositPercent',
    ]);
    if (data.requiresDeposit != null) data.requiresDeposit = Boolean(data.requiresDeposit);
    if (data.depositPercent != null && data.depositPercent !== '') data.depositPercent = Math.min(100, Math.max(0, Math.round(Number(data.depositPercent))));
    else delete data.depositPercent;
    if (data.trialAddonServiceId === '' || data.trialAddonServiceId === null) data.trialAddonServiceId = null;
    if (data.trialAddonPricePen === '' || data.trialAddonPricePen == null) data.trialAddonPricePen = null;
    else data.trialAddonPricePen = Number(data.trialAddonPricePen);
    if (!data.eventTypeId || !UUID_RE.test(data.eventTypeId)) {
      return res.status(400).json({ error: 'eventTypeId es requerido' });
    }
    if (!data.name) return res.status(400).json({ error: 'name es requerido' });
    if (data.pricePen == null) return res.status(400).json({ error: 'pricePen es requerido' });
    data.slug = data.slug ? slugify(data.slug) : slugify(data.name);
    data.pricePen = Number(data.pricePen);
    if (isNaN(data.pricePen) || data.pricePen < 0) return res.status(400).json({ error: 'pricePen inválido' });
    if (data.comparePricePen === '' || data.comparePricePen == null) data.comparePricePen = null;
    else data.comparePricePen = Number(data.comparePricePen);
    if (data.groupSize != null && data.groupSize !== '') data.groupSize = Math.max(1, Number(data.groupSize));
    else data.groupSize = null;
    if (data.sortOrder != null) data.sortOrder = Number(data.sortOrder);

    const items = Array.isArray(req.body.items) ? req.body.items : [];

    const pkg = await prisma.servicePackage.create({
      data: {
        ...data,
        items: {
          create: items.map((it, idx) => ({
            label: String(it.label || '').slice(0, 200),
            serviceId: it.serviceId && UUID_RE.test(it.serviceId) ? it.serviceId : null,
            quantity: Math.max(1, Number(it.quantity) || 1),
            sortOrder: idx,
          })),
        },
      },
      include: {
        eventType: { select: { id: true, name: true, slug: true } },
        items: { orderBy: { sortOrder: 'asc' }, include: { service: { select: { id: true, name: true } } } },
      },
    });
    res.status(201).json(pkg);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ya existe un paquete con ese slug en este evento' });
    next(err);
  }
});

router.patch('/packages/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    const data = pick(req.body, [
      'name', 'slug', 'subtitle', 'description', 'imageUrl',
      'pricePen', 'comparePricePen', 'groupSize', 'groupLabel', 'hasTrial', 'highlighted',
      'sortOrder', 'isActive',
      'trialAddonServiceId', 'trialAddonPricePen',
      'requiresDeposit', 'depositPercent',
    ]);
    if (data.requiresDeposit != null) data.requiresDeposit = Boolean(data.requiresDeposit);
    if (data.depositPercent != null && data.depositPercent !== '') data.depositPercent = Math.min(100, Math.max(0, Math.round(Number(data.depositPercent))));
    else if (data.depositPercent === '' || data.depositPercent === null) delete data.depositPercent;
    if (data.trialAddonServiceId === '' || data.trialAddonServiceId === null) data.trialAddonServiceId = null;
    if (data.trialAddonPricePen === '' || data.trialAddonPricePen === null) data.trialAddonPricePen = null;
    else if (data.trialAddonPricePen != null) data.trialAddonPricePen = Number(data.trialAddonPricePen);
    if (data.slug) data.slug = slugify(data.slug);
    if (data.pricePen != null) data.pricePen = Number(data.pricePen);
    if (data.comparePricePen === '' || data.comparePricePen === null) data.comparePricePen = null;
    else if (data.comparePricePen != null) data.comparePricePen = Number(data.comparePricePen);
    if (data.groupSize === '' || data.groupSize === null) data.groupSize = null;
    else if (data.groupSize != null) data.groupSize = Math.max(1, Number(data.groupSize));
    if (data.sortOrder != null) data.sortOrder = Number(data.sortOrder);

    const items = Array.isArray(req.body.items) ? req.body.items : null;

    const pkg = await prisma.$transaction(async (tx) => {
      const updated = await tx.servicePackage.update({ where: { id: req.params.id }, data });
      if (items) {
        await tx.packageItem.deleteMany({ where: { packageId: req.params.id } });
        if (items.length > 0) {
          await tx.packageItem.createMany({
            data: items.map((it, idx) => ({
              packageId: req.params.id,
              label: String(it.label || '').slice(0, 200),
              serviceId: it.serviceId && UUID_RE.test(it.serviceId) ? it.serviceId : null,
              quantity: Math.max(1, Number(it.quantity) || 1),
              sortOrder: idx,
            })),
          });
        }
      }
      return tx.servicePackage.findUnique({
        where: { id: updated.id },
        include: {
          eventType: { select: { id: true, name: true, slug: true } },
          items: { orderBy: { sortOrder: 'asc' }, include: { service: { select: { id: true, name: true } } } },
        },
      });
    });

    res.json(pkg);
  } catch (err) { next(err); }
});

router.delete('/packages/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    await prisma.servicePackage.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2003') return res.status(409).json({ error: 'No se puede eliminar: hay citas vinculadas a este paquete' });
    next(err);
  }
});

// ── ADD-ONS ─────────────────────────────────────────────────────

router.get('/addons', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.eventTypeId === 'global') where.eventTypeId = null;
    else if (req.query.eventTypeId && UUID_RE.test(String(req.query.eventTypeId))) {
      where.eventTypeId = String(req.query.eventTypeId);
    }
    const addons = await prisma.serviceAddon.findMany({
      where,
      include: { eventType: { select: { id: true, name: true } } },
      orderBy: [{ eventTypeId: 'asc' }, { sortOrder: 'asc' }],
    });
    res.json(addons);
  } catch (err) { next(err); }
});

router.post('/addons', async (req, res, next) => {
  try {
    const data = pick(req.body, ['eventTypeId', 'name', 'description', 'pricePen', 'icon', 'sortOrder', 'isActive']);
    if (!data.name) return res.status(400).json({ error: 'name es requerido' });
    if (data.pricePen == null) return res.status(400).json({ error: 'pricePen es requerido' });
    if (data.eventTypeId && !UUID_RE.test(data.eventTypeId)) {
      return res.status(400).json({ error: 'eventTypeId inválido' });
    }
    if (!data.eventTypeId) data.eventTypeId = null;
    data.pricePen = Number(data.pricePen);
    if (data.sortOrder != null) data.sortOrder = Number(data.sortOrder);
    const addon = await prisma.serviceAddon.create({ data });
    res.status(201).json(addon);
  } catch (err) { next(err); }
});

router.patch('/addons/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    const data = pick(req.body, ['eventTypeId', 'name', 'description', 'pricePen', 'icon', 'sortOrder', 'isActive']);
    if (data.eventTypeId === '' || data.eventTypeId === null) data.eventTypeId = null;
    if (data.pricePen != null) data.pricePen = Number(data.pricePen);
    if (data.sortOrder != null) data.sortOrder = Number(data.sortOrder);
    const addon = await prisma.serviceAddon.update({ where: { id: req.params.id }, data });
    res.json(addon);
  } catch (err) { next(err); }
});

router.delete('/addons/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    await prisma.serviceAddon.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── BENEFITS ────────────────────────────────────────────────────

router.get('/benefits', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.eventTypeId && UUID_RE.test(String(req.query.eventTypeId))) {
      where.eventTypeId = String(req.query.eventTypeId);
    }
    const benefits = await prisma.eventBenefit.findMany({
      where,
      orderBy: [{ eventTypeId: 'asc' }, { sortOrder: 'asc' }],
    });
    res.json(benefits);
  } catch (err) { next(err); }
});

router.post('/benefits', async (req, res, next) => {
  try {
    const data = pick(req.body, ['eventTypeId', 'title', 'description', 'icon', 'sortOrder']);
    if (!data.eventTypeId || !UUID_RE.test(data.eventTypeId)) {
      return res.status(400).json({ error: 'eventTypeId es requerido' });
    }
    if (!data.title) return res.status(400).json({ error: 'title es requerido' });
    if (data.sortOrder != null) data.sortOrder = Number(data.sortOrder);
    const benefit = await prisma.eventBenefit.create({ data });
    res.status(201).json(benefit);
  } catch (err) { next(err); }
});

router.patch('/benefits/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    const data = pick(req.body, ['title', 'description', 'icon', 'sortOrder']);
    if (data.sortOrder != null) data.sortOrder = Number(data.sortOrder);
    const benefit = await prisma.eventBenefit.update({ where: { id: req.params.id }, data });
    res.json(benefit);
  } catch (err) { next(err); }
});

router.delete('/benefits/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    await prisma.eventBenefit.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── CATALOGS (peinados, cortes, colores…) ──────────────────────

router.get('/catalogs', async (_req, res, next) => {
  try {
    const list = await prisma.catalog.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json(list);
  } catch (err) { next(err); }
});

router.get('/catalogs/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    const cat = await prisma.catalog.findUnique({
      where: { id: req.params.id },
      // Orden global por sortOrder (definido por el admin); el frontend agrupa por
      // groupLabel respetando el orden de aparición → no alfabético.
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!cat) return res.status(404).json({ error: 'Catálogo no encontrado' });
    res.json(cat);
  } catch (err) { next(err); }
});

router.post('/catalogs', async (req, res, next) => {
  try {
    const data = pick(req.body, ['name', 'slug', 'description', 'heroImageUrl', 'sortOrder', 'isActive']);
    if (!data.name) return res.status(400).json({ error: 'name es requerido' });
    data.slug = data.slug ? slugify(data.slug) : slugify(data.name);
    if (data.sortOrder != null) data.sortOrder = Number(data.sortOrder);
    const cat = await prisma.catalog.create({ data });
    res.status(201).json(cat);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ya existe un catálogo con ese slug' });
    next(err);
  }
});

router.patch('/catalogs/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    const data = pick(req.body, ['name', 'slug', 'description', 'heroImageUrl', 'sortOrder', 'isActive']);
    if (data.slug) data.slug = slugify(data.slug);
    if (data.sortOrder != null) data.sortOrder = Number(data.sortOrder);
    const cat = await prisma.catalog.update({ where: { id: req.params.id }, data });
    res.json(cat);
  } catch (err) { next(err); }
});

router.delete('/catalogs/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    await prisma.catalog.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── CATALOG ITEMS ─────────────────────────────────────────────

router.post('/catalogs/:catalogId/items', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.catalogId)) return res.status(400).json({ error: 'ID inválido' });
    const data = pick(req.body, ['groupLabel', 'title', 'description', 'imageUrl', 'extraPricePen', 'extraMinutes', 'sortOrder']);
    if (!data.title) return res.status(400).json({ error: 'title es requerido' });
    if (data.extraPricePen === '' || data.extraPricePen == null) data.extraPricePen = null;
    else data.extraPricePen = Number(data.extraPricePen);
    if (data.extraMinutes === '' || data.extraMinutes == null) data.extraMinutes = null;
    else data.extraMinutes = Number(data.extraMinutes);
    if (data.sortOrder != null) data.sortOrder = Number(data.sortOrder);
    const item = await prisma.catalogItem.create({ data: { ...data, catalogId: req.params.catalogId } });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.patch('/catalog-items/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    const data = pick(req.body, ['groupLabel', 'title', 'description', 'imageUrl', 'extraPricePen', 'extraMinutes', 'sortOrder']);
    if (data.extraPricePen === '' || data.extraPricePen === null) data.extraPricePen = null;
    else if (data.extraPricePen != null) data.extraPricePen = Number(data.extraPricePen);
    if (data.extraMinutes === '' || data.extraMinutes === null) data.extraMinutes = null;
    else if (data.extraMinutes != null) data.extraMinutes = Number(data.extraMinutes);
    if (data.sortOrder != null) data.sortOrder = Number(data.sortOrder);
    const item = await prisma.catalogItem.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch (err) { next(err); }
});

router.delete('/catalog-items/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
    await prisma.catalogItem.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
