// API pública del módulo `orders` + composition root.
// ÚNICO punto de entrada; el resto del árbol es privado.

import prisma from '../../shared/database/prisma';

import { CrearPedido } from './application/CrearPedido';
import { ListarMisPedidos } from './application/ListarMisPedidos';
import { ObtenerPedido } from './application/ObtenerPedido';

import { PrismaPedidoRepository } from './infrastructure/PrismaPedidoRepository';
import { PrismaCatalogoProductos } from './infrastructure/PrismaCatalogoProductos';
import { NotificadorPedidosEmail } from './infrastructure/NotificadorPedidosEmail';

export interface ModuloPedidos {
  readonly crearPedido: CrearPedido;
  readonly listarMisPedidos: ListarMisPedidos;
  readonly obtenerPedido: ObtenerPedido;
}

export function crearModuloPedidos(): ModuloPedidos {
  const repo = new PrismaPedidoRepository(prisma);
  const catalogo = new PrismaCatalogoProductos(prisma);
  const notificador = new NotificadorPedidosEmail();

  return {
    crearPedido: new CrearPedido(repo, catalogo, notificador),
    listarMisPedidos: new ListarMisPedidos(repo),
    obtenerPedido: new ObtenerPedido(repo),
  };
}

export { CrearPedidoComando } from './application/dto/CrearPedidoComando';
export type { CuerpoCrearPedido, UsuarioPedido } from './application/dto/CrearPedidoComando';
