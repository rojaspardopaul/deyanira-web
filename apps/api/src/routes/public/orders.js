const { Router } = require('express');
const { Prisma } = require('@prisma/client');
const { z } = require('zod');

const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');
const { isCustomer, optionalCustomer } = require('../../middleware/auth');
const { sendOrderPendingPayment } = require('../../lib/notifications/email');
const { validate, UUID_RE, EMAIL_RE, PHONE_RE } = require('../../lib/validate');
const { BadRequest, Conflict, NotFound } = require('../../lib/errors');

const router = Router();

const PAYMENT_METHODS = ['culqi', 'yape'];
const MAX_ITEMS = 50;
const MAX_QTY_PER_ITEM = 99;

const OrderItemBody = z.object({
  productId: z.string().regex(UUID_RE),
  qty: z.number().int().min(1).max(MAX_QTY_PER_ITEM),
});

const OrderBody = z.object({
  items: z.array(OrderItemBody).min(1).max(MAX_ITEMS),
  shipName:    z.string().trim().min(1).max(100),
  shipPhone:   z.string().regex(PHONE_RE, 'Teléfono inválido'),
  shipEmail:   z.string().regex(EMAIL_RE, 'Email inválido').max(150).optional().nullable(),
  shipAddress: z.string().trim().min(5).max(200),
  shipDistrict: z.string().trim().min(2).max(50),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  couponCode: z.string().trim().min(1).max(50).optional().nullable(),
}).strict();

// POST /api/orders — crear pedido
// Rate-limited en index.js (8 pedidos / 10 min por IP).
// optionalCustomer permite checkout guest pero asocia customerId si hay sesión.
router.post('/', optionalCustomer, validate({ body: OrderBody }), async (req, res, next) => {
  try {
    const {
      items, shipName, shipPhone, shipEmail, shipAddress, shipDistrict,
      paymentMethod, couponCode,
    } = req.body;

    // ── Anti-abuse: máximo 3 pedidos pendientes por cliente/teléfono ──
    if (req.user) {
      const pending = await prisma.order.count({
        where: {
          customerId: req.user.id,
          status: 'pending',
          paymentStatus: 'pending',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (pending >= 3) return next(Conflict('Tienes demasiados pedidos pendientes. Completa el pago de los anteriores.'));
    } else {
      const pendingGuest = await prisma.order.count({
        where: {
          shipPhone,
          customerId: null,
          status: 'pending',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (pendingGuest >= 3) return next(Conflict('Este número ya tiene pedidos pendientes. Por favor contáctanos.'));
    }

    let order;
    try {
      order = await prisma.$transaction(async (tx) => {
        let subtotal = 0;
        const validatedItems = [];

        // Carga todos los productos en una sola query (evita N+1) y los indexa por id.
        const productIds = [...new Set(items.map(i => i.productId))];
        const products = await tx.product.findMany({ where: { id: { in: productIds } } });
        const byId = new Map(products.map(p => [p.id, p]));

        for (const item of items) {
          const product = byId.get(item.productId);
          if (!product || !product.isActive) {
            const err = new Error('Producto no disponible'); err.status = 400; throw err;
          }

          // El decremento atómico (updateMany con guard de stock) sigue siendo
          // por item: garantiza que dos pedidos concurrentes no agoten el stock.
          const updated = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.qty } },
            data: { stock: { decrement: item.qty } },
          });
          if (updated.count === 0) {
            const err = new Error(`Stock insuficiente para "${product.name}"`); err.status = 409; throw err;
          }

          subtotal += Number(product.pricePen) * item.qty;
          validatedItems.push({ product, qty: item.qty });
        }

        // ── Aplicar cupón (validación + uso atómico) ──
        let discountPen = 0;
        let appliedCoupon = null;
        if (couponCode) {
          const code = couponCode.toUpperCase();
          const promo = await tx.promotion.findUnique({ where: { code } });
          if (!promo || !promo.isActive) {
            const err = new Error('Código de descuento inválido'); err.status = 400; throw err;
          }
          if (promo.expiresAt && new Date() > promo.expiresAt) {
            const err = new Error('El código de descuento expiró'); err.status = 400; throw err;
          }
          if (subtotal < Number(promo.minOrderPen)) {
            const err = new Error(`El cupón requiere mínimo S/ ${promo.minOrderPen}`); err.status = 400; throw err;
          }

          // Incremento atómico con guard de usageLimit
          const inc = await tx.promotion.updateMany({
            where: {
              id: promo.id,
              isActive: true,
              OR: [
                { usageLimit: null },
                { usageLimit: { gt: promo.usedCount } },
              ],
            },
            data: { usedCount: { increment: 1 } },
          });
          if (inc.count === 0) {
            const err = new Error('El código ya alcanzó su límite de usos'); err.status = 409; throw err;
          }
          discountPen = promo.type === 'percent'
            ? Math.round((subtotal * Number(promo.value)) * 100 / 100) / 100
            : Number(promo.value);
          discountPen = Math.min(discountPen, subtotal);
          appliedCoupon = code;
        }

        const shippingPen = subtotal > 100 ? 0 : 10;
        const totalPen = Math.max(0, subtotal + shippingPen - discountPen);

        return tx.order.create({
          data: {
            customerId: req.user?.id || null,
            status: 'pending',
            subtotalPen: subtotal,
            shippingPen,
            discountPen,
            totalPen,
            paymentMethod: paymentMethod || 'culqi',
            paymentStatus: 'pending',
            shipName,
            shipPhone,
            shipEmail: shipEmail || null,
            shipAddress,
            shipDistrict,
            shipCity: 'Lima',
            couponCode: appliedCoupon,
            items: {
              create: validatedItems.map(({ product, qty }) => ({
                productId: product.id,
                name: product.name,
                pricePen: product.pricePen,
                qty,
              })),
            },
          },
          include: { items: true },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      if (err.status) return next(err.status === 400 ? BadRequest(err.message) : Conflict(err.message));
      throw err;
    }

    // Email — sólo si Yape (las confirmaciones de Culqi van tras pago en payments.js)
    if (shipEmail && (paymentMethod === 'yape' || !paymentMethod)) {
      const yapeNumber = (process.env.YAPE_NUMBER || process.env.SALON_WHATSAPP || '').replace(/\D/g, '');
      sendOrderPendingPayment({ order, email: shipEmail, yapeNumber })
        .catch(err => logger.error('email_failed', { msg: err.message }));
    }

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/me — pedidos del cliente logueado
router.get('/me', isCustomer, async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.user.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) { next(err); }
});

// GET /api/orders/:id — sólo si lo creó el cliente actual o coincide el shipEmail/Phone
// (las páginas de "gracias por tu compra" lo consultan)
router.get('/:id', optionalCustomer, async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return next(BadRequest('ID inválido'));
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!order) return next(NotFound('Pedido no encontrado'));

    // Ownership check: customerId o email del cliente logueado coinciden;
    // si guest, expone sólo si pasa el orderId + email (querystring).
    const isOwnerByUser  = req.user && order.customerId === req.user.id;
    const guestEmail = String(req.query.email || '').toLowerCase();
    const isOwnerByEmail = guestEmail && order.shipEmail?.toLowerCase() === guestEmail;
    if (!isOwnerByUser && !isOwnerByEmail) return next(NotFound('Pedido no encontrado'));

    res.json(order);
  } catch (err) { next(err); }
});

module.exports = router;
