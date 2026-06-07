// Caso de uso (consulta): slots disponibles para staff/servicio/fecha.
// Equivale a GET /api/appointments/availability. La validación de formato de los
// parámetros (UUID de staff, rango de duración) se hace en la presentación.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { ConsultaDisponibilidad, DisponibilidadSlots, Slot } from '../domain/ports/DisponibilidadSlots';

export class ConsultarDisponibilidad {
  constructor(private readonly disponibilidad: DisponibilidadSlots) {}

  ejecutar(ctx: ContextoTenant, consulta: ConsultaDisponibilidad): Promise<Slot[]> {
    return this.disponibilidad.slots(ctx, consulta);
  }
}
