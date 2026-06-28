// Servicio de dominio puro: cálculo de subtotal, descuento, envío y total de un
// pedido. Réplica EXACTA de las fórmulas legacy (blindada por tests).

export interface LineaCalculo {
  readonly pricePen: number;
  readonly qty: number;
}

export interface PromoAplicable {
  readonly type: 'percent' | 'fixed';
  readonly value: number;
}

export interface EnvioPedidoCalc {
  /** El cliente recoge en el salón → sin costo de envío. */
  readonly recojoEnSalon: boolean;
  /** Costo de envío a domicilio ya resuelto por distancia (lo provee ConfiguracionEnvio). */
  readonly costoEnvio: number;
  /** Envío gratis cuando el subtotal alcanza este monto. */
  readonly envioGratisDesde: number;
}

export function calcularSubtotal(lineas: LineaCalculo[]): number {
  return lineas.reduce((s, l) => s + l.pricePen * l.qty, 0);
}

/** Descuento del cupón (acotado al subtotal). percent: value = porcentaje entero. */
export function calcularDescuento(subtotal: number, promo: PromoAplicable): number {
  const bruto = promo.type === 'percent' ? Math.round(subtotal * promo.value) / 100 : promo.value;
  return Math.min(bruto, subtotal);
}

/**
 * Envío y total. El envío es 0 si el cliente recoge en el salón o si el subtotal
 * alcanza el umbral de envío gratis; en otro caso, el costo por distancia. Total nunca negativo.
 */
export function calcularEnvioYTotal(
  subtotal: number,
  descuento: number,
  envio: EnvioPedidoCalc,
): { shipping: number; total: number } {
  let shipping = 0;
  if (!envio.recojoEnSalon) {
    shipping = subtotal >= envio.envioGratisDesde ? 0 : envio.costoEnvio;
  }
  const total = Math.max(0, subtotal + shipping - descuento);
  return { shipping, total };
}
