// Adaptador de acceso a pedidos para pagos. Update atómico (updateMany con guard)
// que evita doble cobro, fiel al legacy.

import type { PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type {
  DatosPago,
  PedidoPagado,
  PedidoPago,
  PedidosParaPago,
} from '../domain/ports/PedidosParaPago';

export class PrismaPedidosParaPago implements PedidosParaPago {
  constructor(private readonly prisma: PrismaClient) {}

  async buscar(_ctx: ContextoTenant, orderId: string): Promise<PedidoPago | null> {
    const o = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!o) return null;
    return {
      id: o.id,
      paymentStatus: o.paymentStatus,
      status: o.status,
      shipEmail: o.shipEmail,
      totalPen: o.totalPen,
    };
  }

  async marcarPagado(
    _ctx: ContextoTenant,
    orderId: string,
    datos: DatosPago,
  ): Promise<{ count: number; pedido: PedidoPagado | null }> {
    const result = await this.prisma.order.updateMany({
      where: { id: orderId, paymentStatus: { not: 'paid' }, status: { not: 'cancelled' } },
      data: {
        paymentStatus: 'paid',
        paymentMethod: datos.metodo,
        paymentRef: datos.ref,
        status: 'processing',
      },
    });
    if (result.count === 0) return { count: 0, pedido: null };

    const pedido = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    return { count: result.count, pedido: pedido as unknown as PedidoPagado | null };
  }
}
