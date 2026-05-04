const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { category } = req.query;
    const photos = await prisma.gallery.findMany({
      where: {
        isPublished: true,
        ...(category && { category }),
      },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(photos);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
