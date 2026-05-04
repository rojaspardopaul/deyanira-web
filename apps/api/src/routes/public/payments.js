const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { createCharge } = require('../../lib/payments/culqi');
const { sendOrderConfirmation } = require('../../lib/notifications/email');
const { isAdmin } = require('../../middleware/auth');

const prisma = new PrismaClient();
const router = Router();

// POST /api/payments/culqi — procesar pago con Culqi
router.post('/culqi', async (req, res, next) => {
  try {
    const { orderId, culqiToken, email } = req.body;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'orderId inválido' });
    }
    if (!culqiToken || !email) {
      return res.status(400).json({ error: 'culqiToken y email son requeridos' });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Este pedido ya fue pagado' });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Este pedido fue cancelado' });
    }

    // El monto siempre viene de la DB — nunca del cliente
    const amountCentimos = Math.round(Number(order.totalPen) * 100);

    const charge = await createCharge({
      token: culqiToken,
      amountCentimos,
      email,
      description: `Pedido #${orderId.slice(0, 8)} — Deyanira Makeup Beauty`,
    });

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'paid',
        paymentMethod: 'culqi',
        paymentRef: charge.id,
        status: 'processing',
      },
    });

    sendOrderConfirmation({ order: updated, email }).catch(console.error);
    res.json({ success: true, order: updated, chargeId: charge.id });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/yape-confirm — solo admin puede confirmar pago Yape
router.post('/yape-confirm', isAdmin, async (req, res, next) => {
  try {
    const { orderId, reference } = req.body;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'orderId inválido' });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Este pedido ya fue pagado' });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Este pedido fue cancelado' });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'paid',
        paymentMethod: 'yape',
        paymentRef: reference ? String(reference).slice(0, 100) : 'yape-manual',
        status: 'processing',
      },
    });

    res.json({ success: true, order: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
