const { Router } = require('express');

const servicesRouter = require('./public/services');
const eventTypesRouter = require('./public/event-types');
const catalogsRouter = require('./public/catalogs');
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
const customersRouter = require('./public/customers');
const bookingsRouter = require('./public/bookings');
const bookingPaymentsRouter = require('./public/booking-payments');
const paymentsWebhookRouter = require('./public/payments-webhook');

const adminRouter = require('./admin');

const { citasModuloNuevoActivo } = require('../shared/config/entorno');

const router = Router();

// ── Cutover del módulo de citas (Strangler, Fase 1C) ──────
// Si CITAS_MODULO_NUEVO=true se monta el módulo nuevo (modules/appointments),
// que maneja POST / y PATCH /:id/cancel y delega el resto al router legacy.
// Apagado por defecto => ruta legacy intacta. Rollback = apagar el flag.
let citasRouter = appointmentsRouter;
if (citasModuloNuevoActivo()) {
  const { crearRouterCitas } = require('../modules/appointments/presentation/appointments.routes');
  citasRouter = crearRouterCitas(appointmentsRouter);
}

// ── Públicas ──────────────────────────────────────────────
router.use('/auth', authRouter);
router.use('/services', servicesRouter);
router.use('/event-types', eventTypesRouter);
router.use('/catalogs', catalogsRouter);
router.use('/staff', staffRouter);
router.use('/appointments', citasRouter);
router.use('/products', productsRouter);
router.use('/orders', ordersRouter);
router.use('/payments', paymentsRouter);
router.use('/payments/webhook', paymentsWebhookRouter);   // POST /api/payments/webhook/culqi
router.use('/gallery', galleryRouter);
router.use('/blog', blogRouter);
router.use('/settings', settingsRouter);
router.use('/promotions', promotionsRouter);
router.use('/customers', customersRouter);
router.use('/bookings', bookingsRouter);
router.use('/booking-payments', bookingPaymentsRouter);

// ── Admin ─────────────────────────────────────────────────
router.use('/admin', adminRouter);

module.exports = router;
