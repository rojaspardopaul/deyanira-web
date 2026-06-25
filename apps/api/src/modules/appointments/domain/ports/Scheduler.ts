// Puerto de programación de lotes. Implementación reutiliza lib/booking/scheduleBatch.js
// (cálculo secuencial por estilista/fecha + parallelGroup + días entre fechas) sin reescribir.

import type { ServicioLote } from './CatalogoReservas';

export interface ItemProgramable {
  readonly serviceId: string;
  readonly staffId?: string | null;
  readonly onDuty?: boolean;
  readonly date?: string;
  readonly startTime?: string;
  readonly addonPricePen?: number;
  readonly modifierSelections?: Record<string, unknown>;
}

export interface CitaProgramada {
  readonly serviceId: string;
  readonly staffId: string | null;
  readonly onDutyStaff: boolean;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly addonPricePen: number;
  readonly service: ServicioLote;
}

export interface Scheduler {
  programar(params: {
    items: ItemProgramable[];
    serviceById: Map<string, ServicioLote>;
    date: string;
    startTime: string;
  }): CitaProgramada[];

  /** Días entre dos 'YYYY-MM-DD' (positivo = otherDate anterior a mainDate). */
  diasEntre(mainDate: string, otherDate: string): number;
}
