// Caso de uso: procesar un evento de webhook de Culqi (ya verificado por firma en
// la presentación). Réplica fiel: idempotencia por eventId, persistencia y, si es un
// cargo exitoso, marca el pedido pagado.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { RegistroWebhook } from '../domain/ports/RegistroWebhook';
import type { PedidosParaPago } from '../domain/ports/PedidosParaPago';
import type { NotificadorPagos } from '../domain/ports/NotificadorPagos';

const TIPOS_EXITO = ['charge.created.success', 'charge.succeeded'];

export interface ProcesarWebhookComando {
  readonly eventId: string;
  readonly type: string;
  readonly chargeId: string | null;
  readonly orderId: string | null;
  readonly payload: unknown;
}

export class ProcesarWebhookCulqi {
  constructor(
    private readonly registro: RegistroWebhook,
    private readonly pedidos: PedidosParaPago,
    private readonly notificador: NotificadorPagos,
  ) {}

  async ejecutar(ctx: ContextoTenant, c: ProcesarWebhookComando): Promise<{ ok: true; duplicated?: boolean }> {
    // Idempotencia: Culqi reintenta si no recibe 2xx.
    if (await this.registro.yaRegistrado(ctx, c.eventId)) {
      return { ok: true, duplicated: true };
    }

    const { id } = await this.registro.registrar(ctx, {
      eventId: c.eventId,
      type: c.type,
      chargeId: c.chargeId,
      orderId: c.orderId,
      payload: c.payload,
    });

    if (TIPOS_EXITO.includes(c.type) && c.orderId) {
      const { count, pedido } = await this.pedidos.marcarPagado(ctx, c.orderId, { metodo: 'culqi', ref: c.chargeId });
      if (count > 0 && pedido) this.notificador.pedidoConfirmado(pedido);
    }

    await this.registro.marcarProcesado(ctx, id);
    return { ok: true };
  }
}
