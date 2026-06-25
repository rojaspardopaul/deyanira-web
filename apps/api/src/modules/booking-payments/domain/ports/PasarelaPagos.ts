// Puerto de la pasarela de pagos (Culqi) para el cobro del adelanto con tarjeta.
// La implementación reutiliza lib/payments/culqi.js.

export interface CargoAdelanto {
  readonly token: string;
  readonly montoCentimos: number;
  readonly email: string;
  readonly descripcion: string;
  readonly idempotencyKey: string;
}

export interface ResultadoCargo {
  readonly id: string;
}

/** Error de la pasarela con código Culqi (p. ej. 'already_exists'). */
export interface ErrorPasarela extends Error {
  culqiCode?: string;
}

export interface PasarelaPagos {
  crearCargo(cargo: CargoAdelanto): Promise<ResultadoCargo>;
}
