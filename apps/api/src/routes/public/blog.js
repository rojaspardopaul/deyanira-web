const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { isPublished: true },
      select: { id: true, title: true, slug: true, excerpt: true, coverUrl: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
    });
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const post = await prisma.blogPost.findUnique({ where: { slug: req.params.slug } });
    if (!post || !post.isPublished) return res.status(404).json({ error: 'No encontrado' });
    res.json(post);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
