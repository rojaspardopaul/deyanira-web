const { Router } = require('express');
const { isAdmin } = require('../../middleware/auth');
const { uploadImage } = require('../../lib/cloudinary');
const { PrismaClient } = require('@prisma/client');
const accountingRouter = require('./accounting');

const prisma = new PrismaClient();
const router = Router();

router.use(isAdmin);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pick(obj, keys) {
  const result = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) result[key] = obj[key];
  }
  return result;
}

const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];
const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed'];
const PROMOTION_TYPES = ['percent', 'fixed'];
const GALLERY_CATEGORIES = ['maquillaje', 'cabello', 'unas', 'cejas', 'general'];

// ── Dashboard ─────────────────────────────────────────────────
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
  } catch (err) { next(err); }
});

// ── Citas ─────────────────────────────────────────────────────
router.get('/appointments', async (req, res, next) => {
  try {
    const { date, staffId, status } = req.query;
    const where = {};
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      where.date = new Date(date + 'T00:00:00Z');
    }
    if (staffId && UUID_RE.test(staffId)) where.staffId = staffId;
    if (status && APPOINTMENT_STATUSES.includes(status)) where.status = status;

    const appointments = await prisma.appointment.findMany({
      where,
      include: { service: true, staff: true, customer: true },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    res.json(appointments);
  } catch (err) { next(err); }
});

router.patch('/appointments/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !APPOINTMENT_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Estado de cita inválido' });
    }
    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status },
      include: { service: true, staff: true },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// ── Servicios ─────────────────────────────────────────────────
router.get('/services', async (_req, res, next) => {
  try {
    const services = await prisma.service.findMany({ include: { category: true } });
    res.json(services);
  } catch (err) { next(err); }
});

router.post('/services', async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'name', 'slug', 'description', 'categoryId',
      'pricePen', 'duration', 'imageUrl', 'isActive',
    ]);
    if (!data.name || !data.slug || data.pricePen == null || data.duration == null) {
      return res.status(400).json({ error: 'name, slug, pricePen y duration son requeridos' });
    }
    data.pricePen = Number(data.pricePen);
    data.duration = Number(data.duration);
    if (isNaN(data.pricePen) || data.pricePen < 0) {
      return res.status(400).json({ error: 'pricePen inválido' });
    }
    if (!Number.isInteger(data.duration) || data.duration < 1 || data.duration > 480) {
      return res.status(400).json({ error: 'duration inválido (1–480 minutos)' });
    }
    const service = await prisma.service.create({ data });
    res.status(201).json(service);
  } catch (err) { next(err); }
});

router.patch('/services/:id', async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'name', 'slug', 'description', 'categoryId',
      'pricePen', 'duration', 'imageUrl', 'isActive',
    ]);
    if (data.pricePen != null) data.pricePen = Number(data.pricePen);
    if (data.duration != null) data.duration = Number(data.duration);
    const service = await prisma.service.update({
      where: { id: req.params.id },
      data,
    });
    res.json(service);
  } catch (err) { next(err); }
});

router.delete('/services/:id', async (req, res, next) => {
  try {
    await prisma.service.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Productos ─────────────────────────────────────────────────
router.get('/products', async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({ include: { category: true } });
    res.json(products);
  } catch (err) { next(err); }
});

router.post('/products', async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'name', 'slug', 'description', 'categoryId', 'brand',
      'pricePen', 'comparePrice', 'stock', 'images', 'isActive',
    ]);
    if (!data.name || !data.slug || data.pricePen == null) {
      return res.status(400).json({ error: 'name, slug y pricePen son requeridos' });
    }
    data.pricePen = Number(data.pricePen);
    if (isNaN(data.pricePen) || data.pricePen < 0) {
      return res.status(400).json({ error: 'pricePen inválido' });
    }
    if (data.stock != null) data.stock = Math.max(0, Number(data.stock));
    if (data.comparePrice != null) data.comparePrice = Number(data.comparePrice);
    if (data.images != null && !Array.isArray(data.images)) {
      return res.status(400).json({ error: 'images debe ser un array' });
    }
    const product = await prisma.product.create({ data });
    res.status(201).json(product);
  } catch (err) { next(err); }
});

