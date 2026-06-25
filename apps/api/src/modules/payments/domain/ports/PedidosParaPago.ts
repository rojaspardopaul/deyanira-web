// Puerto de acceso a pedidos para el flujo de pago. El módulo de pagos lee/actualiza
// el estado de pago del pedido (la tabla orders es infraestructura compartida; aquí
// solo se expone lo que pagos necesita).

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';

/** Vista mínima del pedido que pagos necesita. */
export interface PedidoPago {
  readonly id: string;
  readonly paymentStatus: string;
  readonly status: string;
  readonly shipEmail: string | null;
  readonly totalPen: unknown;
}

/** Pedido ya marcado como pagado (con items, para el correo de confirmación). */
export type PedidoPagado = { id: string; shipEmail: string | null } & Record<string, unknown>;

export interface DatosPago {
  readonly metodo: 'culqi' | 'yape';
  readonly ref: string | null;
}

export interface PedidosParaPago {
  buscar(ctx: ContextoTenant, orderId: string): Promise<PedidoPago | null>;

  /** Marca pagado de forma atómica (solo si aún no está pagado y no cancelado).
   *  Devuelve cuántas filas cambió (0 = ya pagado/cancelado) y el pedido actualizado. */
  marcarPagado(
    ctx: ContextoTenant,
    orderId: string,
    datos: DatosPago,
  ): Promise<{ count: number; pedido: PedidoPagado | null }>;
}
