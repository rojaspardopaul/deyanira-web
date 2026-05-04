const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { createCharge } = require('../../lib/payments/culqi');
const { sendOrderConfirmation } = require('../../lib/notifications/email');

const prisma = new PrismaClient();
const router = Router();

// POST /api/payments/culqi — procesar pago de pedido con Culqi
router.post('/culqi', async (req, res, next) => {
  try {
    const { orderId, culqiToken, email } = req.body;
    if (!orderId || !culqiToken || !email) {
      return res.status(400).json({ error: 'orderId, culqiToken y email son requeridos' });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Este pedido ya fue pagado' });
    }

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

// POST /api/payments/yape-confirm — admin confirma pago Yape manualmente
router.post('/yape-confirm', async (req, res, next) => {
  try {
    const { orderId, reference } = req.body;
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'paid',
        paymentMethod: 'yape',
        paymentRef: reference || 'yape-manual',
        status: 'processing',
      },
    });
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
