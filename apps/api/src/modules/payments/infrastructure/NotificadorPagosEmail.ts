// Adaptador de notificaciones de pago. Reutiliza lib/notifications/email
// (sendOrderConfirmation). Fire-and-forget.

import type { PedidoPagado } from '../domain/ports/PedidosParaPago';
import type { NotificadorPagos } from '../domain/ports/NotificadorPagos';

/* eslint-disable @typescript-eslint/no-var-requires */
const email = require('../../../lib/notifications/email') as {
  sendOrderConfirmation: (a: unknown) => Promise<unknown>;
};
const logger = require('../../../lib/logger') as { error: (msg: string, meta?: unknown) => void };

export class NotificadorPagosEmail implements NotificadorPagos {
  pedidoConfirmado(pedido: PedidoPagado): void {
    if (!pedido.shipEmail) return;
    email
      .sendOrderConfirmation({ order: pedido, email: pedido.shipEmail })
      .catch((err: Error) => logger.error('email_failed', { msg: err.message }));
  }
}
