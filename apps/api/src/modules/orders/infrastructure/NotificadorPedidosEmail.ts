// Adaptador de notificaciones de pedidos. Reutiliza lib/notifications/email.js.
// Resuelve el número de Yape desde el entorno (no es asunto del caso de uso).

import { env } from '../../../shared/config/entorno';
import type { PedidoPersistido } from '../domain/ports/PedidoRepositorio';
import type { NotificadorPedidos } from '../domain/ports/NotificadorPedidos';

/* eslint-disable @typescript-eslint/no-var-requires */
const email = require('../../../lib/notifications/email') as {
  sendOrderPendingPayment: (a: unknown) => Promise<unknown>;
};
const logger = require('../../../lib/logger') as { error: (msg: string, meta?: unknown) => void };

export class NotificadorPedidosEmail implements NotificadorPedidos {
  pedidoPendientePago(pedido: PedidoPersistido, emailTo: string): void {
    const yapeNumber = (env.YAPE_NUMBER || env.SALON_WHATSAPP || '').replace(/\D/g, '');
    email
      .sendOrderPendingPayment({ order: pedido, email: emailTo, yapeNumber })
      .catch((err: Error) => logger.error('email_failed', { msg: err.message }));
  }
}
