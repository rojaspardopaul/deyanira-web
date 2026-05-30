// Lógica compartida para liquidar el adelanto de una reserva (paquete):
//   · pago con tarjeta (Culqi) del cliente,
//   · verificación de comprobante por el admin,
//   · registro manual del adelanto por el admin (efectivo/yape/transferencia).
// Genera el número de recibo y confirma las citas del grupo.
const prisma = require('../prisma');

function limaYmd() {
  // YYYY-MM-DD en zona America/Lima
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

// DMB-YYYYMMDD-### (secuencial por día). receiptNumber es @unique → reintenta en colisión.
async function generateReceiptNumber(db = prisma) {
  const ymd = limaYmd().replace(/-/g, '');
  const prefix = `DMB-${ymd}-`;
  const count = await db.bookingPayment.count({ where: { receiptNumber: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(3, '0')}`;
}

// Marca un BookingPayment como pagado, confirma las citas del grupo y devuelve
// { payment, appointments, packageInfo } para notificar/recibo.
// Lanza Error con .status 404/409 si no aplica.
async function markDepositPaid(db, paymentId, { method, paidPen, culqiChargeId = null, verifiedBy = null } = {}) {
  const payment = await db.bookingPayment.findUnique({ where: { id: paymentId } });
  if (!payment) { const e = new Error('Pago no encontrado'); e.status = 404; throw e; }
  if (payment.status === 'paid') { const e = new Error('Este adelanto ya fue registrado'); e.status = 409; throw e; }

  const total = Number(payment.totalPen);
  const paid = paidPen != null ? Number(paidPen) : Number(payment.depositPen);
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  const receiptNumber = payment.receiptNumber || (await generateReceiptNumber(db));

  // Update condicional (evita doble liquidación)
  const updRes = await db.bookingPayment.updateMany({
    where: { id: paymentId, status: { not: 'paid' } },
    data: {
      status: 'paid',
      method: method || payment.method,
      paidPen: paid,
      balancePen: balance,
      culqiChargeId: culqiChargeId || payment.culqiChargeId,
      receiptNumber,
      verifiedBy,
      verifiedAt: new Date(),
    },
  });
  if (updRes.count === 0) { const e = new Error('Este adelanto ya fue registrado'); e.status = 409; throw e; }

  // Confirmar las citas del grupo (pending → confirmed)
  await db.appointment.updateMany({
    where: { bookingGroupId: payment.bookingGroupId, status: 'pending' },
    data: { status: 'confirmed' },
  });

  const updated = await db.bookingPayment.findUnique({ where: { id: paymentId } });
  const appointments = await db.appointment.findMany({
    where: { bookingGroupId: payment.bookingGroupId },
    include: { service: true, staff: true, package: { include: { eventType: true } } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  const pkg = appointments.find((a) => a.package)?.package || null;
  const packageInfo = pkg
    ? { name: pkg.name, groupLabel: pkg.groupLabel, eventType: pkg.eventType }
    : null;

  return { payment: updated, appointments, packageInfo, package: pkg };
}

// Libera reservas cuyo adelanto sigue 'pending' (nunca pagado) pasadas N horas:
// marca el pago como 'expired' y cancela sus citas para soltar el horario.
// Devuelve el número de reservas liberadas.
async function releaseExpiredDeposits(db = prisma) {
  const setting = await db.setting.findFirst({ select: { depositExpiryHours: true } });
  const hours = Math.max(1, Number(setting?.depositExpiryHours || 24));
  const cutoff = new Date(Date.now() - hours * 3600 * 1000);

  const expired = await db.bookingPayment.findMany({
    where: { status: 'pending', createdAt: { lt: cutoff } },
    select: { id: true, bookingGroupId: true },
  });
  if (expired.length === 0) return 0;

  for (const p of expired) {
    await db.appointment.updateMany({
      where: { bookingGroupId: p.bookingGroupId, status: 'pending' },
      data: { status: 'cancelled' },
    });
    await db.bookingPayment.update({ where: { id: p.id }, data: { status: 'expired' } });
  }
  return expired.length;
}

module.exports = { generateReceiptNumber, markDepositPaid, limaYmd, releaseExpiredDeposits };
