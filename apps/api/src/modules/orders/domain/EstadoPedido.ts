// Estado de un pedido en el lenguaje ubicuo (español). La traducción a los valores
// de BD (inglés) vive en el mapper de infraestructura.

export type EstadoPedido = 'pendiente' | 'procesando' | 'enviado' | 'entregado' | 'cancelado';

export const ESTADO_INICIAL_PEDIDO: EstadoPedido = 'pendiente';

export const ESTADO_PEDIDO_A_BD: Record<EstadoPedido, string> = {
  pendiente: 'pending',
  procesando: 'processing',
  enviado: 'shipped',
  entregado: 'delivered',
  cancelado: 'cancelled',
};

const BD_A_ESTADO_PEDIDO: Record<string, EstadoPedido> = {
  pending: 'pendiente',
  processing: 'procesando',
  shipped: 'enviado',
  delivered: 'entregado',
  cancelled: 'cancelado',
};

export function aEstadoPedidoBd(estado: EstadoPedido): string {
  return ESTADO_PEDIDO_A_BD[estado];
}

export function estadoPedidoDesdeBd(valorBd: string): EstadoPedido {
  return BD_A_ESTADO_PEDIDO[valorBd] ?? 'pendiente';
}
