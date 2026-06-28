// Adaptador de persistencia de pedidos. ÚNICO lugar del módulo con Prisma.
// La transacción Serializable + los guards atómicos (stock, cupón) replican
// fielmente el POST /api/orders legacy.

import { Prisma, type PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { aEstadoPedidoBd } from '../domain/EstadoPedido';
import { CuponSinUsosError, StockInsuficienteError } from '../domain/errors';
import type {
  PedidoNuevo,
  PedidoPersistido,
  PedidoRepositorio,
} from '../domain/ports/PedidoRepositorio';

const VENTANA_PENDIENTES_MS = 24 * 60 * 60 * 1000;

export class PrismaPedidoRepository implements PedidoRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async contarPendientesDeCliente(_ctx: ContextoTenant, customerId: string): Promise<number> {
    return this.prisma.order.count({
      where: {
        customerId,
        status: 'pending',
        paymentStatus: 'pending',
        createdAt: { gte: new Date(Date.now() - VENTANA_PENDIENTES_MS) },
      },
    });
  }

  async contarPendientesDeInvitado(_ctx: ContextoTenant, telefono: string): Promise<number> {
    return this.prisma.order.count({
      where: {
        shipPhone: telefono,
        customerId: null,
        status: 'pending',
        createdAt: { gte: new Date(Date.now() - VENTANA_PENDIENTES_MS) },
      },
    });
  }

  async crear(_ctx: ContextoTenant, pedido: PedidoNuevo): Promise<PedidoPersistido> {
    const row = await this.prisma.$transaction(
      async (tx) => {
        // Decremento atómico de stock por item (guard: stock >= qty).
        for (const ln of pedido.lineas) {
          const updated = await tx.product.updateMany({
            where: { id: ln.productId, stock: { gte: ln.qty } },
            data: { stock: { decrement: ln.qty } },
          });
          if (updated.count === 0) {
            throw new StockInsuficienteError(`Stock insuficiente para "${ln.name}"`);
          }
        }

        // Uso atómico del cupón (guard: usageLimit > usedCount).
        if (pedido.cupon) {
          const inc = await tx.promotion.updateMany({
            where: {
              id: pedido.cupon.promoId,
              isActive: true,
              OR: [{ usageLimit: null }, { usageLimit: { gt: pedido.cupon.usedCount } }],
            },
            data: { usedCount: { increment: 1 } },
          });
          if (inc.count === 0) {
            throw new CuponSinUsosError('El código ya alcanzó su límite de usos');
          }
        }

        return tx.order.create({
          data: {
            customerId: pedido.customerId,
            status: aEstadoPedidoBd(pedido.estado),
            subtotalPen: pedido.subtotal,
            shippingPen: pedido.shipping,
            discountPen: pedido.discount,
            totalPen: pedido.total,
            paymentMethod: pedido.paymentMethod,
            paymentStatus: 'pending',
            shipName: pedido.ship.name,
            shipPhone: pedido.ship.phone,
            shipEmail: pedido.ship.email,
            shipAddress: pedido.ship.address,
            shipDistrict: pedido.ship.district,
            shipCity: 'Lima',
            pickupInStore: pedido.pickupInStore,
            couponCode: pedido.cupon?.code ?? null,
            items: {
              create: pedido.lineas.map((l) => ({
                productId: l.productId,
                name: l.name,
                pricePen: l.pricePen,
                qty: l.qty,
              })),
            },
          },
          include: { items: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return row as unknown as PedidoPersistido;
  }

  async listarDeCliente(_ctx: ContextoTenant, customerId: string): Promise<PedidoPersistido[]> {
    const rows = await this.prisma.order.findMany({
      where: { customerId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows as unknown as PedidoPersistido[];
  }

  async buscarPorId(_ctx: ContextoTenant, id: string): Promise<PedidoPersistido | null> {
    const row = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    return row ? (row as unknown as PedidoPersistido) : null;
  }

  async adjuntarComprobante(_ctx: ContextoTenant, id: string, proofUrl: string): Promise<PedidoPersistido> {
    // `proofImageUrl` es columna nueva; el `as` evita depender de la regeneración
    // del cliente Prisma (la columna ya existe en la BD).
    const data = { proofImageUrl: proofUrl, paymentStatus: 'awaiting_verification' };
    const row = await this.prisma.order.update({
      where: { id },
      data: data as unknown as Prisma.OrderUpdateInput,
      include: { items: true },
    });
    return row as unknown as PedidoPersistido;
  }
}
