// Adaptador de la pasarela Culqi para el cobro del adelanto. Reutiliza
// lib/payments/culqi.js. Los errores con culqiCode propagan tal cual.

import type { CargoAdelanto, PasarelaPagos, ResultadoCargo } from '../domain/ports/PasarelaPagos';

/* eslint-disable @typescript-eslint/no-var-requires */
const { createCharge } = require('../../../lib/payments/culqi') as {
  createCharge: (args: {
    token: string;
    amountCentimos: number;
    email: string;
    description: string;
    idempotencyKey: string;
  }) => Promise<{ id: string }>;
};

export class CulqiGateway implements PasarelaPagos {
  crearCargo(cargo: CargoAdelanto): Promise<ResultadoCargo> {
    return createCharge({
      token: cargo.token,
      amountCentimos: cargo.montoCentimos,
      email: cargo.email,
      description: cargo.descripcion,
      idempotencyKey: cargo.idempotencyKey,
    });
  }
}
