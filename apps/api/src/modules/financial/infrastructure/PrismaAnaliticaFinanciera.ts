// Modelo de lectura analítico (KPIs + series + desgloses) con Prisma. Lee del
// libro mayor para el dinero movido y de fuentes operativas (BookingPayment,
// Appointment) para los KPIs de estado (adelantos pendientes, por cobrar,
// clientes atendidos).

import type { PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type {
  AnaliticaFinanciera,
  ResumenFinancieroResultado,
  PuntoSerie,
  Totales,
  DesgloseItem,
} from '../domain/ports/AnaliticaFinanciera';
import { num, fechaContable } from './mappers';

function limaYmd(d = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export class PrismaAnaliticaFinanciera implements AnaliticaFinanciera {
  constructor(private readonly prisma: PrismaClient) {}

  // Totales (ingresos/egresos/utilidad) del libro mayor en un rango de fechas.
  private async totales(from: string, to: string): Promise<Totales> {
    const groups = await this.prisma.financialMovement.groupBy({
      by: ['direction'],
      where: {
        status: 'settled',
        occurredAt: { gte: fechaContable(from), lte: fechaContable(to) },
      },
      _sum: { amountPen: true },
    });
    let ingresos = 0;
    let egresos = 0;
    for (const g of groups) {
      if (g.direction === 'in') ingresos = num(g._sum.amountPen);
      else egresos = num(g._sum.amountPen);
    }
    return { ingresos: round2(ingresos), egresos: round2(egresos), utilidad: round2(ingresos - egresos) };
  }

  async resumen(_ctx: ContextoTenant, from: string, to: string): Promise<ResumenFinancieroResultado> {
    const hoyYmd = limaYmd();

    // Período anterior de igual longitud para la variación.
    const dFrom = new Date(`${from}T00:00:00Z`);
    const dTo = new Date(`${to}T00:00:00Z`);
    const lenMs = Math.max(0, dTo.getTime() - dFrom.getTime());
    const prevTo = new Date(dFrom.getTime() - 24 * 3600 * 1000);
    const prevFrom = new Date(prevTo.getTime() - lenMs);
    const prevFromYmd = prevFrom.toISOString().slice(0, 10);
    const prevToYmd = prevTo.toISOString().slice(0, 10);

    const rango = { gte: fechaContable(from), lte: fechaContable(to) };

    const [
      periodo,
      hoy,
      anterior,
      cajaGroups,
      adelantos,
      porCobrar,
      ventas,
      servicios,
      clientes,
      catGroups,
      metodoGroups,
      tipoGroups,
      ingresoCount,
    ] = await Promise.all([
      this.totales(from, to),
      this.totales(hoyYmd, hoyYmd),
      this.totales(prevFromYmd, prevToYmd),
      // Caja disponible: neto de TODO el histórico settled.
      this.prisma.financialMovement.groupBy({
        by: ['direction'], where: { status: 'settled' }, _sum: { amountPen: true },
      }),
      // Adelantos pendientes de cobro (reserva sin pagar todavía).
      this.prisma.bookingPayment.aggregate({
        where: { status: 'pending' }, _sum: { depositPen: true }, _count: { id: true },
      }),
      // Cuentas por cobrar: saldo pendiente de reservas ya con adelanto pagado.
      this.prisma.bookingPayment.aggregate({
        where: { status: 'paid', balancePen: { gt: 0 } }, _sum: { balancePen: true }, _count: { id: true },
      }),
      // Ventas de productos (ledger) del período.
      this.prisma.financialMovement.aggregate({
        where: { status: 'settled', source: 'order', occurredAt: rango }, _sum: { amountPen: true }, _count: { id: true },
      }),
      // Servicios vendidos (citas) del período.
      this.prisma.financialMovement.aggregate({
        where: { status: 'settled', source: 'appointment', occurredAt: rango }, _sum: { amountPen: true }, _count: { id: true },
      }),
      // Clientes atendidos: citas completadas distintas por cliente en el período.
      this.prisma.appointment.findMany({
        where: { status: 'completed', date: rango, customerId: { not: null } },
        distinct: ['customerId'], select: { customerId: true },
      }),
      // Desglose de egresos por categoría.
      this.prisma.financialMovement.groupBy({
        by: ['category'], where: { status: 'settled', direction: 'out', occurredAt: rango },
        _sum: { amountPen: true }, _count: { id: true },
      }),
      // Ingresos por método de pago.
      this.prisma.financialMovement.groupBy({
        by: ['paymentMethod'], where: { status: 'settled', direction: 'in', occurredAt: rango },
        _sum: { amountPen: true }, _count: { id: true },
      }),
      // Movimientos por tipo.
      this.prisma.financialMovement.groupBy({
        by: ['type'], where: { status: 'settled', occurredAt: rango },
        _sum: { amountPen: true }, _count: { id: true },
      }),
      this.prisma.financialMovement.count({ where: { status: 'settled', direction: 'in', occurredAt: rango } }),
    ]);

    let caja = 0;
    for (const g of cajaGroups) caja += (g.direction === 'in' ? 1 : -1) * num(g._sum.amountPen);

    const toItem = (key: string | null, sum: unknown, count: number): DesgloseItem => ({
      key: key ?? 'sin_categoria',
      label: key ?? 'Sin categoría',
      total: round2(num(sum)),
      count,
    });

    const margen = periodo.ingresos > 0 ? round2((periodo.utilidad / periodo.ingresos) * 100) : 0;
    const ticketPromedio = ingresoCount > 0 ? round2(periodo.ingresos / ingresoCount) : 0;

    return {
      periodo: { from, to },
      hoy,
      periodoActual: { ...periodo, variacion: anterior },
      margen,
      cajaDisponible: round2(caja),
      adelantosPendientes: { total: round2(num(adelantos._sum.depositPen)), count: adelantos._count.id },
      cuentasPorCobrar: { total: round2(num(porCobrar._sum.balancePen)), count: porCobrar._count.id },
      ventasProductos: { total: round2(num(ventas._sum.amountPen)), count: ventas._count.id },
      serviciosVendidos: { total: round2(num(servicios._sum.amountPen)), count: servicios._count.id },
      clientesAtendidos: clientes.length,
      ticketPromedio,
      porCategoria: catGroups
        .map((g) => toItem(g.category, g._sum.amountPen, g._count.id))
        .sort((a, b) => b.total - a.total),
      porMetodoPago: metodoGroups
        .map((g) => toItem(g.paymentMethod, g._sum.amountPen, g._count.id))
        .sort((a, b) => b.total - a.total),
      porTipo: tipoGroups
        .map((g) => toItem(g.type, g._sum.amountPen, g._count.id))
        .sort((a, b) => b.total - a.total),
    };
  }

  async serieMensual(_ctx: ContextoTenant, year: number): Promise<PuntoSerie[]> {
    const desde = fechaContable(`${year}-01-01`);
    const hasta = fechaContable(`${year}-12-31`);
    // groupBy no permite extraer el mes; traemos filas ligeras y agregamos en memoria.
    const rows = await this.prisma.financialMovement.findMany({
      where: { status: 'settled', occurredAt: { gte: desde, lte: hasta } },
      select: { direction: true, amountPen: true, occurredAt: true },
    });

    const meses = Array.from({ length: 12 }, (_, m) => ({ month: m + 1, income: 0, expenses: 0 }));
    for (const r of rows) {
      const m = (r.occurredAt instanceof Date ? r.occurredAt.getUTCMonth() : 0);
      const slot = meses[m];
      if (r.direction === 'in') slot.income += num(r.amountPen);
      else slot.expenses += num(r.amountPen);
    }
    return meses.map((s): PuntoSerie => ({
      month: s.month,
      year,
      income: round2(s.income),
      expenses: round2(s.expenses),
      profit: round2(s.income - s.expenses),
    }));
  }
}
