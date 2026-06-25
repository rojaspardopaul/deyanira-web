// Backfill del libro mayor (financial_movements) a partir del histórico operativo.
// IDEMPOTENTE: reusa proyectarMovimiento (no duplica si ya existe el movimiento de
// ese origen), así que se puede correr varias veces sin riesgo.
//
// Uso:
//   tsx apps/api/scripts/backfill-financial-movements.js
//   (o)  npm --workspace apps/api run backfill:finanzas
//
// Regla de reconocimiento (igual que los hooks en vivo):
//   · Citas COMPLETADAS sin paquete → 'pago_final' (totalPen).
//   · Adelantos PAGADOS             → 'adelanto'   (paidPen).
//   · Pedidos PAGADOS               → 'venta'      (totalPen).
//   · Egresos / Otros ingresos      → espejo 'egreso' / 'ingreso'.

const prisma = require('../src/lib/prisma');
const { proyectarMovimiento } = require('../src/modules/financial');

const ymd = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const METODO_LEDGER = { cash: 'efectivo', transfer: 'transferencia', yape: 'yape', plin: 'plin', culqi: 'culqi' };

async function main() {
  let citas = 0, adelantos = 0, pedidos = 0, egresos = 0, ingresos = 0;

  // 1) Citas completadas individuales (sin paquete).
  const completadas = await prisma.appointment.findMany({
    where: { status: 'completed', packageId: null },
    include: { service: { select: { name: true } } },
  });
  for (const a of completadas) {
    const total = Number(a.totalPen) || 0;
    if (total <= 0) continue;
    await proyectarMovimiento({
      tipo: 'pago_final', monto: total, descripcion: `Servicio: ${a.service?.name || 'Servicio'}`,
      fecha: ymd(a.date), categoria: 'servicios', source: 'appointment',
      appointmentId: a.id, customerId: a.customerId || null, staffId: a.staffId || null,
    });
    citas++;
  }

  // 2) Adelantos pagados.
  const pagos = await prisma.bookingPayment.findMany({ where: { status: 'paid' } });
  for (const p of pagos) {
    const paid = Number(p.paidPen) || 0;
    if (paid <= 0) continue;
    await proyectarMovimiento({
      tipo: 'adelanto', monto: paid, descripcion: `Adelanto reserva ${p.receiptNumber || ''}`.trim(),
      fecha: ymd(p.verifiedAt || p.createdAt), categoria: 'adelanto',
      metodoPago: METODO_LEDGER[p.method] || p.method || null,
      source: 'booking_payment', bookingPaymentId: p.id, customerId: p.customerId || null,
    });
    adelantos++;
  }

  // 3) Pedidos pagados.
  const orders = await prisma.order.findMany({ where: { paymentStatus: 'paid' } });
  for (const o of orders) {
    const total = Number(o.totalPen) || 0;
    if (total <= 0) continue;
    await proyectarMovimiento({
      tipo: 'venta', monto: total, descripcion: 'Pedido de productos', fecha: ymd(o.createdAt),
      categoria: 'productos', metodoPago: o.paymentMethod || null, source: 'order',
      orderId: o.id, customerId: o.customerId || null,
    });
    pedidos++;
  }

  // 4) Egresos.
  const expenses = await prisma.expense.findMany();
  for (const e of expenses) {
    await proyectarMovimiento({
      tipo: 'egreso', monto: Number(e.amountPen), descripcion: e.description, fecha: ymd(e.date),
      categoria: e.category, metodoPago: e.paymentMethod || null, source: 'expense',
      expenseId: e.id, receiptUrl: e.receiptUrl || null,
    });
    egresos++;
  }

  // 5) Otros ingresos.
  const others = await prisma.otherIncome.findMany();
  for (const oi of others) {
    await proyectarMovimiento({
      tipo: 'ingreso', monto: Number(oi.amountPen), descripcion: oi.description, fecha: ymd(oi.date),
      categoria: oi.category, source: 'other_income', otherIncomeId: oi.id,
    });
    ingresos++;
  }

  const total = await prisma.financialMovement.count();
  console.log('Backfill financiero completado (idempotente):');
  console.table({ citas, adelantos, pedidos, egresos, ingresos, total_en_ledger: total });
}

main()
  .catch((err) => { console.error('Backfill falló:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
