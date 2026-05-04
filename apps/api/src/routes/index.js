const { Router } = require('express');

const servicesRouter = require('./public/services');
const staffRouter = require('./public/staff');
const appointmentsRouter = require('./public/appointments');
const productsRouter = require('./public/products');
const ordersRouter = require('./public/orders');
const paymentsRouter = require('./public/payments');
const galleryRouter = require('./public/gallery');
const blogRouter = require('./public/blog');
const settingsRouter = require('./public/settings');
const promotionsRouter = require('./public/promotions');
const authRouter = require('./public/auth');

const adminRouter = require('./admin');

const router = Router();

// ── Públicas ──────────────────────────────────────────────
router.use('/auth', authRouter);
router.use('/services', servicesRouter);
router.use('/staff', staffRouter);
router.use('/appointments', appointmentsRouter);
router.use('/products', productsRouter);
router.use('/orders', ordersRouter);
router.use('/payments', paymentsRouter);
router.use('/gallery', galleryRouter);
router.use('/blog', blogRouter);
router.use('/settings', settingsRouter);
router.use('/promotions', promotionsRouter);

// ── Admin ─────────────────────────────────────────────────
router.use('/admin', adminRouter);

module.exports = router;
