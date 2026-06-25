// Puerto de persistencia del libro mayor financiero. La implementación con Prisma
// vive en infrastructure/. Todos los métodos reciben ContextoTenant (seam SaaS,
// hoy single-tenant). Montos como números, fechas contables 'YYYY-MM-DD'.

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';
import type { Movimiento } from '../Movimiento';
import type {
  Direccion,
  TipoMovimiento,
  FuenteMovimiento,
  EstadoMovimiento,
} from '../TipoMovimiento';

export interface CuentaRef {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

export interface MovimientoPersistido {
  readonly id: string;
  readonly direction: Direccion;
  readonly type: TipoMovimiento;
  readonly status: EstadoMovimiento;
  readonly amountPen: number;
  readonly category: string | null;
  readonly description: string;
  readonly occurredAt: string; // 'YYYY-MM-DD'
  readonly paymentMethod: string | null;
  readonly source: FuenteMovimiento;
  readonly appointmentId: string | null;
  readonly bookingPaymentId: string | null;
  readonly orderId: string | null;
  readonly expenseId: string | null;
  readonly otherIncomeId: string | null;
  readonly customerId: string | null;
  readonly staffId: string | null;
  readonly accountId: string | null;
  readonly account: CuentaRef | null;
  readonly receiptUrl: string | null;
  readonly createdBy: string | null;
  readonly voidedAt: string | null;
  readonly voidReason: string | null;
  readonly createdAt: string;
}

export interface FiltrosMovimientos {
  readonly from: string | null; // 'YYYY-MM-DD'
  readonly to: string | null;
  readonly direction: Direccion | null;
  readonly type: TipoMovimiento | null;
  readonly source: FuenteMovimiento | null;
  readonly accountId: string | null;
  readonly q: string | null;
  readonly page: number;
  readonly pageSize: number;
  readonly incluirAnulados: boolean;
}

export interface PaginaMovimientos {
  readonly items: MovimientoPersistido[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Clave lógica de idempotencia para movimientos proyectados desde la operación. */
export interface ClaveOrigen {
  readonly source: FuenteMovimiento;
  readonly type: TipoMovimiento;
  readonly appointmentId?: string | null;
  readonly bookingPaymentId?: string | null;
  readonly orderId?: string | null;
  readonly expenseId?: string | null;
  readonly otherIncomeId?: string | null;
}

export interface MovimientoRepositorio {
  /** Inserta un movimiento ya validado. */
  guardar(ctx: ContextoTenant, mov: Movimiento): Promise<MovimientoPersistido>;

  /** Inserta solo si no existe ya uno con la misma clave de origen (idempotente).
   *  Devuelve el existente o el recién creado. */
  guardarIdempotente(
    ctx: ContextoTenant,
    mov: Movimiento,
    clave: ClaveOrigen,
  ): Promise<MovimientoPersistido>;

  /** Listado paginado con filtros (timeline / tabla). */
  listar(ctx: ContextoTenant, filtros: FiltrosMovimientos): Promise<PaginaMovimientos>;

  /** Marca un movimiento como anulado (status 'void') con motivo. */
  anular(
    ctx: ContextoTenant,
    id: string,
    motivo: string | null,
    anuladoPor: string | null,
  ): Promise<MovimientoPersistido>;

  /** Edición puntual de un movimiento (categoría, cuenta, método, descripción). */
  editar(
    ctx: ContextoTenant,
    id: string,
    cambios: { category?: string | null; accountId?: string | null; paymentMethod?: string | null; description?: string },
  ): Promise<MovimientoPersistido>;

  /** Sincroniza el movimiento espejo de un Expense/OtherIncome editado. */
  sincronizarDesdeCaptura(
    ctx: ContextoTenant,
    clave: ClaveOrigen,
    cambios: { amountPen?: number; description?: string; category?: string | null; occurredAt?: string; paymentMethod?: string | null },
  ): Promise<void>;

  /** Anula los movimientos ligados a una captura eliminada (Expense/OtherIncome). */
  anularPorOrigen(ctx: ContextoTenant, clave: ClaveOrigen): Promise<void>;
}
