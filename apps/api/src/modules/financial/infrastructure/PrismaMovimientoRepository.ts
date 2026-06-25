// Adaptador de persistencia del libro mayor con Prisma. ÚNICO lugar del módulo
// (con los otros repos) donde se importa Prisma. Implementa MovimientoRepositorio.

import type { PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { Movimiento } from '../domain/Movimiento';
import { MovimientoNoEncontradoError, MovimientoAnuladoError } from '../domain/errors';
import type {
  MovimientoRepositorio,
  MovimientoPersistido,
  FiltrosMovimientos,
  PaginaMovimientos,
  ClaveOrigen,
} from '../domain/ports/MovimientoRepositorio';
import { mapMovimiento, fechaContable } from './mappers';

const INCLUDE = { account: { select: { id: true, name: true, type: true } } };

// Construye el filtro Prisma que identifica el movimiento de un origen concreto.
function whereOrigen(clave: ClaveOrigen): Record<string, unknown> {
  const w: Record<string, unknown> = { source: clave.source, type: clave.type, status: { not: 'void' } };
  if (clave.appointmentId) w.appointmentId = clave.appointmentId;
  if (clave.bookingPaymentId) w.bookingPaymentId = clave.bookingPaymentId;
  if (clave.orderId) w.orderId = clave.orderId;
  if (clave.expenseId) w.expenseId = clave.expenseId;
  if (clave.otherIncomeId) w.otherIncomeId = clave.otherIncomeId;
  return w;
}

function datosCreacion(mov: Movimiento): Record<string, unknown> {
  const d = mov.datos;
  return {
    direction: mov.direccion,
    type: mov.tipo,
    status: 'settled',
    amountPen: mov.monto,
    category: d.categoria ?? null,
    description: mov.descripcion,
    occurredAt: fechaContable(mov.fecha),
    paymentMethod: d.metodoPago ?? null,
    source: d.source,
    appointmentId: d.appointmentId ?? null,
    bookingPaymentId: d.bookingPaymentId ?? null,
    orderId: d.orderId ?? null,
    expenseId: d.expenseId ?? null,
    otherIncomeId: d.otherIncomeId ?? null,
    customerId: d.customerId ?? null,
    staffId: d.staffId ?? null,
    accountId: d.accountId ?? null,
    receiptUrl: d.receiptUrl ?? null,
    createdBy: d.createdBy ?? null,
  };
}

export class PrismaMovimientoRepository implements MovimientoRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  // NOTA tenant: hoy ctx no filtra (single-tenant). Mañana se añade el scoping aquí.

  async guardar(_ctx: ContextoTenant, mov: Movimiento): Promise<MovimientoPersistido> {
    const row = await this.prisma.financialMovement.create({
      data: datosCreacion(mov) as never,
      include: INCLUDE,
    });
    return mapMovimiento(row);
  }

  async guardarIdempotente(
    _ctx: ContextoTenant,
    mov: Movimiento,
    clave: ClaveOrigen,
  ): Promise<MovimientoPersistido> {
    const existente = await this.prisma.financialMovement.findFirst({
      where: whereOrigen(clave) as never,
      include: INCLUDE,
    });
    if (existente) return mapMovimiento(existente);
    const row = await this.prisma.financialMovement.create({
      data: datosCreacion(mov) as never,
      include: INCLUDE,
    });
    return mapMovimiento(row);
  }

  async listar(_ctx: ContextoTenant, f: FiltrosMovimientos): Promise<PaginaMovimientos> {
    const where: Record<string, unknown> = {};
    if (!f.incluirAnulados) where.status = { not: 'void' };
    if (f.from || f.to) {
      where.occurredAt = {
        ...(f.from ? { gte: fechaContable(f.from) } : {}),
        ...(f.to ? { lte: fechaContable(f.to) } : {}),
      };
    }
    if (f.direction) where.direction = f.direction;
    if (f.type) where.type = f.type;
    if (f.source) where.source = f.source;
    if (f.accountId) where.accountId = f.accountId;
    if (f.q) {
      where.OR = [
        { description: { contains: f.q.trim(), mode: 'insensitive' } },
        { category: { contains: f.q.trim(), mode: 'insensitive' } },
      ];
    }

    const page = Math.max(1, f.page);
    const pageSize = Math.min(200, Math.max(1, f.pageSize));
    const [total, rows] = await Promise.all([
      this.prisma.financialMovement.count({ where: where as never }),
      this.prisma.financialMovement.findMany({
        where: where as never,
        include: INCLUDE,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rows.map(mapMovimiento), total, page, pageSize };
  }

  async anular(
    _ctx: ContextoTenant,
    id: string,
    motivo: string | null,
    anuladoPor: string | null,
  ): Promise<MovimientoPersistido> {
    const existente = await this.prisma.financialMovement.findUnique({ where: { id } });
    if (!existente) throw new MovimientoNoEncontradoError('Movimiento no encontrado');
    if (existente.status === 'void') throw new MovimientoAnuladoError('El movimiento ya está anulado');
    const row = await this.prisma.financialMovement.update({
      where: { id },
      data: {
        status: 'void',
        voidedAt: new Date(),
        voidReason: motivo ? String(motivo).slice(0, 300) : null,
        createdBy: existente.createdBy ?? anuladoPor,
      },
      include: INCLUDE,
    });
    return mapMovimiento(row);
  }

  async editar(
    _ctx: ContextoTenant,
    id: string,
    cambios: { category?: string | null; accountId?: string | null; paymentMethod?: string | null; description?: string },
  ): Promise<MovimientoPersistido> {
    const existente = await this.prisma.financialMovement.findUnique({ where: { id } });
    if (!existente) throw new MovimientoNoEncontradoError('Movimiento no encontrado');
    if (existente.status === 'void') throw new MovimientoAnuladoError('No se puede editar un movimiento anulado');
    const data: Record<string, unknown> = {};
    if (cambios.category !== undefined) data.category = cambios.category;
    if (cambios.accountId !== undefined) data.accountId = cambios.accountId;
    if (cambios.paymentMethod !== undefined) data.paymentMethod = cambios.paymentMethod;
    if (cambios.description !== undefined) data.description = String(cambios.description).slice(0, 300);
    const row = await this.prisma.financialMovement.update({ where: { id }, data: data as never, include: INCLUDE });
    return mapMovimiento(row);
  }

  async sincronizarDesdeCaptura(
    _ctx: ContextoTenant,
    clave: ClaveOrigen,
    cambios: { amountPen?: number; description?: string; category?: string | null; occurredAt?: string; paymentMethod?: string | null },
  ): Promise<void> {
    const data: Record<string, unknown> = {};
    if (cambios.amountPen != null) data.amountPen = cambios.amountPen;
    if (cambios.description != null) data.description = String(cambios.description).slice(0, 300);
    if (cambios.category !== undefined) data.category = cambios.category;
    if (cambios.occurredAt) data.occurredAt = fechaContable(cambios.occurredAt);
    if (cambios.paymentMethod !== undefined) data.paymentMethod = cambios.paymentMethod;
    if (Object.keys(data).length === 0) return;
    await this.prisma.financialMovement.updateMany({ where: whereOrigen(clave) as never, data: data as never });
  }

  async anularPorOrigen(_ctx: ContextoTenant, clave: ClaveOrigen): Promise<void> {
    await this.prisma.financialMovement.updateMany({
      where: whereOrigen(clave) as never,
      data: { status: 'void', voidedAt: new Date(), voidReason: 'Origen eliminado' },
    });
  }
}
