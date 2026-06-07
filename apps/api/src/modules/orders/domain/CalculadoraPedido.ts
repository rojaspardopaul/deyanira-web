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

const ENVIO_GRATIS_DESDE_PEN = 100;
const COSTO_ENVIO_PEN = 10;

export function calcularSubtotal(lineas: LineaCalculo[]): number {
  return lineas.reduce((s, l) => s + l.pricePen * l.qty, 0);
}

/** Descuento del cupón (acotado al subtotal). percent: value = porcentaje entero. */
export function calcularDescuento(subtotal: number, promo: PromoAplicable): number {
  const bruto = promo.type === 'percent' ? Math.round(subtotal * promo.value) / 100 : promo.value;
  return Math.min(bruto, subtotal);
}

/** Envío gratis sobre S/100; total nunca negativo. */
export function calcularEnvioYTotal(subtotal: number, descuento: number): { shipping: number; total: number } {
  const shipping = subtotal > ENVIO_GRATIS_DESDE_PEN ? 0 : COSTO_ENVIO_PEN;
  const total = Math.max(0, subtotal + shipping - descuento);
  return { shipping, total };
}
