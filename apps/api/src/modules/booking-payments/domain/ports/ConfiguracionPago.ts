// Puerto de configuración de pago del salón (Settings). Separa los campos de pago
// (para instrucciones públicas) del settings completo (para el recibo).

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';

export interface ConfiguracionPago {
  /** Campos de pago del salón (Yape/Plin/banco + identidad) para mostrar al cliente. */
  datosPago(ctx: ContextoTenant): Promise<Record<string, unknown>>;

  /** Settings completo (lo usa el render del recibo). */
  salonCompleto(ctx: ContextoTenant): Promise<Record<string, unknown>>;

  /** Llave pública de Culqi (para el front del cobro con tarjeta). null si no hay. */
  culqiPublicKey(): string | null;
}
