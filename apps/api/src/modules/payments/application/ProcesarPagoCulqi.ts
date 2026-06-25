// Caso de uso: procesar un pago con tarjeta (Culqi) para un pedido.
// Réplica fiel de POST /api/payments/culqi: validación de email, monto desde BD
// (no manipulable), idempotencia contra Culqi y update atómico del pedido.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import {
  EmailNoCoincideError,
  MontoMinimoError,
  PagoRechazadoError,
  PedidoCanceladoError,
  PedidoNoEncontradoError,
  PedidoYaPagadoError,
} from '../domain/errors';
import type { ErrorPasarela, PasarelaPagos } from '../domain/ports/PasarelaPagos';
import type { PedidosParaPago } from '../domain/ports/PedidosParaPago';
import type { NotificadorPagos } from '../domain/ports/NotificadorPagos';

const MONTO_MINIMO_CENTIMOS = 100; // Culqi exige mínimo S/ 1.00

export interface ProcesarPagoCulqiComando {
  readonly orderId: string;
  readonly culqiToken: string;
  readonly email: string;
}

export interface ResultadoPagoCulqi {
  success: true;
  orderId?: string;
  alreadyPaid?: boolean;
}

export class ProcesarPagoCulqi {
  constructor(
    private readonly pedidos: PedidosParaPago,
    private readonly pasarela: PasarelaPagos,
    private readonly notificador: NotificadorPagos,
  ) {}

  async ejecutar(ctx: ContextoTenant, c: ProcesarPagoCulqiComando): Promise<ResultadoPagoCulqi> {
    const order = await this.pedidos.buscar(ctx, c.orderId);
    if (!order) throw new PedidoNoEncontradoError('Pedido no encontrado');
    if (order.paymentStatus === 'paid') throw new PedidoYaPagadoError('Este pedido ya fue pagado');
    if (order.status === 'cancelled') throw new PedidoCanceladoError('Este pedido fue cancelado');

    // Anti-suplantación: el email debe coincidir con el del pedido.
    if (order.shipEmail && order.shipEmail.toLowerCase() !== c.email.toLowerCase()) {
      throw new EmailNoCoincideError('El email no coincide con el del pedido');
    }

    const montoCentimos = Math.round(Number(order.totalPen) * 100);
    if (montoCentimos < MONTO_MINIMO_CENTIMOS) throw new MontoMinimoError('Monto mínimo no alcanzado');

    let cargo;
    try {
      cargo = await this.pasarela.crearCargo({
        token: c.culqiToken,
        montoCentimos,
        email: c.email,
        descripcion: `Pedido #${c.orderId.slice(-8).toUpperCase()} — Deyanira Makeup Beauty`,
        idempotencyKey: c.orderId,
      });
    } catch (err) {
      const e = err as ErrorPasarela;
      // Mismo idempotency key ya cobrado: el pago existe, confirmamos el pedido.
      if (e.culqiCode === 'already_exists') {
        const { pedido } = await this.pedidos.marcarPagado(ctx, c.orderId, { metodo: 'culqi', ref: null });
        if (pedido) { this.notificador.pedidoConfirmado(pedido); this.proyectarVenta(c.orderId, pedido); }
        return { success: true, alreadyPaid: true };
      }
      throw new PagoRechazadoError(e.message || 'Error procesando el pago');
    }

    const { count, pedido } = await this.pedidos.marcarPagado(ctx, c.orderId, { metodo: 'culqi', ref: cargo.id });
    if (count === 0) throw new PedidoYaPagadoError('Este pedido ya fue pagado');
    if (pedido) { this.notificador.pedidoConfirmado(pedido); this.proyectarVenta(c.orderId, pedido); }

    return { success: true, orderId: c.orderId };
  }

  // Proyección al libro mayor (venta de productos). Fire-and-forget e idempotente
  // por (source order + orderId): no duplica con el marcado manual del admin.
  private proyectarVenta(orderId: string, pedido: Record<string, unknown>): void {
    const total = Number(pedido.totalPen) || 0;
    if (total <= 0) return;
    const createdAt = pedido.createdAt ? new Date(pedido.createdAt as string) : new Date();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { proyectarMovimiento } = require('../../financial');
    void proyectarMovimiento({
      tipo: 'venta',
      monto: total,
      descripcion: 'Pedido de productos',
      fecha: createdAt.toISOString().slice(0, 10),
      categoria: 'productos',
      metodoPago: 'culqi',
      source: 'order',
      orderId,
      customerId: (pedido.customerId as string) ?? null,
    });
  }
}
