// Traducción persistencia ↔ dominio para el módulo financiero. ÚNICO lugar (con
// los repositorios) donde se conoce la forma de las filas de Prisma.

import type { MovimientoPersistido } from '../domain/ports/MovimientoRepositorio';
import type { Direccion, TipoMovimiento, FuenteMovimiento, EstadoMovimiento } from '../domain/TipoMovimiento';

export function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

/** 'YYYY-MM-DD' de una columna @db.Date (UTC, sin desplazar el día). */
export function ymd(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return typeof v === 'string' ? v.slice(0, 10) : '';
}

export function iso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  return typeof v === 'string' ? v : null;
}

/** Date a guardar en columna @db.Date desde 'YYYY-MM-DD' (padding 12:00 UTC). */
export function fechaContable(ymdStr: string): Date {
  return new Date(`${ymdStr}T12:00:00Z`);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapMovimiento(row: any): MovimientoPersistido {
  return {
    id: row.id,
    direction: row.direction as Direccion,
    type: row.type as TipoMovimiento,
    status: row.status as EstadoMovimiento,
    amountPen: num(row.amountPen),
    category: row.category ?? null,
    description: row.description,
    occurredAt: ymd(row.occurredAt),
    paymentMethod: row.paymentMethod ?? null,
    source: row.source as FuenteMovimiento,
    appointmentId: row.appointmentId ?? null,
    bookingPaymentId: row.bookingPaymentId ?? null,
    orderId: row.orderId ?? null,
    expenseId: row.expenseId ?? null,
    otherIncomeId: row.otherIncomeId ?? null,
    customerId: row.customerId ?? null,
    staffId: row.staffId ?? null,
    accountId: row.accountId ?? null,
    account: row.account ? { id: row.account.id, name: row.account.name, type: row.account.type } : null,
    receiptUrl: row.receiptUrl ?? null,
    createdBy: row.createdBy ?? null,
    voidedAt: iso(row.voidedAt),
    voidReason: row.voidReason ?? null,
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
  };
}
