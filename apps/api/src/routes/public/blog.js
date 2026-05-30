const { Router } = require('express');
const prisma = require('../../lib/prisma');

const router = Router();
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/i;

router.get('/', async (_req, res, next) => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { isPublished: true },
      select: { id: true, title: true, slug: true, excerpt: true, coverUrl: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 100,
    });
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    if (!SLUG_RE.test(req.params.slug)) {
      return res.status(400).json({ error: 'Slug inválido' });
    }
    const post = await prisma.blogPost.findUnique({ where: { slug: req.params.slug } });
    if (!post || !post.isPublished) return res.status(404).json({ error: 'No encontrado' });
    res.json(post);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
