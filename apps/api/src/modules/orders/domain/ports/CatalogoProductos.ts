// Puerto de catálogo de la tienda: productos y promociones para el checkout.

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';

export interface ProductoTienda {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly pricePen: number;
}

export interface PromocionTienda {
  readonly id: string;
  readonly code: string;
  readonly type: 'percent' | 'fixed';
  readonly value: number;
  readonly minOrderPen: number;
  readonly isActive: boolean;
  readonly expiresAt: Date | null;
  readonly usageLimit: number | null;
  readonly usedCount: number;
}

export interface CatalogoProductos {
  cargarProductos(ctx: ContextoTenant, ids: string[]): Promise<ProductoTienda[]>;
  cargarPromocion(ctx: ContextoTenant, code: string): Promise<PromocionTienda | null>;
}
