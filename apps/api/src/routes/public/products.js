const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = Router();

// GET /api/products — catálogo con filtros
router.get('/', async (req, res, next) => {
  try {
    const { category, brand, search } = req.query;
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(category && { category: { slug: category } }),
        ...(brand && { brand }),
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/categories
router.get('/categories', async (_req, res, next) => {
  try {
    const categories = await prisma.productCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      include: { category: true },
    });
    if (!product || !product.isActive) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
