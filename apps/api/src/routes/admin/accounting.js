const { Router } = require('express');
const prisma = require('../../lib/prisma');
const { isAdmin } = require('../../middleware/auth');
const { proyectarMovimiento, sincronizarCaptura, anularMovimientosDeOrigen } = require('../../modules/financial');

const router = Router();

// 'YYYY-MM-DD' de una columna @db.Date (sin desplazar el día).
function ymd(d) {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

router.use(isAdmin);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXPENSE_CATEGORIES = [
  'alquiler', 'salarios', 'productos', 'servicios_pub',
  'marketing', 'equipos', 'mantenimiento', 'transporte', 'impuestos', 'otro',
];
const OTHER_INCOME_CATEGORIES = ['servicios_externos', 'cursos', 'alquiler_espacio', 'otro'];
const PAYMENT_METHODS = ['efectivo', 'transferencia', 'tarjeta', 'yape'];

function parseDateRange(from, to) {
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return null;
  }
  return {
    from: new Date(from + 'T00:00:00Z'),
    to: new Date(to + 'T23:59:59Z'),
  };
}

function pick(obj, keys) {
  const r = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) r[k] = obj[k];
  }
  return r;
}

// ── GET /api/admin/accounting/summary ───────────────────────
// Resumen consolidado del período: ingresos, egresos, utilidad
router.get('/summary', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const range = parseDateRange(from, to);
    if (!range) {
      return res.status(400).json({ error: 'Parámetros from y to requeridos (YYYY-MM-DD)' });
    }

    const [apptAgg, orderAgg, otherAgg, expenseGroups] = await Promise.all([
      // Ingresos por citas completadas
      prisma.appointment.aggregate({
        where: { date: { gte: range.from, lte: range.to }, status: 'completed' },
        _sum: { totalPen: true },
        _count: { id: true },
      }),
      // Ingresos por pedidos pagados
      prisma.order.aggregate({
        where: { createdAt: { gte: range.from, lte: range.to }, paymentStatus: 'paid' },
        _sum: { totalPen: true },
        _count: { id: true },
      }),
      // Otros ingresos
      prisma.otherIncome.aggregate({
        where: { date: { gte: range.from, lte: range.to } },
        _sum: { amountPen: true },
        _count: { id: true },
      }),
      // Egresos agrupados por categoría
      prisma.expense.groupBy({
        by: ['category'],
        where: { date: { gte: range.from, lte: range.to } },
        _sum: { amountPen: true },
        _count: { id: true },
      }),
    ]);

    const appointmentsTotal = Number(apptAgg._sum.totalPen || 0);
    const ordersTotal = Number(orderAgg._sum.totalPen || 0);
    const otherTotal = Number(otherAgg._sum.amountPen || 0);
    const totalIncome = appointmentsTotal + ordersTotal + otherTotal;

    const totalExpenses = expenseGroups.reduce(
      (sum, g) => sum + Number(g._sum.amountPen || 0), 0
    );

    const profit = totalIncome - totalExpenses;
    const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

    res.json({
      period: { from, to },
      income: {
        appointments: { total: appointmentsTotal, count: apptAgg._count.id },
        orders: { total: ordersTotal, count: orderAgg._count.id },
        other: { total: otherTotal, count: otherAgg._count.id },
        total: totalIncome,
      },
      expenses: {
        total: totalExpenses,
        breakdown: expenseGroups.map(g => ({
          category: g.category,
          total: Number(g._sum.amountPen || 0),
          count: g._count.id,
        })),
      },
      profit: Math.round(profit * 100) / 100,
      margin: Math.round(margin * 10) / 10,
    });
  } catch (err) { next(err); }
});

