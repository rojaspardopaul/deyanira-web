// Vocabulario del dominio financiero: tipos, dirección, origen y estado de un
// movimiento. Son las constantes canónicas que comparten dominio, persistencia
// y validación de entrada (presentación).

export type Direccion = 'in' | 'out';

export type TipoMovimiento =
  | 'ingreso'
  | 'egreso'
  | 'adelanto'
  | 'pago_final'
  | 'venta'
  | 'reembolso'
  | 'ajuste'
  | 'transferencia'
  | 'comision'
  | 'impuesto';

export type FuenteMovimiento =
  | 'appointment'
  | 'booking_payment'
  | 'order'
  | 'expense'
  | 'other_income'
  | 'manual';

export type EstadoMovimiento = 'settled' | 'pending' | 'void';

export const TIPOS_MOVIMIENTO: TipoMovimiento[] = [
  'ingreso', 'egreso', 'adelanto', 'pago_final', 'venta',
  'reembolso', 'ajuste', 'transferencia', 'comision', 'impuesto',
];

export const FUENTES_MOVIMIENTO: FuenteMovimiento[] = [
  'appointment', 'booking_payment', 'order', 'expense', 'other_income', 'manual',
];

export const METODOS_PAGO = [
  'efectivo', 'transferencia', 'tarjeta', 'yape', 'plin', 'culqi',
] as const;

// Dirección contable implícita de cada tipo. `null` ⇒ depende del contexto
// (ajuste/transferencia pueden ser entrada o salida y se pasan explícitos).
const DIRECCION_POR_TIPO: Record<TipoMovimiento, Direccion | null> = {
  ingreso: 'in',
  adelanto: 'in',
  pago_final: 'in',
  venta: 'in',
  egreso: 'out',
  comision: 'out',
  impuesto: 'out',
  reembolso: 'out',
  ajuste: null,
  transferencia: null,
};

/** Resuelve la dirección de un tipo; usa `fallback` cuando el tipo es ambiguo. */
export function direccionDeTipo(tipo: TipoMovimiento, fallback: Direccion = 'in'): Direccion {
  return DIRECCION_POR_TIPO[tipo] ?? fallback;
}
