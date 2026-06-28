const { Router } = require('express');

const servicesRouter = require('./public/services');
const eventTypesRouter = require('./public/event-types');
const catalogsRouter = require('./public/catalogs');
const staffRouter = require('./public/staff');
const productsRouter = require('./public/products');
const galleryRouter = require('./public/gallery');
const blogRouter = require('./public/blog');
const settingsRouter = require('./public/settings');
const reclamacionesRouter = require('./public/reclamaciones');
const promotionsRouter = require('./public/promotions');
const authRouter = require('./public/auth');
const customersRouter = require('./public/customers');
const bookingsRouter = require('./public/bookings');

const adminRouter = require('./admin');

// Módulos nuevos (DDD/Clean). Migraciones Strangler completadas: los routers
// legacy (citas, pedidos, pagos, adelantos) fueron retirados tras verificar paridad real.
const { crearRouterCitas } = require('../modules/appointments/presentation/appointments.routes');
const { crearRouterPedidos } = require('../modules/orders/presentation/orders.routes');
const { crearRouterPagos } = require('../modules/payments/presentation/payments.routes');
const { crearRouterWebhookPagos } = require('../modules/payments/presentation/payments-webhook.routes');
const { crearRouterAdelantos } = require('../modules/booking-payments/presentation/booking-payments.routes');

const router = Router();

const citasRouter = crearRouterCitas();
const pedidosRouter = crearRouterPedidos();
const pagosRouter = crearRouterPagos();
const webhookRouter = crearRouterWebhookPagos();
const adelantosRouter = crearRouterAdelantos();

// ── Públicas ──────────────────────────────────────────────
router.use('/auth', authRouter);
router.use('/services', servicesRouter);
router.use('/event-types', eventTypesRouter);
router.use('/catalogs', catalogsRouter);
router.use('/staff', staffRouter);
router.use('/appointments', citasRouter);
router.use('/products', productsRouter);
router.use('/orders', pedidosRouter);
router.use('/payments', pagosRouter);
router.use('/payments/webhook', webhookRouter);   // POST /api/payments/webhook/culqi
router.use('/gallery', galleryRouter);
router.use('/blog', blogRouter);
router.use('/settings', settingsRouter);
router.use('/reclamaciones', reclamacionesRouter);
router.use('/promotions', promotionsRouter);
router.use('/customers', customersRouter);
router.use('/bookings', bookingsRouter);
router.use('/booking-payments', adelantosRouter);

// ── Admin ─────────────────────────────────────────────────
router.use('/admin', adminRouter);

module.exports = router;
