const { Router } = require('express');
const prisma = require('../../lib/prisma');

const router = Router();
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/i;
// Brand y search: alfanuméricos + espacios + acentos básicos, sin caracteres de control
const SAFE_STR_RE = /^[\p{L}\p{N}\s\-_.&]{1,80}$/u;

// GET /api/products — catálogo con filtros
router.get('/', async (req, res, next) => {
  try {
    const category = typeof req.query.category === 'string' && SLUG_RE.test(req.query.category) ? req.query.category : null;
    const brand    = typeof req.query.brand    === 'string' && SAFE_STR_RE.test(req.query.brand) ? req.query.brand : null;
    const search   = typeof req.query.search   === 'string' && SAFE_STR_RE.test(req.query.search) ? req.query.search.slice(0, 80) : null;

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(category ? { category: { slug: category } } : {}),
        ...(brand ? { brand } : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
      take: 200,
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
    if (!SLUG_RE.test(req.params.slug)) {
      return res.status(400).json({ error: 'Slug inválido' });
    }
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
