// Caso de uso: crear un pedido de tienda. Réplica fiel de POST /api/orders.
// La lógica de negocio (subtotal, cupón, envío, total) vive aquí; la atomicidad
// (decremento de stock + uso de cupón) la garantiza el repositorio en su transacción.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import {
  calcularSubtotal,
  calcularDescuento,
  calcularEnvioYTotal,
} from '../domain/CalculadoraPedido';
import { ESTADO_INICIAL_PEDIDO } from '../domain/EstadoPedido';
import {
  CuponInvalidoError,
  DemasiadosPedidosPendientesError,
  ProductoNoDisponibleError,
} from '../domain/errors';
import type {
  CuponAUsar,
  LineaPedidoNueva,
  PedidoPersistido,
  PedidoRepositorio,
} from '../domain/ports/PedidoRepositorio';
import type { CatalogoProductos } from '../domain/ports/CatalogoProductos';
import type { NotificadorPedidos } from '../domain/ports/NotificadorPedidos';
import { CrearPedidoComando } from './dto/CrearPedidoComando';

const MAX_PEDIDOS_PENDIENTES = 3;
const METODO_PAGO_DEFECTO = 'culqi';

export class CrearPedido {
  constructor(
    private readonly pedidos: PedidoRepositorio,
    private readonly catalogo: CatalogoProductos,
    private readonly notificador: NotificadorPedidos,
  ) {}

  async ejecutar(ctx: ContextoTenant, comando: CrearPedidoComando): Promise<PedidoPersistido> {
    // 1) Anti-abuso: máximo 3 pedidos pendientes (cliente o invitado por teléfono).
    if (comando.usuario) {
      const pendientes = await this.pedidos.contarPendientesDeCliente(ctx, comando.usuario.id);
      if (pendientes >= MAX_PEDIDOS_PENDIENTES) {
        throw new DemasiadosPedidosPendientesError('Tienes demasiados pedidos pendientes. Completa el pago de los anteriores.');
      }
    } else {
      const pendientes = await this.pedidos.contarPendientesDeInvitado(ctx, comando.ship.phone);
      if (pendientes >= MAX_PEDIDOS_PENDIENTES) {
        throw new DemasiadosPedidosPendientesError('Este número ya tiene pedidos pendientes. Por favor contáctanos.');
      }
    }

    // 2) Cargar productos y armar las líneas (precio snapshot).
    const ids = Array.from(new Set(comando.items.map((i) => i.productId)));
    const productos = await this.catalogo.cargarProductos(ctx, ids);
    const byId = new Map(productos.map((p) => [p.id, p]));

    const lineas: LineaPedidoNueva[] = [];
    for (const item of comando.items) {
      const p = byId.get(item.productId);
      if (!p || !p.isActive) throw new ProductoNoDisponibleError('Producto no disponible');
      lineas.push({ productId: p.id, name: p.name, pricePen: p.pricePen, qty: item.qty });
    }

    const subtotal = calcularSubtotal(lineas);

    // 3) Cupón (validación + cálculo de descuento; el uso atómico va en el repo).
    let discount = 0;
    let cupon: CuponAUsar | null = null;
    if (comando.couponCode) {
      const code = comando.couponCode.toUpperCase();
      const promo = await this.catalogo.cargarPromocion(ctx, code);
      if (!promo || !promo.isActive) throw new CuponInvalidoError('Código de descuento inválido');
      if (promo.expiresAt && new Date() > promo.expiresAt) throw new CuponInvalidoError('El código de descuento expiró');
      if (subtotal < promo.minOrderPen) throw new CuponInvalidoError(`El cupón requiere mínimo S/ ${promo.minOrderPen}`);
      discount = calcularDescuento(subtotal, { type: promo.type, value: promo.value });
      cupon = { code, promoId: promo.id, usedCount: promo.usedCount };
    }

    // 4) Envío y total.
    const { shipping, total } = calcularEnvioYTotal(subtotal, discount);

    // 5) Persistir (transacción: stock + cupón atómicos + creación).
    const pedido = await this.pedidos.crear(ctx, {
      customerId: comando.usuario?.id ?? null,
      estado: ESTADO_INICIAL_PEDIDO,
      subtotal,
      shipping,
      discount,
      total,
      paymentMethod: comando.paymentMethod || METODO_PAGO_DEFECTO,
      ship: comando.ship,
      cupon,
      lineas,
    });

    // 6) Correo (solo Yape; las confirmaciones Culqi van tras el pago).
    const esYape = comando.paymentMethod === 'yape' || !comando.paymentMethod;
    if (comando.ship.email && esYape) {
      this.notificador.pedidoPendientePago(pedido, comando.ship.email);
    }

    return pedido;
  }
}
