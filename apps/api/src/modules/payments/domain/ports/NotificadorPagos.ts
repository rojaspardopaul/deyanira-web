// Puerto de notificaciones de pago (fire-and-forget). Reutiliza el correo de
// confirmación de pedido existente.

import type { PedidoPagado } from './PedidosParaPago';

export interface NotificadorPagos {
  /** Correo "pedido confirmado/pagado" al cliente. */
  pedidoConfirmado(pedido: PedidoPagado): void;
}