router.patch('/products/:id', async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'name', 'slug', 'description', 'categoryId', 'brand',
      'pricePen', 'comparePrice', 'stock', 'images', 'isActive',
    ]);
    if (data.pricePen != null) data.pricePen = Number(data.pricePen);
    if (data.stock != null) data.stock = Math.max(0, Number(data.stock));
    if (data.comparePrice != null) data.comparePrice = Number(data.comparePrice);
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
    });
    res.json(product);
  } catch (err) { next(err); }
});

router.delete('/products/:id', async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Pedidos ───────────────────────────────────────────────────
router.get('/orders', async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = status && ORDER_STATUSES.includes(status) ? { status } : undefined;
    const orders = await prisma.order.findMany({
      where,
      include: { items: true, customer: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) { next(err); }
});

router.patch('/orders/:id', async (req, res, next) => {
  try {
    const data = pick(req.body, ['status', 'paymentStatus']);
    if (data.status && !ORDER_STATUSES.includes(data.status)) {
      return res.status(400).json({ error: 'Estado de pedido inválido' });
    }
    if (data.paymentStatus && !PAYMENT_STATUSES.includes(data.paymentStatus)) {
      return res.status(400).json({ error: 'Estado de pago inválido' });
    }
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data,
    });
    res.json(order);
  } catch (err) { next(err); }
});

// ── Staff ─────────────────────────────────────────────────────
router.get('/staff', async (_req, res, next) => {
  try {
    const staff = await prisma.staff.findMany({ include: { schedules: true, staffServices: true } });
    res.json(staff);
  } catch (err) { next(err); }
});

router.post('/staff', async (req, res, next) => {
  try {
    const { schedules, serviceIds } = req.body;
    const data = pick(req.body, ['name', 'role', 'photoUrl', 'bio', 'isActive']);
    if (!data.name) return res.status(400).json({ error: 'name es requerido' });

    const staff = await prisma.staff.create({
      data: {
        ...data,
        schedules: Array.isArray(schedules)
          ? { create: schedules.map(s => pick(s, ['dayOfWeek', 'startTime', 'endTime'])) }
          : undefined,
        staffServices: Array.isArray(serviceIds) && serviceIds.every(id => UUID_RE.test(id))
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
    const data = pick(req.body, ['name', 'role', 'photoUrl', 'bio', 'isActive']);
    const staff = await prisma.staff.update({ where: { id: req.params.id }, data });
    res.json(staff);
  } catch (err) { next(err); }
});

// ── Galería ───────────────────────────────────────────────────
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
    if (category && !GALLERY_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Categoría de galería inválida' });
    }

    const uploaded = await uploadImage(file, 'galeria');
    const photo = await prisma.gallery.create({
      data: {
        imageUrl: uploaded.url,
        category: category || null,
        caption: caption ? String(caption).slice(0, 200) : null,
      },
    });
    res.status(201).json(photo);
  } catch (err) { next(err); }
});

router.patch('/gallery/:id', async (req, res, next) => {
  try {
    const data = pick(req.body, ['category', 'caption', 'sortOrder', 'isPublished']);
    if (data.category && !GALLERY_CATEGORIES.includes(data.category)) {
      return res.status(400).json({ error: 'Categoría de galería inválida' });
    }
    if (data.sortOrder != null) data.sortOrder = Number(data.sortOrder);
    const photo = await prisma.gallery.update({ where: { id: req.params.id }, data });
    res.json(photo);
  } catch (err) { next(err); }
});

router.delete('/gallery/:id', async (req, res, next) => {
  try {
    await prisma.gallery.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Blog ──────────────────────────────────────────────────────
router.get('/blog', async (_req, res, next) => {
  try {
    const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(posts);
  } catch (err) { next(err); }
});

router.post('/blog', async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'title', 'slug', 'excerpt', 'content', 'coverUrl', 'isPublished', 'publishedAt',
    ]);
    if (!data.title || !data.slug || !data.content) {
      return res.status(400).json({ error: 'title, slug y content son requeridos' });
    }
    const post = await prisma.blogPost.create({ data });
    res.status(201).json(post);
  } catch (err) { next(err); }
});

