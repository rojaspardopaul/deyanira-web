// Puerto de configuración del servicio a domicilio.
//
// Reemplaza el `prisma.setting.findFirst()` + cálculo de recargo inline de la ruta
// legacy. En multiempresa, `obtener(ctx)` devolverá la config del tenant.

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';
import type { Dinero } from '../../../../shared/domain/Dinero';

export interface ConfiguracionDomicilioSalon {
  readonly habilitado: boolean;
  /** Calcula el recargo a domicilio para un distrito (lógica de tarifa por km). */
  recargoPara(distrito: string): Dinero;
}

export interface ConfiguracionDomicilio {
  /** null si no hay configuración del salón. */
  obtener(ctx: ContextoTenant): Promise<ConfiguracionDomicilioSalon | null>;
}
