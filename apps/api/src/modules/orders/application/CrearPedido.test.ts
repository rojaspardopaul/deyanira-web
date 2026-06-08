import { describe, it, expect, vi } from 'vitest';
import { CrearPedido } from './CrearPedido';
import { CrearPedidoComando, type CuerpoCrearPedido, type UsuarioPedido } from './dto/CrearPedidoComando';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { CatalogoProductos, ProductoTienda, PromocionTienda } from '../domain/ports/CatalogoProductos';
import type { PedidoNuevo, PedidoRepositorio } from '../domain/ports/PedidoRepositorio';
import type { NotificadorPedidos } from '../domain/ports/NotificadorPedidos';
import { CuponInvalidoError, DemasiadosPedidosPendientesError, ProductoNoDisponibleError } from '../domain/errors';

const ctx: ContextoTenant = { tenantId: 'test' };

const prod = (over: Partial<ProductoTienda> = {}): ProductoTienda => ({
  id: 'p1', name: 'Labial', isActive: true, pricePen: 50, ...over,
});

interface Overrides {
  pendientes?: number;
  productos?: ProductoTienda[];
  promo?: PromocionTienda | null;
}

function crearDeps(o: Overrides = {}) {
  let ultimoPedido: PedidoNuevo | null = null;
  const pedidos = {
    contarPendientesDeCliente: vi.fn(async () => o.pendientes ?? 0),
    contarPendientesDeInvitado: vi.fn(async () => o.pendientes ?? 0),
    crear: vi.fn(async (_c: ContextoTenant, p: PedidoNuevo) => {
      ultimoPedido = p;
      return { id: 'ord-1', shipEmail: p.ship.email };
    }),
    listarDeCliente: vi.fn(async () => []),
    buscarPorId: vi.fn(async () => null),
  } as unknown as PedidoRepositorio;
  const catalogo: CatalogoProductos = {
    cargarProductos: vi.fn(async () => o.productos ?? [prod()]),
    cargarPromocion: vi.fn(async () => o.promo ?? null),
  };
  const notificador: NotificadorPedidos = { pedidoPendientePago: vi.fn(), comprobanteRecibido: vi.fn() };
  return { pedidos, catalogo, notificador, getPedido: () => ultimoPedido };
}

const body = (over: Partial<CuerpoCrearPedido> = {}): CuerpoCrearPedido => ({
  items: [{ productId: 'p1', qty: 2 }],
  shipName: 'Ana',
  shipPhone: '+51999888777',
  shipEmail: 'a@t.com',
  shipAddress: 'Av. Siempre Viva 123',
  shipDistrict: 'Surco',
  paymentMethod: 'yape',
  ...over,
});

function correr(deps: ReturnType<typeof crearDeps>, b: CuerpoCrearPedido, usuario: UsuarioPedido | null = null) {
  const uc = new CrearPedido(deps.pedidos, deps.catalogo, deps.notificador);
  return uc.ejecutar(ctx, CrearPedidoComando.desdeHttp(b, usuario));
}

describe('CrearPedido', () => {
  it('happy path: calcula totales, persiste y notifica (Yape)', async () => {
    const deps = crearDeps({ productos: [prod({ pricePen: 50 })] }); // 50*2 = 100
    const res = await correr(deps, body());
    expect(res.id).toBe('ord-1');
    const p = deps.getPedido()!;
    expect(p.subtotal).toBe(100);
    expect(p.shipping).toBe(10); // 100 no supera 100 => envío 10
    expect(p.total).toBe(110);
    expect(deps.notificador.pedidoPendientePago).toHaveBeenCalledOnce();
  });

  it('producto inactivo -> ProductoNoDisponibleError', async () => {
    const deps = crearDeps({ productos: [prod({ isActive: false })] });
    await expect(correr(deps, body())).rejects.toBeInstanceOf(ProductoNoDisponibleError);
  });

  it('demasiados pedidos pendientes (cliente)', async () => {
    const deps = crearDeps({ pendientes: 3 });
    await expect(correr(deps, body(), { id: 'u1' })).rejects.toBeInstanceOf(DemasiadosPedidosPendientesError);
  });

  it('cupón inexistente -> CuponInvalidoError', async () => {
    const deps = crearDeps({ promo: null });
    await expect(correr(deps, body({ couponCode: 'NOPE' }))).rejects.toBeInstanceOf(CuponInvalidoError);
  });

  it('cupón válido: aplica descuento y lo pasa al repo', async () => {
    const promo: PromocionTienda = {
      id: 'promo1', code: 'DESC10', type: 'percent', value: 10, minOrderPen: 0,
      isActive: true, expiresAt: null, usageLimit: null, usedCount: 2,
    };
    const deps = crearDeps({ productos: [prod({ pricePen: 100 })], promo }); // subtotal 200
    await correr(deps, body({ couponCode: 'desc10' }));
    const p = deps.getPedido()!;
    expect(p.discount).toBe(20); // 10% de 200
    expect(p.cupon).toEqual({ code: 'DESC10', promoId: 'promo1', usedCount: 2 });
    expect(p.total).toBe(180); // 200 + 0 envío - 20
  });
});
