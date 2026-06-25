// Puerto de persistencia y consultas de adelantos (BookingPayment). La
// implementación con Prisma vive en infrastructure/. El dominio solo conoce esta
// interfaz. Todos los métodos reciben ContextoTenant (seam multiempresa).

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';

/** Fila de BookingPayment ya persistida (forma laxa = lo que devuelve Prisma). */
export type AdelantoPersistido = { id: string } & Record<string, unknown>;

/** Citas del grupo de reserva + su paquete (para info pública y recibo). */
export interface GrupoReserva {
  readonly appointments: Array<{ id: string } & Record<string, unknown>>;
  readonly paquete: ({ id: string; name: string } & Record<string, unknown>) | null;
}

/** Resultado de liquidar un adelanto (markDepositPaid): pago + citas + paquete. */
export interface LiquidacionAdelanto {
  readonly payment: {
    id: string;
    receiptNumber: string | null;
    customerEmail: string | null;
    customerName: string | null;
  } & Record<string, unknown>;
  readonly appointments: Array<Record<string, unknown>>;
  readonly packageInfo: { name: string; groupLabel: string | null; eventType: unknown } | null;
}

export interface FiltrosAdelantos {
  readonly status: string | null;
  readonly bookingGroupId: string | null;
}

export interface OpcionesPago {
  readonly method?: string;
  readonly paidPen?: number | null;
  readonly culqiChargeId?: string | null;
  readonly verifiedBy?: string | null;
}

export interface AdelantoRepositorio {
  /** Busca un adelanto por id. null si no existe. */
  buscar(ctx: ContextoTenant, id: string): Promise<AdelantoPersistido | null>;

  /** Carga las citas del bookingGroup + su paquete (info pública / recibo). */
  cargarGrupo(ctx: ContextoTenant, bookingGroupId: string): Promise<GrupoReserva>;

  /** Listado admin con filtros (status / bookingGroupId). */
  listarAdmin(ctx: ContextoTenant, filtros: FiltrosAdelantos): Promise<AdelantoPersistido[]>;

  /** Adjunta el comprobante subido y deja el adelanto en 'awaiting_verification'. */
  guardarComprobante(
    ctx: ContextoTenant,
    id: string,
    datos: { url: string; method: string },
  ): Promise<AdelantoPersistido>;

  /** Rechaza un comprobante (status 'rejected'). */
  rechazar(
    ctx: ContextoTenant,
    id: string,
    datos: { notes: string | null; verifiedBy: string | null },
  ): Promise<AdelantoPersistido>;

  /** Marca el adelanto como pagado, confirma las citas del grupo y devuelve la
   *  liquidación (idempotente). Lanza AdelantoNoEncontrado/AdelantoYaPagado. */
  registrarPago(ctx: ContextoTenant, id: string, opciones: OpcionesPago): Promise<LiquidacionAdelanto>;
}
