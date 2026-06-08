// Caso de uso (admin): confirmar manualmente un pago por Yape de un pedido.
// Réplica fiel de POST /api/payments/yape-confirm.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { PedidoCanceladoError, PedidoNoEncontradoError, PedidoYaPagadoError } from '../domain/errors';
import type { PedidosParaPago } from '../domain/ports/PedidosParaPago';
import type { NotificadorPagos } from '../domain/ports/NotificadorPagos';

export interface ConfirmarPagoYapeComando {
  readonly orderId: string;
  readonly reference: string | null;
}

export class ConfirmarPagoYape {
  constructor(
    private readonly pedidos: PedidosParaPago,
    private readonly notificador: NotificadorPagos,
  ) {}

  async ejecutar(ctx: ContextoTenant, c: ConfirmarPagoYapeComando): Promise<{ success: true }> {
    const { count, pedido } = await this.pedidos.marcarPagado(ctx, c.orderId, {
      metodo: 'yape',
      ref: c.reference || 'yape-manual',
    });

    if (count === 0) {
      const order = await this.pedidos.buscar(ctx, c.orderId);
      if (!order) throw new PedidoNoEncontradoError('Pedido no encontrado');
      if (order.status === 'cancelled') throw new PedidoCanceladoError('Este pedido fue cancelado');
      throw new PedidoYaPagadoError('Este pedido ya fue pagado');
    }

    if (pedido) this.notificador.pedidoConfirmado(pedido);
    return { success: true };
  }
}
