// Adaptador de catálogo de tienda. Carga productos y promociones vía Prisma y los
// normaliza al tipo del puerto (Decimal -> number).

import type { PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type {
  CatalogoProductos,
  ProductoTienda,
  PromocionTienda,
} from '../domain/ports/CatalogoProductos';

export class PrismaCatalogoProductos implements CatalogoProductos {
  constructor(private readonly prisma: PrismaClient) {}

  async cargarProductos(_ctx: ContextoTenant, ids: string[]): Promise<ProductoTienda[]> {
    const rows = await this.prisma.product.findMany({ where: { id: { in: ids } } });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      pricePen: Number(p.pricePen),
    }));
  }

  async cargarPromocion(_ctx: ContextoTenant, code: string): Promise<PromocionTienda | null> {
    const p = await this.prisma.promotion.findUnique({ where: { code } });
    if (!p) return null;
    return {
      id: p.id,
      code: p.code,
      type: p.type === 'percent' ? 'percent' : 'fixed',
      value: Number(p.value),
      minOrderPen: Number(p.minOrderPen),
      isActive: p.isActive,
      expiresAt: p.expiresAt,
      usageLimit: p.usageLimit,
      usedCount: p.usedCount,
    };
  }
}
