// Puerto de configuración del envío de productos. La implementación Prisma lee la
// tarifa de envío de Settings y aplica la distancia por distrito.

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';

export interface ConfiguracionEnvioSalon {
  readonly habilitado: boolean;
  /** Envío gratis cuando el subtotal alcanza este monto. */
  readonly envioGratisDesde: number;
  /** Costo de envío a un distrito (tarifa base + por km, sin umbral ni recojo). */
  costoPara(distrito: string): number;
}

export interface ConfiguracionEnvio {
  /** null si no hay configuración del salón. */
  obtener(ctx: ContextoTenant): Promise<ConfiguracionEnvioSalon | null>;
}
