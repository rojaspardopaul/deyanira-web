const { Router } = require('express');
const { PrismaClient, Prisma } = require('@prisma/client');
const { isCustomer } = require('../../middleware/auth');

const prisma = new PrismaClient();
const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_PAYMENT_METHODS = ['culqi', 'yape'];

// POST /api/orders — crear pedido
router.post('/', async (req, res, next) => {
  try {
    const {
      items, shipName, shipPhone, shipAddress, shipDistrict,
      paymentMethod, couponCode,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El pedido debe incluir al menos un producto' });
    }
    if (items.length > 50) {
      return res.status(400).json({ error: 'El pedido no puede tener más de 50 ítems' });
    }
    if (!shipName || !shipPhone || !shipAddress || !shipDistrict) {
      return res.status(400).json({ error: 'Faltan datos de envío' });
    }
    if (paymentMethod && !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Método de pago inválido' });
    }

    // Validar IDs de items
    for (const item of items) {
      if (!item.productId || !UUID_RE.test(item.productId)) {
        return res.status(400).json({ error: 'productId inválido' });
      }
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) {
        return res.status(400).json({ error: 'Cantidad de producto inválida' });
      }
    }

    let order;
    try {
      order = await prisma.$transaction(async (tx) => {
        let subtotal = 0;
        const validatedItems = [];

        for (const item of items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product || !product.isActive) {
            const err = new Error(`Producto no disponible`);
            err.status = 400;
            throw err;
          }

          // Decremento atómico: solo ejecuta si stock >= qty
          const updated = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.qty } },
            data: { stock: { decrement: item.qty } },
          });

          if (updated.count === 0) {
            const err = new Error(`Stock insuficiente para "${product.name}"`);
            err.status = 409;
            throw err;
          }

          subtotal += Number(product.pricePen) * item.qty;
          validatedItems.push({ product, qty: item.qty });
        }

        const shippingPen = 15;
        const totalPen = subtotal + shippingPen;

        return tx.order.create({
          data: {
            status: 'pending',
            subtotalPen: subtotal,
            shippingPen,
            discountPen: 0,
            totalPen,
            paymentMethod: paymentMethod || 'culqi',
            paymentStatus: 'pending',
            shipName: String(shipName).slice(0, 100),
            shipPhone: String(shipPhone).slice(0, 20),
            shipAddress: String(shipAddress).slice(0, 200),
            shipDistrict: String(shipDistrict).slice(0, 50),
            shipCity: 'Lima',
            couponCode: couponCode ? String(couponCode).slice(0, 50) : null,
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
      if (err.status) return res.status(err.status).json({ error: err.message });
      throw err;
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
  } catch (err) {
    next(err);
  }
});

module.exports = router;
