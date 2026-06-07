// Puerto de persistencia de pedidos. La implementación Prisma (con la transacción
// Serializable + decremento atómico de stock + uso atómico de cupón) vive en
// infrastructure/. El dominio solo conoce esta interfaz.

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';
import type { EstadoPedido } from '../EstadoPedido';

/** Pedido ya persistido (forma = fila Prisma con items; alimenta la respuesta HTTP). */
export type PedidoPersistido = { id: string } & Record<string, unknown>;

export interface LineaPedidoNueva {
  readonly productId: string;
  readonly name: string;
  readonly pricePen: number;
  readonly qty: number;
}

/** Cupón a consumir atómicamente dentro de la transacción (guard por usageLimit). */
export interface CuponAUsar {
  readonly code: string;
  readonly promoId: string;
  readonly usedCount: number;
}

export interface PedidoNuevo {
  readonly customerId: string | null;
  readonly estado: EstadoPedido;
  readonly subtotal: number;
  readonly shipping: number;
  readonly discount: number;
  readonly total: number;
  readonly paymentMethod: string;
  readonly ship: {
    name: string;
    phone: string;
    email: string | null;
    address: string;
    district: string;
  };
  readonly cupon: CuponAUsar | null;
  readonly lineas: LineaPedidoNueva[];
}

export interface PedidoRepositorio {
  contarPendientesDeCliente(ctx: ContextoTenant, customerId: string): Promise<number>;
  contarPendientesDeInvitado(ctx: ContextoTenant, telefono: string): Promise<number>;

  /** Crea el pedido en una transacción: decrementa stock e incrementa uso de cupón
   *  atómicamente; lanza StockInsuficienteError / CuponSinUsosError si fallan los guards. */
  crear(ctx: ContextoTenant, pedido: PedidoNuevo): Promise<PedidoPersistido>;

  listarDeCliente(ctx: ContextoTenant, customerId: string): Promise<PedidoPersistido[]>;
  buscarPorId(ctx: ContextoTenant, id: string): Promise<PedidoPersistido | null>;
}