router.patch('/blog/:id', async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'title', 'slug', 'excerpt', 'content', 'coverUrl', 'isPublished', 'publishedAt',
    ]);
    const post = await prisma.blogPost.update({ where: { id: req.params.id }, data });
    res.json(post);
  } catch (err) { next(err); }
});

router.delete('/blog/:id', async (req, res, next) => {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Promociones ───────────────────────────────────────────────
router.get('/promotions', async (_req, res, next) => {
  try {
    const promos = await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(promos);
  } catch (err) { next(err); }
});

router.post('/promotions', async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'code', 'type', 'value', 'minOrderPen',
      'applicableTo', 'usageLimit', 'expiresAt', 'isActive',
    ]);
    if (!data.code || !data.type || data.value == null) {
      return res.status(400).json({ error: 'code, type y value son requeridos' });
    }
    if (!PROMOTION_TYPES.includes(data.type)) {
      return res.status(400).json({ error: 'type debe ser "percent" o "fixed"' });
    }
    data.value = Number(data.value);
    if (data.type === 'percent' && (data.value < 1 || data.value > 100)) {
      return res.status(400).json({ error: 'Descuento en porcentaje debe ser 1–100' });
    }
    if (data.minOrderPen != null) data.minOrderPen = Number(data.minOrderPen);
    if (data.usageLimit != null) data.usageLimit = Number(data.usageLimit);
    const promo = await prisma.promotion.create({ data });
    res.status(201).json(promo);
  } catch (err) { next(err); }
});

router.patch('/promotions/:id', async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'code', 'type', 'value', 'minOrderPen',
      'applicableTo', 'usageLimit', 'expiresAt', 'isActive',
    ]);
    if (data.type && !PROMOTION_TYPES.includes(data.type)) {
      return res.status(400).json({ error: 'type debe ser "percent" o "fixed"' });
    }
    if (data.value != null) data.value = Number(data.value);
    if (data.minOrderPen != null) data.minOrderPen = Number(data.minOrderPen);
    const promo = await prisma.promotion.update({ where: { id: req.params.id }, data });
    res.json(promo);
  } catch (err) { next(err); }
});

// ── Clientes ──────────────────────────────────────────────────
router.get('/customers', async (_req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(customers);
  } catch (err) { next(err); }
});

// ── Configuración ─────────────────────────────────────────────
router.get('/settings', async (_req, res, next) => {
  try {
    const setting = await prisma.setting.findFirst();
    res.json(setting || {});
  } catch (err) { next(err); }
});

router.patch('/settings', async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'salonName', 'phone', 'whatsapp', 'email', 'address', 'district', 'city',
      'lat', 'lng', 'hoursWeekday', 'hoursSaturday', 'hoursSunday',
      'facebookUrl', 'instagramUrl', 'tiktokUrl',
      'bookingNoticeHours', 'cancellationHours',
    ]);
    if (data.lat != null) data.lat = Number(data.lat);
    if (data.lng != null) data.lng = Number(data.lng);
    if (data.bookingNoticeHours != null) data.bookingNoticeHours = Number(data.bookingNoticeHours);
    if (data.cancellationHours != null) data.cancellationHours = Number(data.cancellationHours);

    const existing = await prisma.setting.findFirst();
    const setting = existing
      ? await prisma.setting.update({ where: { id: existing.id }, data })
      : await prisma.setting.create({ data });
    res.json(setting);
  } catch (err) { next(err); }
});

// ── Upload de imágenes ────────────────────────────────────────
router.post('/upload', async (req, res, next) => {
  try {
    const { file, folder } = req.body;
    if (!file) return res.status(400).json({ error: 'Imagen requerida' });

    const ALLOWED_FOLDERS = ['galeria', 'productos', 'servicios', 'staff', 'blog', 'general'];
    const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : 'general';

    const result = await uploadImage(file, safeFolder);
    res.json(result);
  } catch (err) { next(err); }
});

// ── Contabilidad ──────────────────────────────────────────
router.use('/accounting', accountingRouter);

module.exports = router;