// ── GET /api/admin/accounting/monthly?year=YYYY ─────────────
// Ingresos y egresos mes a mes para el gráfico anual
router.get('/monthly', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    if (year < 2020 || year > 2100) {
      return res.status(400).json({ error: 'Año inválido' });
    }

    const months = await Promise.all(
      Array.from({ length: 12 }, (_, m) => {
        const from = new Date(year, m, 1);
        const to = new Date(year, m + 1, 0, 23, 59, 59);

        return Promise.all([
          prisma.appointment.aggregate({
            where: { date: { gte: from, lte: to }, status: 'completed' },
            _sum: { totalPen: true },
          }),
          prisma.order.aggregate({
            where: { createdAt: { gte: from, lte: to }, paymentStatus: 'paid' },
            _sum: { totalPen: true },
          }),
          prisma.otherIncome.aggregate({
            where: { date: { gte: from, lte: to } },
            _sum: { amountPen: true },
          }),
          prisma.expense.aggregate({
            where: { date: { gte: from, lte: to } },
            _sum: { amountPen: true },
          }),
        ]).then(([appt, order, other, exp]) => {
          const income =
            Number(appt._sum.totalPen || 0) +
            Number(order._sum.totalPen || 0) +
            Number(other._sum.amountPen || 0);
          const expenses = Number(exp._sum.amountPen || 0);
          return { month: m + 1, year, income, expenses, profit: income - expenses };
        });
      })
    );

    res.json(months);
  } catch (err) { next(err); }
});

// ── EGRESOS ──────────────────────────────────────────────────

router.get('/expenses', async (req, res, next) => {
  try {
    const { from, to, category } = req.query;
    const where = {};
    const range = parseDateRange(from, to);
    if (range) where.date = { gte: range.from, lte: range.to };
    if (category && EXPENSE_CATEGORIES.includes(category)) where.category = category;

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    res.json(expenses);
  } catch (err) { next(err); }
});

router.post('/expenses', async (req, res, next) => {
  try {
    const data = pick(req.body, [
      'date', 'category', 'description', 'amountPen',
      'paymentMethod', 'receiptUrl', 'notes',
    ]);

    if (!data.date || !DATE_RE.test(data.date)) {
      return res.status(400).json({ error: 'Fecha inválida (YYYY-MM-DD)' });
    }
    if (!EXPENSE_CATEGORIES.includes(data.category)) {
      return res.status(400).json({ error: 'Categoría inválida' });
    }
    if (!data.description || String(data.description).trim().length === 0) {
      return res.status(400).json({ error: 'Descripción requerida' });
    }
    data.amountPen = Number(data.amountPen);
    if (isNaN(data.amountPen) || data.amountPen <= 0) {
      return res.status(400).json({ error: 'Monto debe ser mayor a 0' });
    }
    if (data.paymentMethod && !PAYMENT_METHODS.includes(data.paymentMethod)) {
      return res.status(400).json({ error: 'Método de pago inválido' });
    }

    data.date = new Date(data.date + 'T12:00:00Z');
    data.description = String(data.description).slice(0, 300);
    if (data.notes) data.notes = String(data.notes).slice(0, 500);

    const expense = await prisma.expense.create({ data });
    // Proyección espejo al libro mayor (egreso). Fire-and-forget, idempotente.
    proyectarMovimiento({
      tipo: 'egreso',
      monto: Number(expense.amountPen),
      descripcion: expense.description,
      fecha: ymd(expense.date),
      categoria: expense.category,
      metodoPago: expense.paymentMethod || null,
      source: 'expense',
      expenseId: expense.id,
      receiptUrl: expense.receiptUrl || null,
    }).catch(() => {});
    res.status(201).json(expense);
  } catch (err) { next(err); }
});

router.patch('/expenses/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const data = pick(req.body, [
      'date', 'category', 'description', 'amountPen',
      'paymentMethod', 'receiptUrl', 'notes',
    ]);

    if (data.date) {
      if (!DATE_RE.test(data.date)) return res.status(400).json({ error: 'Fecha inválida' });
      data.date = new Date(data.date + 'T12:00:00Z');
    }
    if (data.category && !EXPENSE_CATEGORIES.includes(data.category)) {
      return res.status(400).json({ error: 'Categoría inválida' });
    }
    if (data.amountPen != null) {
      data.amountPen = Number(data.amountPen);
      if (isNaN(data.amountPen) || data.amountPen <= 0) {
        return res.status(400).json({ error: 'Monto debe ser mayor a 0' });
      }
    }
    if (data.paymentMethod && !PAYMENT_METHODS.includes(data.paymentMethod)) {
      return res.status(400).json({ error: 'Método de pago inválido' });
    }
    if (data.description) data.description = String(data.description).slice(0, 300);
    if (data.notes) data.notes = String(data.notes).slice(0, 500);

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data,
    });
    // Sincroniza el movimiento espejo con los campos editados.
    sincronizarCaptura(
      { source: 'expense', type: 'egreso', expenseId: expense.id },
      {
        amountPen: Number(expense.amountPen),
        description: expense.description,
        category: expense.category,
        occurredAt: ymd(expense.date),
        paymentMethod: expense.paymentMethod || null,
      },
    ).catch(() => {});
    res.json(expense);
  } catch (err) { next(err); }
});

