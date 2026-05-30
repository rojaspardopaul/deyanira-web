const { Router } = require('express');
const prisma = require('../../lib/prisma');
const cache = require('../../lib/cache');
const { publicCache } = require('../../middleware/httpCache');
const { calculatePrice, validateRequired } = require('../../lib/pricing/calculate');

const router = Router();
const SERVICES_TTL = 5 * 60 * 1000;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Include estándar para retornar un servicio con todo lo necesario para el cliente
const PUBLIC_SERVICE_INCLUDE = {
  category: true,
  staffServices: { include: { staff: true } },
  modifierGroups: {
    include: { options: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  },
  conditionalRules: {
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  },
};

// GET /api/services — lista de servicios activos
// Cacheado por variante de query (categoría + withModifiers). Se invalida desde
// el panel admin al crear/editar/borrar servicios (cache.invalidate('services')).
router.get('/', publicCache(60), async (req, res, next) => {
  try {
    const { category, withModifiers } = req.query;
    const key = `services:list:${category || 'all'}:${withModifiers ? 'mods' : 'base'}`;
    const services = await cache.wrap(key, SERVICES_TTL, () =>
      prisma.service.findMany({
        where: {
          isActive: true,
          ...(category && { category: { slug: category } }),
        },
        include: withModifiers
          ? PUBLIC_SERVICE_INCLUDE
          : { category: true },
        orderBy: { name: 'asc' },
      })
    );
    res.json(services);
  } catch (err) {
    next(err);
  }
});

// GET /api/services/categories — categorías de servicios
router.get('/categories', publicCache(60), async (_req, res, next) => {
  try {
    const categories = await cache.wrap('services:categories', SERVICES_TTL, () =>
      prisma.serviceCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      })
    );
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// GET /api/services/popular — servicios más reservados (ordenados por nº de citas)
// Cuenta citas no canceladas por servicio. Cae con gracia a "todos los activos"
// cuando aún no hay historial de reservas (ej. salón recién lanzado).
router.get('/popular', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 12);

    // Conteo de reservas reales por servicio (excluye canceladas)
    const grouped = await prisma.appointment.groupBy({
      by: ['serviceId'],
      where: { status: { not: 'cancelled' } },
      _count: { serviceId: true },
    });
    const countMap = new Map(grouped.map((g) => [g.serviceId, g._count.serviceId]));

    const services = await prisma.service.findMany({
      where: { isActive: true },
      include: { category: true },
    });

    const ranked = services
      .map((s) => ({ ...s, bookingCount: countMap.get(s.id) || 0 }))
      .sort((a, b) =>
        // 1º por reservas, 2º servicios con oferta primero, 3º precio asc
        b.bookingCount - a.bookingCount ||
        Number(b.comparePricePen || 0) - Number(a.comparePricePen || 0) ||
        Number(a.pricePen) - Number(b.pricePen),
      )
      .slice(0, limit);

    res.json(ranked);
  } catch (err) {
    next(err);
  }
});

// GET /api/services/:slug — detalle de servicio (incluye modificadores)
router.get('/:slug', async (req, res, next) => {
  try {
    if (!SLUG_RE.test(req.params.slug)) {
      return res.status(400).json({ error: 'Slug inválido' });
    }
    const service = await prisma.service.findUnique({
      where: { slug: req.params.slug },
      include: PUBLIC_SERVICE_INCLUDE,
    });
    if (!service || !service.isActive) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    res.json(service);
  } catch (err) {
    next(err);
  }
});

// POST /api/services/:id/calculate-price — calcula precio en tiempo real
// Body: { selections: { [groupId]: { optionIds?, value?, quantity? } } }
router.post('/:id/calculate-price', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const service = await prisma.service.findUnique({
      where: { id: req.params.id },
      include: {
        modifierGroups: {
          include: { options: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
        conditionalRules: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!service || !service.isActive) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    const selections = req.body?.selections || {};
    const result = calculatePrice(service, selections);
    const validationErrors = validateRequired(service, selections);
    res.json({ ...result, validationErrors });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
