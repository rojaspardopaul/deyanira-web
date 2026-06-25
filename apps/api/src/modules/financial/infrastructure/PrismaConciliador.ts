// Implementación del Centro de Conciliación con Prisma. Combina el libro mayor
// (movimientos sin comprobante/categoría, duplicados) con las reservas
// (adelantos pendientes, saldos por cobrar).

import type { PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type {
  Conciliador,
  ConciliacionResultado,
  AdelantoPendiente,
  PagoIncompleto,
  GrupoDuplicado,
} from '../domain/ports/Conciliador';
import type { MovimientoPersistido } from '../domain/ports/MovimientoRepositorio';
import { mapMovimiento, num, iso } from './mappers';

const INCLUDE = { account: { select: { id: true, name: true, type: true } } };
const LIMITE = 50;

export class PrismaConciliador implements Conciliador {
  constructor(private readonly prisma: PrismaClient) {}

  async detectar(_ctx: ContextoTenant): Promise<ConciliacionResultado> {
    const [sinVoucherRows, sinCategoriaRows, adelantos, porCobrar, posiblesDup] = await Promise.all([
      // Egresos liquidados sin comprobante adjunto.
      this.prisma.financialMovement.findMany({
        where: { status: 'settled', direction: 'out', receiptUrl: null },
        include: INCLUDE, orderBy: { occurredAt: 'desc' }, take: LIMITE,
      }),
      // Movimientos sin categoría.
      this.prisma.financialMovement.findMany({
        where: { status: 'settled', OR: [{ category: null }, { category: '' }] },
        include: INCLUDE, orderBy: { occurredAt: 'desc' }, take: LIMITE,
      }),
      this.prisma.bookingPayment.findMany({
        where: { status: 'pending' }, orderBy: { createdAt: 'desc' }, take: LIMITE,
      }),
      this.prisma.bookingPayment.findMany({
        where: { status: 'paid', balancePen: { gt: 0 } }, orderBy: { createdAt: 'desc' }, take: LIMITE,
      }),
      // Candidatos a duplicado: mismo (tipo, monto, fecha, origen) repetido.
      this.prisma.financialMovement.groupBy({
        by: ['type', 'amountPen', 'occurredAt', 'source'],
        where: { status: 'settled' },
        _count: { id: true },
        having: { id: { _count: { gt: 1 } } },
        orderBy: { occurredAt: 'desc' },
        take: 30,
      }),
    ]);

    const sinVoucher = sinVoucherRows.map(mapMovimiento);
    const sinCategoria = sinCategoriaRows.map(mapMovimiento);

    const adelantosItems: AdelantoPendiente[] = adelantos.map((p) => ({
      id: p.id,
      customerName: p.customerName || 'Cliente',
      total: num(p.totalPen),
      deposit: num(p.depositPen),
      createdAt: iso(p.createdAt) ?? '',
      bookingGroupId: p.bookingGroupId ?? null,
    }));

    const pagosItems: PagoIncompleto[] = porCobrar.map((p) => ({
      id: p.id,
      customerName: p.customerName || 'Cliente',
      balancePen: num(p.balancePen),
      receiptNumber: p.receiptNumber ?? null,
    }));

    // Para cada grupo duplicado, traemos los movimientos reales (máx 5 grupos).
    const groups: GrupoDuplicado[] = [];
    for (const g of posiblesDup.slice(0, 8)) {
      const movs = await this.prisma.financialMovement.findMany({
        where: { status: 'settled', type: g.type, amountPen: g.amountPen, occurredAt: g.occurredAt, source: g.source },
        include: INCLUDE, take: 6,
      });
      if (movs.length > 1) {
        groups.push({
          key: `${g.type}-${num(g.amountPen)}-${iso(g.occurredAt)?.slice(0, 10)}`,
          movements: movs.map(mapMovimiento) as MovimientoPersistido[],
        });
      }
    }

    const totalPendientes =
      sinVoucher.length + sinCategoria.length + adelantosItems.length + pagosItems.length + groups.length;

    return {
      sinVoucher: { count: sinVoucher.length, movements: sinVoucher },
      sinCategoria: { count: sinCategoria.length, movements: sinCategoria },
      adelantosPendientes: { count: adelantosItems.length, total: adelantosItems.reduce((s, a) => s + a.deposit, 0), items: adelantosItems },
      pagosIncompletos: { count: pagosItems.length, total: pagosItems.reduce((s, p) => s + p.balancePen, 0), items: pagosItems },
      duplicados: { count: groups.length, groups },
      totalPendientes,
    };
  }
}