router.delete('/expenses/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    await prisma.expense.delete({ where: { id: req.params.id } });
    // Anula (no borra) el movimiento espejo para conservar la traza.
    anularMovimientosDeOrigen({ source: 'expense', type: 'egreso', expenseId: req.params.id }).catch(() => {});
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── OTROS INGRESOS ──────────────────────────────────────────

router.get('/other-income', async (req, res, next) => {
  try {
    const { from, to, category } = req.query;
    const where = {};
    const range = parseDateRange(from, to);
    if (range) where.date = { gte: range.from, lte: range.to };
    if (category && OTHER_INCOME_CATEGORIES.includes(category)) where.category = category;

    const income = await prisma.otherIncome.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    res.json(income);
  } catch (err) { next(err); }
});

router.post('/other-income', async (req, res, next) => {
  try {
    const data = pick(req.body, ['date', 'category', 'description', 'amountPen', 'notes']);

    if (!data.date || !DATE_RE.test(data.date)) {
      return res.status(400).json({ error: 'Fecha inválida (YYYY-MM-DD)' });
    }
    if (!OTHER_INCOME_CATEGORIES.includes(data.category)) {
      return res.status(400).json({ error: 'Categoría inválida' });
    }
    if (!data.description || String(data.description).trim().length === 0) {
      return res.status(400).json({ error: 'Descripción requerida' });
    }
    data.amountPen = Number(data.amountPen);
    if (isNaN(data.amountPen) || data.amountPen <= 0) {
      return res.status(400).json({ error: 'Monto debe ser mayor a 0' });
    }

    data.date = new Date(data.date + 'T12:00:00Z');
    data.description = String(data.description).slice(0, 300);
    if (data.notes) data.notes = String(data.notes).slice(0, 500);

    const income = await prisma.otherIncome.create({ data });
    // Proyección espejo al libro mayor (ingreso). Fire-and-forget, idempotente.
    proyectarMovimiento({
      tipo: 'ingreso',
      monto: Number(income.amountPen),
      descripcion: income.description,
      fecha: ymd(income.date),
      categoria: income.category,
      source: 'other_income',
      otherIncomeId: income.id,
    }).catch(() => {});
    res.status(201).json(income);
  } catch (err) { next(err); }
});

router.patch('/other-income/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const data = pick(req.body, ['date', 'category', 'description', 'amountPen', 'notes']);

    if (data.date) {
      if (!DATE_RE.test(data.date)) return res.status(400).json({ error: 'Fecha inválida' });
      data.date = new Date(data.date + 'T12:00:00Z');
    }
    if (data.category && !OTHER_INCOME_CATEGORIES.includes(data.category)) {
      return res.status(400).json({ error: 'Categoría inválida' });
    }
    if (data.amountPen != null) {
      data.amountPen = Number(data.amountPen);
      if (isNaN(data.amountPen) || data.amountPen <= 0) {
        return res.status(400).json({ error: 'Monto debe ser mayor a 0' });
      }
    }
    if (data.description) data.description = String(data.description).slice(0, 300);
    if (data.notes) data.notes = String(data.notes).slice(0, 500);

    const income = await prisma.otherIncome.update({
      where: { id: req.params.id },
      data,
    });
    sincronizarCaptura(
      { source: 'other_income', type: 'ingreso', otherIncomeId: income.id },
      {
        amountPen: Number(income.amountPen),
        description: income.description,
        category: income.category,
        occurredAt: ymd(income.date),
      },
    ).catch(() => {});
    res.json(income);
  } catch (err) { next(err); }
});

router.delete('/other-income/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    await prisma.otherIncome.delete({ where: { id: req.params.id } });
    anularMovimientosDeOrigen({ source: 'other_income', type: 'ingreso', otherIncomeId: req.params.id }).catch(() => {});
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
