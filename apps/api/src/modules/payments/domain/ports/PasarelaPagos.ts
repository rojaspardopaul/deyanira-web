// Puerto de la pasarela de pagos (Culqi). La implementación reutiliza
// lib/payments/culqi.js (createCharge) sin reescribir la llamada HTTPS.

export interface CargoPagos {
  token: string;
  montoCentimos: number;
  email: string;
  descripcion: string;
  idempotencyKey: string;
}

export interface ResultadoCargo {
  readonly id: string;
}

/** Error de la pasarela con el código devuelto por Culqi (p. ej. 'already_exists'). */
export interface ErrorPasarela extends Error {
  culqiCode?: string;
  culqiStatus?: number;
}

export interface PasarelaPagos {
  /** Crea un cargo con tarjeta. Lanza ErrorPasarela si la pasarela rechaza. */
  crearCargo(cargo: CargoPagos): Promise<ResultadoCargo>;
}
