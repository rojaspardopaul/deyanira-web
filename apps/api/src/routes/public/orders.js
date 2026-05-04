const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { isCustomer } = require('../../middleware/auth');
const { sendOrderConfirmation } = require('../../lib/notifications/email');

const prisma = new PrismaClient();
const router = Router();

// POST /api/orders — crear pedido (puede ser invitado, se asocia si está logueado)
router.post('/', async (req, res, next) => {
  try {
    const {
      items, shipName, shipPhone, shipAddress, shipDistrict,
      paymentMethod, couponCode,
    } = req.body;

    if (!items?.length || !shipName || !shipPhone || !shipAddress || !shipDistrict) {
      return res.status(400).json({ error: 'Faltan datos del pedido o envío' });
    }

    // Calcular totales verificando stock y precios en DB
    let subtotal = 0;
    const validatedItems = [];
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || !product.isActive) {
        return res.status(400).json({ error: `Producto ${item.productId} no disponible` });
      }
      if (product.stock < item.qty) {
        return res.status(409).json({ error: `Stock insuficiente para ${product.name}` });
      }
      subtotal += Number(product.pricePen) * item.qty;
      validatedItems.push({ product, qty: item.qty });
    }

    // Costo de envío fijo por ahora (se puede hacer configurable)
    const shippingPen = 15;
    const totalPen = subtotal + shippingPen;

    const order = await prisma.order.create({
      data: {
        status: 'pending',
        subtotalPen: subtotal,
        shippingPen,
        totalPen,
        paymentMethod: paymentMethod || 'culqi',
        paymentStatus: 'pending',
        shipName, shipPhone, shipAddress, shipDistrict,
        couponCode: couponCode || null,
        items: {
          create: validatedItems.map(({ product, qty }) => ({
            productId: product.id,
            name: product.name,
            pricePen: product.pricePen,
            qty,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    // Descontar stock
    for (const { product, qty } of validatedItems) {
      await prisma.product.update({
        where: { id: product.id },
        data: { stock: { decrement: qty } },
      });
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
