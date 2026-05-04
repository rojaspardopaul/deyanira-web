const { Router } = require('express');
const { isAdmin } = require('../../middleware/auth');
const { uploadImage } = require('../../lib/cloudinary');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = Router();

// Todas las rutas de admin requieren token de admin
router.use(isAdmin);

// ── Dashboard ─────────────────────────────────────────────
router.get('/dashboard', async (_req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [appointmentsToday, pendingOrders, totalCustomers, recentAppointments] =
      await Promise.all([
        prisma.appointment.count({ where: { date: { gte: today, lt: tomorrow } } }),
        prisma.order.count({ where: { status: 'pending' } }),
        prisma.customer.count(),
        prisma.appointment.findMany({
          where: { date: { gte: today } },
          include: { service: true, staff: true },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
          take: 10,
        }),
      ]);

    res.json({ appointmentsToday, pendingOrders, totalCustomers, recentAppointments });
  } catch (err) {
    next(err);
  }
});

// ── Citas ─────────────────────────────────────────────────
router.get('/appointments', async (req, res, next) => {
  try {
    const { date, staffId, status } = req.query;
    const appointments = await prisma.appointment.findMany({
      where: {
        ...(date && { date: new Date(date + 'T00:00:00Z') }),
        ...(staffId && { staffId }),
        ...(status && { status }),
      },
      include: { service: true, staff: true, customer: true },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    res.json(appointments);
  } catch (err) {
    next(err);
  }
});

router.patch('/appointments/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status },
      include: { service: true, staff: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── Servicios ─────────────────────────────────────────────
router.get('/services', async (_req, res, next) => {
  try {
    const services = await prisma.service.findMany({ include: { category: true } });
    res.json(services);
  } catch (err) { next(err); }
});

router.post('/services', async (req, res, next) => {
  try {
    const service = await prisma.service.create({ data: req.body });
    res.status(201).json(service);
  } catch (err) { next(err); }
});

router.patch('/services/:id', async (req, res, next) => {
  try {
    const service = await prisma.service.update({ where: { id: req.params.id }, data: req.body });
    res.json(service);
  } catch (err) { next(err); }
});

router.delete('/services/:id', async (req, res, next) => {
  try {
    await prisma.service.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Productos ─────────────────────────────────────────────
router.get('/products', async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({ include: { category: true } });
    res.json(products);
  } catch (err) { next(err); }
});

router.post('/products', async (req, res, next) => {
  try {
    const product = await prisma.product.create({ data: req.body });
    res.status(201).json(product);
  } catch (err) { next(err); }
});

router.patch('/products/:id', async (req, res, next) => {
  try {
    const product = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
    res.json(product);
  } catch (err) { next(err); }
});

router.delete('/products/:id', async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Pedidos ───────────────────────────────────────────────
router.get('/orders', async (req, res, next) => {
  try {
    const { status } = req.query;
    const orders = await prisma.order.findMany({
      where: status ? { status } : undefined,
      include: { items: true, customer: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) { next(err); }
});

router.patch('/orders/:id', async (req, res, next) => {
  try {
    const order = await prisma.order.update({ where: { id: req.params.id }, data: req.body });
    res.json(order);
  } catch (err) { next(err); }
});

// ── Staff ─────────────────────────────────────────────────
router.get('/staff', async (_req, res, next) => {
  try {
    const staff = await prisma.staff.findMany({ include: { schedules: true, staffServices: true } });
    res.json(staff);
  } catch (err) { next(err); }
});

router.post('/staff', async (req, res, next) => {
  try {
    const { schedules, serviceIds, ...data } = req.body;
    const staff = await prisma.staff.create({
      data: {
        ...data,
        schedules: schedules ? { create: schedules } : undefined,
        staffServices: serviceIds
          ? { create: serviceIds.map(id => ({ serviceId: id })) }
          : undefined,
      },
      include: { schedules: true, staffServices: true },
    });
    res.status(201).json(staff);
  } catch (err) { next(err); }
});

router.patch('/staff/:id', async (req, res, next) => {
  try {
    const staff = await prisma.staff.update({ where: { id: req.params.id }, data: req.body });
    res.json(staff);
  } catch (err) { next(err); }
});

// ── Galería ───────────────────────────────────────────────
router.get('/gallery', async (_req, res, next) => {
  try {
    const photos = await prisma.gallery.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(photos);
  } catch (err) { next(err); }
});

router.post('/gallery/upload', async (req, res, next) => {
  try {
    const { file, category, caption } = req.body;
    if (!file) return res.status(400).json({ error: 'Imagen requerida' });

    const uploaded = await uploadImage(file, 'galeria');
    const photo = await prisma.gallery.create({
      data: { imageUrl: uploaded.url, category: category || null, caption: caption || null },
    });
    res.status(201).json(photo);
  } catch (err) { next(err); }
});

router.patch('/gallery/:id', async (req, res, next) => {
  try {
    const photo = await prisma.gallery.update({ where: { id: req.params.id }, data: req.body });
    res.json(photo);
  } catch (err) { next(err); }
});

router.delete('/gallery/:id', async (req, res, next) => {
  try {
    await prisma.gallery.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Blog ──────────────────────────────────────────────────
router.get('/blog', async (_req, res, next) => {
  try {
    const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(posts);
  } catch (err) { next(err); }
});

router.post('/blog', async (req, res, next) => {
  try {
    const post = await prisma.blogPost.create({ data: req.body });
    res.status(201).json(post);
  } catch (err) { next(err); }
});

router.patch('/blog/:id', async (req, res, next) => {
  try {
    const post = await prisma.blogPost.update({ where: { id: req.params.id }, data: req.body });
    res.json(post);
  } catch (err) { next(err); }
});

router.delete('/blog/:id', async (req, res, next) => {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Promociones ───────────────────────────────────────────
router.get('/promotions', async (_req, res, next) => {
  try {
    const promos = await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(promos);
  } catch (err) { next(err); }
});

router.post('/promotions', async (req, res, next) => {
  try {
    const promo = await prisma.promotion.create({ data: req.body });
    res.status(201).json(promo);
  } catch (err) { next(err); }
});

router.patch('/promotions/:id', async (req, res, next) => {
  try {
    const promo = await prisma.promotion.update({ where: { id: req.params.id }, data: req.body });
    res.json(promo);
  } catch (err) { next(err); }
});

// ── Clientes ──────────────────────────────────────────────
router.get('/customers', async (_req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(customers);
  } catch (err) { next(err); }
});

// ── Configuración ─────────────────────────────────────────
router.get('/settings', async (_req, res, next) => {
  try {
    const setting = await prisma.setting.findFirst();
    res.json(setting || {});
  } catch (err) { next(err); }
});

router.patch('/settings', async (req, res, next) => {
  try {
    const existing = await prisma.setting.findFirst();
    const setting = existing
      ? await prisma.setting.update({ where: { id: existing.id }, data: req.body })
      : await prisma.setting.create({ data: req.body });
    res.json(setting);
  } catch (err) { next(err); }
});

// ── Upload de imágenes ────────────────────────────────────
router.post('/upload', async (req, res, next) => {
  try {
    const { file, folder } = req.body;
    if (!file) return res.status(400).json({ error: 'Imagen requerida' });
    const result = await uploadImage(file, folder || 'general');
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
