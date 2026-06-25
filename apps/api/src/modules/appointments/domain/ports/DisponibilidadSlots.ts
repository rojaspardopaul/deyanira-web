// Puerto de consulta de slots disponibles. La implementación reutiliza
// lib/booking/availability.js (getAvailableSlots) sin reescribir el algoritmo.

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';

export interface Slot {
  readonly start: string;
  readonly end: string;
}

export interface ConsultaDisponibilidad {
  readonly staffId: string | null; // null = estilista de turno
  readonly serviceId: string;
  readonly fecha: string; // 'YYYY-MM-DD'
  readonly duracionOverride: number | null;
  readonly forPackage: boolean;
}

export interface DisponibilidadSlots {
  slots(ctx: ContextoTenant, consulta: ConsultaDisponibilidad): Promise<Slot[]>;
}
