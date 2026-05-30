const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');
const { createCharge } = require('../../lib/payments/culqi');
const { uploadImage } = require('../../lib/cloudinary');
const { markDepositPaid } = require('../../lib/payments/bookingDeposit');
const { renderBookingReceiptHtml } = require('../../lib/receipts/bookingReceipt');
const {
  sendBookingConfirmation, sendDepositReceipt,
  sendDepositProofReceived, sendDepositProofToSalon,
} = require('../../lib/notifications/email');
const { validate, UUID_RE, EMAIL_RE } = require('../../lib/validate');
const { BadRequest, NotFound, Conflict, PaymentReq } = require('../../lib/errors');

const router = Router();

// El id del pago es un UUIDv4 (122 bits) → actúa como challenge para el flujo
// guest (igual que orderId en pagos de tienda). Además rate-limit estricto.
const proofLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta en unos minutos.' },
});

const SALON_PAY_FIELDS = {
  yapeNumber: true, yapeName: true, plinNumber: true,
  bankName: true, bankAccount: true, bankCci: true, bankAccountHolder: true,
  salonName: true, whatsapp: true, phone: true,
};

async function loadGroup(payment) {
  const appointments = await prisma.appointment.findMany({
    where: { bookingGroupId: payment.bookingGroupId },
    include: { service: true, staff: true, package: { include: { eventType: true } } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  const pkg = appointments.find((a) => a.package)?.package || null;
  return { appointments, pkg };
}

// ── GET /api/booking-payments/:id ─────────────────────────────
// Datos de la reserva + adelanto + instrucciones de pago del salón.
router.get('/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return next(BadRequest('id inválido'));
    const payment = await prisma.bookingPayment.findUnique({ where: { id: req.params.id } });
    if (!payment) return next(NotFound('Reserva no encontrada'));

    const { appointments, pkg } = await loadGroup(payment);
    const salon = await prisma.setting.findFirst({ select: SALON_PAY_FIELDS });

    res.json({
      id: payment.id,
      status: payment.status,
      method: payment.method,
      totalPen: Number(payment.totalPen),
      depositPercent: payment.depositPercent,
      depositPen: Number(payment.depositPen),
      paidPen: Number(payment.paidPen),
      balancePen: Number(payment.balancePen),
      receiptNumber: payment.receiptNumber,
      customerName: payment.customerName,
      customerEmail: payment.customerEmail,
      customerPhone: payment.customerPhone,
      package: pkg ? { id: pkg.id, name: pkg.name, eventType: pkg.eventType } : null,
      appointments: appointments.map((a) => ({
        id: a.id,
        serviceName: a.service?.name || null,
        staffName: (a.onDutyStaff || !a.staff) ? null : a.staff?.name || null,
        onDutyStaff: a.onDutyStaff || !a.staff,
        date: a.date,
        startTime: a.startTime,
        endTime: a.endTime,
        totalPen: Number(a.totalPen || 0),
      })),
      salon: salon || {},
      culqiPublicKey: process.env.CULQI_PUBLIC_KEY || process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY || null,
    });
  } catch (err) { next(err); }
});

// ── POST /api/booking-payments/:id/culqi ──────────────────────
// Cobra el ADELANTO con tarjeta. Importe siempre desde DB (no manipulable).
const CulqiBody = z.object({
  culqiToken: z.string().min(10).max(120),
  email: z.string().regex(EMAIL_RE, 'email inválido').max(150),
}).strict();

router.post('/:id/culqi', validate({ body: CulqiBody }), async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return next(BadRequest('id inválido'));
    const { culqiToken, email } = req.body;

    const payment = await prisma.bookingPayment.findUnique({ where: { id: req.params.id } });
    if (!payment) return next(NotFound('Reserva no encontrada'));
    if (payment.status === 'paid') return next(Conflict('Este adelanto ya fue pagado'));

    // Si la reserva guardó email, debe coincidir (evita asociar tarjeta ajena).
    if (payment.customerEmail && payment.customerEmail.toLowerCase() !== email.toLowerCase()) {
      logger.warn('deposit_culqi_email_mismatch', { id: payment.id });
      return next(BadRequest('El email no coincide con el de la reserva'));
    }

    const amountCentimos = Math.round(Number(payment.depositPen) * 100);
    if (amountCentimos < 100) return next(BadRequest('Monto mínimo no alcanzado'));

    let charge;
    try {
      charge = await createCharge({
        token: culqiToken,
        amountCentimos,
        email,
        description: `Adelanto reserva ${payment.id.slice(-8).toUpperCase()} — Deyanira Makeup Beauty`,
        idempotencyKey: payment.id,
      });
    } catch (culqiErr) {
      if (culqiErr.culqiCode === 'already_exists') {
        // Ya cobrado con la misma idempotency key → liquidar si falta
        try {
          const settled = await markDepositPaid(prisma, payment.id, { method: 'culqi' });
          notifyPaid(settled, email);
          return res.json({ success: true, alreadyPaid: true, receiptNumber: settled.payment.receiptNumber });
        } catch (e) {
          if (e.status === 409) return res.json({ success: true, alreadyPaid: true });
          throw e;
        }
      }
      logger.warn('deposit_culqi_failed', { id: payment.id, code: culqiErr.culqiCode });
      return next(PaymentReq(culqiErr.message || 'Error procesando el pago'));
    }

    let settled;
    try {
      settled = await markDepositPaid(prisma, payment.id, { method: 'culqi', culqiChargeId: charge.id });
    } catch (e) {
      if (e.status === 409) return next(Conflict('Este adelanto ya fue pagado'));
      throw e;
    }
    notifyPaid(settled, email);
    res.json({ success: true, receiptNumber: settled.payment.receiptNumber });
  } catch (err) { next(err); }
});

