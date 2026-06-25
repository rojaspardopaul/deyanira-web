const { Router } = require('express');
const prisma = require('../../lib/prisma');

const router = Router();
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/i;

// GET /api/catalogs — lista de catálogos activos
router.get('/', async (_req, res, next) => {
  try {
    const catalogs = await prisma.catalog.findMany({
      where: { isActive: true },
      include: { _count: { select: { items: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(catalogs.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      heroImageUrl: c.heroImageUrl,
      itemsCount: c._count?.items || 0,
    })));
  } catch (err) { next(err); }
});

// GET /api/catalogs/:slug — detalle con items agrupados
router.get('/:slug', async (req, res, next) => {
  try {
    if (!SLUG_RE.test(req.params.slug)) return res.status(400).json({ error: 'Slug inválido' });
    const cat = await prisma.catalog.findUnique({
      where: { slug: req.params.slug },
      include: {
        // Orden global por sortOrder (lo define el admin). Los grupos se arman por
        // orden de aparición, así respetan el orden del admin (no alfabético).
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!cat || !cat.isActive) return res.status(404).json({ error: 'Catálogo no encontrado' });

    // Agrupar items por groupLabel
    const groups = {};
    for (const it of cat.items) {
      const g = it.groupLabel || 'General';
      if (!groups[g]) groups[g] = [];
      groups[g].push({
        id: it.id,
        title: it.title,
        description: it.description,
        imageUrl: it.imageUrl,
        extraPricePen: it.extraPricePen != null ? Number(it.extraPricePen) : null,
        extraMinutes: it.extraMinutes,
      });
    }

    res.json({
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      description: cat.description,
      heroImageUrl: cat.heroImageUrl,
      groups: Object.entries(groups).map(([label, items]) => ({ label, items })),
    });
  } catch (err) { next(err); }
});

module.exports = router;
