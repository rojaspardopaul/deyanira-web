// DTO de salida de la reserva en lote. Preserva el contrato HTTP legacy del batch.

import type { CitaPersistida } from '../../domain/ports/CitaRepositorio';

export interface ReservaResultadoJSON {
  appointments: CitaPersistida[];
  atHomeExtraPen: number | null;
  total: number;
  bookingGroupId: string;
  package: { id: string; name: string; pricePen: number } | null;
  requiresDeposit: boolean;
  depositPen: number;
  depositPercent: number;
  bookingPaymentId: string | null;
}

export class ReservaResultado {
  private constructor(private readonly json: ReservaResultadoJSON) {}

  static desde(json: ReservaResultadoJSON): ReservaResultado {
    return new ReservaResultado(json);
  }

  aJSON(): ReservaResultadoJSON {
    return this.json;
  }
}
