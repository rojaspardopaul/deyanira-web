// Caso de uso (consulta): obtener un pedido con verificación de propiedad.
// GET /api/orders/:id (cliente logueado, o invitado con orderId + email).

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { PedidoNoEncontradoError } from '../domain/errors';
import type { PedidoPersistido, PedidoRepositorio } from '../domain/ports/PedidoRepositorio';

export interface ObtenerPedidoComando {
  readonly id: string;
  readonly usuario: { id: string } | null;
  readonly guestEmail: string | null;
}

export class ObtenerPedido {
  constructor(private readonly pedidos: PedidoRepositorio) {}

  async ejecutar(ctx: ContextoTenant, comando: ObtenerPedidoComando): Promise<PedidoPersistido> {
    const pedido = await this.pedidos.buscarPorId(ctx, comando.id);
    if (!pedido) throw new PedidoNoEncontradoError('Pedido no encontrado');

    const customerId = pedido.customerId as string | null;
    const shipEmail = (pedido.shipEmail as string | null)?.toLowerCase() ?? null;
    const esDueñoPorUsuario = !!comando.usuario && customerId === comando.usuario.id;
    const esDueñoPorEmail = !!comando.guestEmail && shipEmail === comando.guestEmail.toLowerCase();
    if (!esDueñoPorUsuario && !esDueñoPorEmail) {
      throw new PedidoNoEncontradoError('Pedido no encontrado');
    }

    return pedido;
  }
}
