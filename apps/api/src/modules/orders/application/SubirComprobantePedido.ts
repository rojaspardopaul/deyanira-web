// Caso de uso: el cliente sube el comprobante de pago (Yape/Plin/transferencia)
// de un pedido. Sube la imagen, lo deja en verificación y avisa al salón.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { PedidoNoEncontradoError } from '../domain/errors';
import type { PedidoPersistido, PedidoRepositorio } from '../domain/ports/PedidoRepositorio';
import type { AlmacenComprobantes } from '../domain/ports/AlmacenComprobantes';
import type { NotificadorPedidos } from '../domain/ports/NotificadorPedidos';

export interface SubirComprobanteComando {
  readonly id: string;
  readonly imagenDataUrl: string;
}

export class SubirComprobantePedido {
  constructor(
    private readonly pedidos: PedidoRepositorio,
    private readonly almacen: AlmacenComprobantes,
    private readonly notificador: NotificadorPedidos,
  ) {}

  async ejecutar(ctx: ContextoTenant, comando: SubirComprobanteComando): Promise<PedidoPersistido> {
    const pedido = await this.pedidos.buscarPorId(ctx, comando.id);
    if (!pedido) throw new PedidoNoEncontradoError('Pedido no encontrado');

    const url = await this.almacen.subir(comando.imagenDataUrl);
    const actualizado = await this.pedidos.adjuntarComprobante(ctx, comando.id, url);
    this.notificador.comprobanteRecibido(actualizado);
    return actualizado;
  }
}
