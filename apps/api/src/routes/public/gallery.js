const { Router } = require('express');
const prisma = require('../../lib/prisma');

const router = Router();
const VALID_CATEGORIES = new Set(['maquillaje', 'cabello', 'unas', 'cejas', 'general']);

router.get('/', async (req, res, next) => {
  try {
    const category = typeof req.query.category === 'string' && VALID_CATEGORIES.has(req.query.category)
      ? req.query.category
      : null;
    const photos = await prisma.gallery.findMany({
      where: {
        isPublished: true,
        ...(category ? { category } : {}),
      },
      orderBy: { sortOrder: 'asc' },
      take: 200,
    });
    res.json(photos);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
