// Adaptador de disponibilidad. Reutiliza lib/booking/availability.js (algoritmo de
// slots considerando horarios de staff, citas existentes y bloqueos) sin reescribirlo.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { ConsultaDisponibilidad, DisponibilidadSlots, Slot } from '../domain/ports/DisponibilidadSlots';

/* eslint-disable @typescript-eslint/no-var-requires */
const { getAvailableSlots } = require('../../../lib/booking/availability') as {
  getAvailableSlots: (
    staffId: string | null,
    serviceId: string,
    fecha: string,
    durationOverride: number | null,
    opts: { forPackage: boolean },
  ) => Promise<Slot[]>;
};

export class DisponibilidadSlotsLib implements DisponibilidadSlots {
  slots(_ctx: ContextoTenant, c: ConsultaDisponibilidad): Promise<Slot[]> {
    return getAvailableSlots(c.staffId, c.serviceId, c.fecha, c.duracionOverride, { forPackage: c.forPackage });
  }
}
