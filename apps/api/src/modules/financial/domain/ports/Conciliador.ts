// Puerto del Centro de Conciliación: detecta inconsistencias que el admin debe
// resolver (movimientos sin comprobante / sin categoría, adelantos pendientes,
// pagos incompletos y posibles duplicados). Solo lectura.

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';
import type { MovimientoPersistido } from './MovimientoRepositorio';

export interface AdelantoPendiente {
  readonly id: string;
  readonly customerName: string;
  readonly total: number;
  readonly deposit: number;
  readonly createdAt: string;
  readonly bookingGroupId: string | null;
}

export interface PagoIncompleto {
  readonly id: string;
  readonly customerName: string;
  readonly balancePen: number;
  readonly receiptNumber: string | null;
}

export interface GrupoDuplicado {
  readonly key: string;
  readonly movements: MovimientoPersistido[];
}

export interface ConciliacionResultado {
  readonly sinVoucher: { count: number; movements: MovimientoPersistido[] };
  readonly sinCategoria: { count: number; movements: MovimientoPersistido[] };
  readonly adelantosPendientes: { count: number; total: number; items: AdelantoPendiente[] };
  readonly pagosIncompletos: { count: number; total: number; items: PagoIncompleto[] };
  readonly duplicados: { count: number; groups: GrupoDuplicado[] };
  readonly totalPendientes: number;
}

export interface Conciliador {
  detectar(ctx: ContextoTenant): Promise<ConciliacionResultado>;
}
