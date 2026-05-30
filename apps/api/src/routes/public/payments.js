const { Router } = require('express');
const { z } = require('zod');

const prisma = require('../../lib/prisma');
const env = require('../../lib/env');
const logger = require('../../lib/logger');
const { createCharge } = require('../../lib/payments/culqi');
const { sendOrderConfirmation } = require('../../lib/notifications/email');
const { isAdmin } = require('../../middleware/auth');
const { validate, UUID_RE, EMAIL_RE } = require('../../lib/validate');
const { BadRequest, NotFound, PaymentReq, Conflict } = require('../../lib/errors');

const router = Router();

const CulqiBody = z.object({
  orderId:    z.string().regex(UUID_RE, 'orderId inválido'),
  culqiToken: z.string().min(10).max(120),
  email:      z.string().regex(EMAIL_RE, 'email inválido').max(150),
});

const YapeBody = z.object({
  orderId:   z.string().regex(UUID_RE, 'orderId inválido'),
  reference: z.string().min(1).max(100).optional(),
});

// ── POST /api/payments/culqi ──────────────────────────────────
// El orderId actúa como challenge (UUIDv4 = 122 bits aleatorios). No protegido
// por auth porque también lo usa el flujo guest, pero:
//   · Sólo permite pagar una vez (estado != paid)
//   · Idempotency key contra Culqi previene cobro duplicado
//   · Rate limit estricto en index.js (10/min por IP)
router.post('/culqi', validate({ body: CulqiBody }), async (req, res, next) => {
  try {
    const { orderId, culqiToken, email } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return next(NotFound('Pedido no encontrado'));
    if (order.paymentStatus === 'paid') return next(Conflict('Este pedido ya fue pagado'));
    if (order.status === 'cancelled')    return next(BadRequest('Este pedido fue cancelado'));

    // Validar que el email coincida con el de envío (mitigación: evita que un
    // tercero adivinando un UUID asocie su tarjeta a un pedido ajeno y reciba el cobro).
    if (order.shipEmail && order.shipEmail.toLowerCase() !== email.toLowerCase()) {
      logger.warn('culqi_email_mismatch', { orderId, shipEmail: order.shipEmail });
      return next(BadRequest('El email no coincide con el del pedido'));
    }

    // Total no manipulable: viene de DB
    const amountCentimos = Math.round(Number(order.totalPen) * 100);
    if (amountCentimos < 100) {
      // Culqi exige mínimo S/ 1.00
      return next(BadRequest('Monto mínimo no alcanzado'));
    }

    let charge;
    try {
      charge = await createCharge({
        token: culqiToken,
        amountCentimos,
        email,
        description: `Pedido #${orderId.slice(-8).toUpperCase()} — Deyanira Makeup Beauty`,
        idempotencyKey: orderId,
      });
    } catch (culqiErr) {
      // Si Culqi devuelve "charge already created" con la misma idempotency key, el cobro ya existe.
      if (culqiErr.culqiCode === 'already_exists') {
        const updated = await prisma.order.update({
          where: { id: orderId, paymentStatus: { not: 'paid' } },
          data: { paymentStatus: 'paid', paymentMethod: 'culqi', status: 'processing' },
          include: { items: true },
        }).catch(() => null);
        if (updated && updated.shipEmail) {
          sendOrderConfirmation({ order: updated, email: updated.shipEmail }).catch(err => logger.error('email_failed', { msg: err.message }));
        }
        return res.json({ success: true, alreadyPaid: true });
      }
      logger.warn('culqi_charge_failed', {
        orderId,
        code: culqiErr.culqiCode,
        status: culqiErr.culqiStatus,
      });
      return next(PaymentReq(culqiErr.message || 'Error procesando el pago'));
    }

    // Atomic conditional update (sólo si aún no pagado)
    const result = await prisma.order.updateMany({
      where: { id: orderId, paymentStatus: { not: 'paid' } },
      data: {
        paymentStatus: 'paid',
        paymentMethod: 'culqi',
        paymentRef: charge.id,
        status: 'processing',
      },
    });
    if (result.count === 0) {
      return next(Conflict('Este pedido ya fue pagado'));
    }

    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (updated?.shipEmail) {
      sendOrderConfirmation({ order: updated, email: updated.shipEmail })
        .catch(err => logger.error('email_failed', { msg: err.message }));
    }

    res.json({ success: true, orderId: updated.id });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/payments/yape-confirm — solo admin ──────────────
router.post('/yape-confirm', isAdmin, validate({ body: YapeBody }), async (req, res, next) => {
  try {
    const { orderId, reference } = req.body;

    const markPaid = await prisma.order.updateMany({
      where: { id: orderId, paymentStatus: { not: 'paid' }, status: { not: 'cancelled' } },
      data: {
        paymentStatus: 'paid',
        paymentMethod: 'yape',
        paymentRef: reference || 'yape-manual',
        status: 'processing',
      },
    });

    if (markPaid.count === 0) {
      const existing = await prisma.order.findUnique({ where: { id: orderId } });
      if (!existing) return next(NotFound('Pedido no encontrado'));
      if (existing.status === 'cancelled') return next(BadRequest('Este pedido fue cancelado'));
      return next(Conflict('Este pedido ya fue pagado'));
    }

    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (updated?.shipEmail) {
      sendOrderConfirmation({ order: updated, email: updated.shipEmail })
        .catch(err => logger.error('email_failed', { msg: err.message }));
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
