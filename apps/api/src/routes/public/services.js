const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = Router();

// GET /api/services — lista de servicios activos
router.get('/', async (req, res, next) => {
  try {
    const { category } = req.query;
    const services = await prisma.service.findMany({
      where: {
        isActive: true,
        ...(category && { category: { slug: category } }),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    res.json(services);
  } catch (err) {
    next(err);
  }
});

// GET /api/services/categories — categorías de servicios
router.get('/categories', async (_req, res, next) => {
  try {
    const categories = await prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// GET /api/services/:slug — detalle de servicio
router.get('/:slug', async (req, res, next) => {
  try {
    const service = await prisma.service.findUnique({
      where: { slug: req.params.slug },
      include: {
        category: true,
        staffServices: { include: { staff: true } },
      },
    });
    if (!service || !service.isActive) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    res.json(service);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
