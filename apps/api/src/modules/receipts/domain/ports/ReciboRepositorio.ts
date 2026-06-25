// Puerto de persistencia de recibos (Receipt + ReceiptItem + ReceiptPayment).
// La implementación con Prisma vive en infrastructure/. El dominio solo conoce
// esta interfaz. Todos los métodos reciben ContextoTenant (seam multiempresa).

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';

export interface ItemRecibo {
  readonly description: string;
  readonly qty: number;
  readonly unitPen: number;
  readonly amountPen: number;
}

export interface PagoRecibo {
  readonly id: string;
  readonly amountPen: number;
  readonly method: string;
  readonly paidAt: string;
  readonly note: string | null;
  readonly proofImageUrl: string | null;
  readonly registeredBy: string | null;
  readonly createdAt: string;
}

/** Recibo completo ya persistido (montos como números, fechas ISO). */
export interface ReciboPersistido {
  readonly id: string;
  readonly receiptNumber: string;
  readonly customerId: string | null;
  readonly customerName: string;
  readonly customerEmail: string | null;
  readonly customerPhone: string | null;
  readonly title: string | null;
  readonly totalPen: number;
  readonly paidPen: number;
  readonly balancePen: number;
  readonly status: string; // pending | partial | paid | cancelled
  readonly bookingGroupId: string | null;
  readonly packageId: string | null;
  readonly notes: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly items: ItemRecibo[];
  readonly payments: PagoRecibo[];
}

export interface CrearReciboDatos {
  readonly customerId?: string | null;
  readonly customerName: string;
  readonly customerEmail?: string | null;
  readonly customerPhone?: string | null;
  readonly title?: string | null;
  readonly items: ItemRecibo[];
  readonly totalPen: number;
  readonly bookingGroupId?: string | null;
  readonly packageId?: string | null;
  readonly notes?: string | null;
  readonly createdBy?: string | null;
}

export interface NuevoPagoDatos {
  readonly amountPen: number;
  readonly method: string;
  readonly paidAt?: string | null;
  readonly note?: string | null;
  readonly proofImageUrl?: string | null;
  readonly registeredBy?: string | null;
}

export interface FiltrosRecibos {
  readonly status: string | null;
  readonly q: string | null;
}

export interface LineaSimple {
  readonly description: string;
  readonly amountPen: number;
}

/** Pago/adelanto ya existente de una reserva (de un BookingPayment online o de un
 *  recibo previo), si lo hay. */
export interface DepositoResumen {
  readonly totalPen: number;
  readonly depositPen: number;
  readonly paidPen: number;
  readonly balancePen: number;
  readonly status: string;
  readonly receiptNumber: string | null;
  readonly method: string | null;
  readonly paidAt: string | null;
}

/** Resumen de una reserva (grupo de citas) para crear un recibo a partir de ella. */
export interface BookingResumen {
  readonly bookingGroupId: string;
  readonly packageId: string | null;
  readonly isPackage: boolean;
  readonly date: string;
  readonly label: string;
  readonly total: number;
  readonly status: string; // estado del grupo de citas
  readonly items: LineaSimple[];
  readonly deposit: DepositoResumen | null;
}

export interface CriterioBookings {
  readonly customerId?: string | null;
  readonly phone?: string | null;
}

export interface ReciboRepositorio {
  /** Crea el recibo + sus items. Genera el número de recibo. */
  crear(ctx: ContextoTenant, datos: CrearReciboDatos): Promise<ReciboPersistido>;

  /** Busca un recibo por id (con items y pagos). null si no existe. */
  buscar(ctx: ContextoTenant, id: string): Promise<ReciboPersistido | null>;

  /** Listado admin con filtros (status / texto). */
  listar(ctx: ContextoTenant, filtros: FiltrosRecibos): Promise<ReciboPersistido[]>;

  /** Registra un abono y recalcula paidPen/balancePen/status (transacción). */
  agregarPago(ctx: ContextoTenant, id: string, pago: NuevoPagoDatos): Promise<ReciboPersistido>;

  /** Anula el recibo (status 'cancelled'). */
  anular(ctx: ContextoTenant, id: string): Promise<ReciboPersistido>;

  /** Reservas (grupos de citas) de un cliente + su adelanto, para crear un recibo. */
  bookingsCliente(ctx: ContextoTenant, criterio: CriterioBookings): Promise<BookingResumen[]>;
}
