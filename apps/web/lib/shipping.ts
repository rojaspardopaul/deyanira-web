// Estimado de envío de productos en el front. Debe coincidir con el backend
// (apps/api/.../ConfiguracionEnvioPrisma + CalculadoraPedido), que es la autoridad.
// La página llama setShippingRates() con la config pública de settings.

const DIST_KM: Record<string, number> = {
  Cieneguilla: 0, Pachacámac: 12, 'La Molina': 14, Chaclacayo: 16, Ate: 18, Lurín: 18,
  Lurigancho: 20, 'Santa Anita': 20, Surco: 22, 'San Borja': 22, 'San Luis': 22, 'El Agustino': 22,
  'San Juan de Lurigancho': 24, 'La Victoria': 26, Surquillo: 26, 'Lima Cercado': 27, Lince: 27,
  Breña: 28, 'Jesús María': 28, 'Villa María del Triunfo': 28, Rímac: 29, Miraflores: 30,
  'San Isidro': 30, 'Pueblo Libre': 31, Barranco: 32, Magdalena: 32, Chorrillos: 33,
  'Villa El Salvador': 33, 'San Miguel': 34, 'San Martín de Porres': 36, Independencia: 37,
  'Los Olivos': 38, Comas: 42, Carabayllo: 46, 'Puente Piedra': 48, Otro: 30,
};

let rates = { enabled: true, basePen: 10, baseKm: 10, perKmPen: 1.5, freeOverPen: 150 };

export function setShippingRates(r: {
  shipEnabled?: unknown; shipBasePen?: unknown; shipBaseKm?: unknown;
  shipPerKmPen?: unknown; shipFreeOverPen?: unknown;
}) {
  const num = (v: unknown, fb: number) => (Number.isFinite(Number(v)) ? Number(v) : fb);
  rates = {
    enabled: r.shipEnabled === undefined ? rates.enabled : Boolean(r.shipEnabled),
    basePen: num(r.shipBasePen, rates.basePen),
    baseKm: num(r.shipBaseKm, rates.baseKm),
    perKmPen: num(r.shipPerKmPen, rates.perKmPen),
    freeOverPen: num(r.shipFreeOverPen, rates.freeOverPen),
  };
}

export function freeShippingThreshold(): number {
  return rates.freeOverPen;
}

/** Costo de envío a domicilio para un distrito (sin umbral de gratis ni recojo). */
export function shippingCost(district: string): number {
  const km = DIST_KM[district] ?? 30;
  return Math.round((rates.basePen + Math.max(0, km - rates.baseKm) * rates.perKmPen) * 100) / 100;
}

/** Envío final: 0 si recoge en salón o si alcanza el umbral; si no, el costo por distancia. */
export function shippingForOrder(opts: { subtotal: number; district: string; pickupInStore: boolean }): number {
  if (opts.pickupInStore) return 0;
  if (opts.subtotal >= rates.freeOverPen) return 0;
  return shippingCost(opts.district);
}