// ── POST /api/booking-payments/:id/proof ──────────────────────
// Sube comprobante (Yape/Plin/transferencia). Queda en verificación del admin.
const ProofBody = z.object({
  image: z.string().startsWith('data:image/').max(8 * 1024 * 1024),
  method: z.enum(['yape', 'plin', 'transfer']),
}).strict();

router.post('/:id/proof', proofLimiter, validate({ body: ProofBody }), async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return next(BadRequest('id inválido'));
    const { image, method } = req.body;

    const payment = await prisma.bookingPayment.findUnique({ where: { id: req.params.id } });
    if (!payment) return next(NotFound('Reserva no encontrada'));
    if (payment.status === 'paid') return next(Conflict('Este adelanto ya fue confirmado'));

    const uploaded = await uploadImage(image, 'deposit-proofs');
    const updated = await prisma.bookingPayment.update({
      where: { id: payment.id },
      data: { proofImageUrl: uploaded.url, method, status: 'awaiting_verification' },
    });

    if (updated.customerEmail) {
      sendDepositProofReceived({ payment: updated, email: updated.customerEmail, name: updated.customerName })
        .catch((e) => logger.error('email_failed', { msg: e.message }));
    }
    sendDepositProofToSalon({ payment: updated })
      .catch((e) => logger.error('email_failed', { msg: e.message }));

    res.json({ success: true, status: 'awaiting_verification' });
  } catch (err) { next(err); }
});

// ── GET /api/booking-payments/:id/receipt ─────────────────────
// Recibo HTML (solo cuando el adelanto está pagado/verificado).
router.get('/:id/receipt', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return next(BadRequest('id inválido'));
    const payment = await prisma.bookingPayment.findUnique({ where: { id: req.params.id } });
    if (!payment) return next(NotFound('Reserva no encontrada'));
    if (payment.status !== 'paid') return next(BadRequest('El recibo estará disponible cuando se confirme el adelanto'));

    const { appointments, pkg } = await loadGroup(payment);
    const salon = await prisma.setting.findFirst();
    const html = renderBookingReceiptHtml({ payment, appointments, package: pkg, salon: salon || {} });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { next(err); }
});

// Envía confirmación + recibo al cliente tras pago con tarjeta.
function notifyPaid(settled, fallbackEmail) {
  const { payment, appointments, packageInfo } = settled;
  const email = payment.customerEmail || fallbackEmail;
  if (!email) return;
  sendBookingConfirmation({
    appointments, packageInfo, email, name: payment.customerName, atHomeExtraPen: 0,
  }).catch((e) => logger.error('email_failed', { msg: e.message }));
  sendDepositReceipt({ payment, appointments, packageInfo, email, name: payment.customerName })
    .catch((e) => logger.error('email_failed', { msg: e.message }));
}

module.exports = router;
