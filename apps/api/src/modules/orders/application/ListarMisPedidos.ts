// Caso de uso (consulta): pedidos del cliente autenticado. GET /api/orders/me.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { PedidoPersistido, PedidoRepositorio } from '../domain/ports/PedidoRepositorio';

export class ListarMisPedidos {
  constructor(private readonly pedidos: PedidoRepositorio) {}

  ejecutar(ctx: ContextoTenant, customerId: string): Promise<PedidoPersistido[]> {
    return this.pedidos.listarDeCliente(ctx, customerId);
  }
}
