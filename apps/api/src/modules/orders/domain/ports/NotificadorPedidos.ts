// Puerto de notificaciones de pedidos (fire-and-forget, como en el legacy).

import type { PedidoPersistido } from './PedidoRepositorio';

export interface NotificadorPedidos {
  /** Correo "pedido pendiente de pago" (solo flujo Yape). El número de Yape lo
   *  resuelve el adapter desde el entorno (no es asunto del caso de uso). */
  pedidoPendientePago(pedido: PedidoPersistido, email: string): void;

  /** Aviso al salón: el cliente subió el comprobante (a verificar). */
  comprobanteRecibido(pedido: PedidoPersistido): void;
}
