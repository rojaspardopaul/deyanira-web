// Caso de uso: alta manual de una cita individual desde el panel admin.
// Equivale a la ruta legacy POST /api/admin/appointments. NO envía correo (el
// legacy tampoco). Conserva los mensajes de validación originales.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { FranjaHoraria } from '../domain/FranjaHoraria';
import { ESTADO_A_BD } from '../domain/mapeoEstado';
import {
  SolicitudCitaInvalidaError,
  ServicioNoEncontradoError,
  CitaEnPasadoError,
  HorarioNoDisponibleError,
} from '../domain/errors';
import type { CitaPersistida, CitaRepositorio } from '../domain/ports/CitaRepositorio';
import type { Reloj } from '../domain/ports/Reloj';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const ESTADOS_BD = new Set(Object.values(ESTADO_A_BD));

export interface CrearCitaAdminComando {
  readonly staffId?: string | null;
  readonly serviceId?: string;
  readonly date?: string;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly guestName?: string;
  readonly guestPhone?: string | null;
  readonly guestEmail?: string | null;
  readonly notes?: string | null;
  readonly status?: string;
}

export class CrearCitaAdmin {
  constructor(
    private readonly citas: CitaRepositorio,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(ctx: ContextoTenant, c: CrearCitaAdminComando): Promise<CitaPersistida> {
    const { serviceId, date, startTime, endTime } = c;
    if (!serviceId || !date || !startTime || !endTime) {
      throw new SolicitudCitaInvalidaError('serviceId, date, startTime y endTime son requeridos');
    }

    // staffId opcional → estilista de turno
    const resolvedStaffId = c.staffId && c.staffId !== 'on-duty' ? c.staffId : null;
    if (resolvedStaffId && !UUID_RE.test(resolvedStaffId)) {
      throw new SolicitudCitaInvalidaError('staffId inválido');
    }
    if (!UUID_RE.test(serviceId)) {
      throw new SolicitudCitaInvalidaError('serviceId inválido');
    }
    if (!DATE_RE.test(date) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      throw new SolicitudCitaInvalidaError('Formato de fecha u hora inválido');
    }
    if (startTime >= endTime) {
      throw new SolicitudCitaInvalidaError('La hora de fin debe ser posterior a la hora de inicio');
    }
    if (!c.guestName || !String(c.guestName).trim()) {
      throw new SolicitudCitaInvalidaError('Nombre del cliente es requerido');
    }

    // No se pueden crear citas en el pasado (zona Lima)
    const ahora = this.reloj.ahoraLima();
    if (date < ahora.fecha) {
      throw new CitaEnPasadoError('No se pueden crear citas en fechas pasadas');
    }
    if (date === ahora.fecha && startTime < ahora.hora) {
      throw new CitaEnPasadoError('La hora seleccionada ya pasó');
    }

    const servicio = await this.citas.buscarServicioBasico(ctx, serviceId);
    if (!servicio) throw new ServicioNoEncontradoError('Servicio no encontrado');

    const franja = FranjaHoraria.de(startTime, endTime);
    const estadoBd = c.status && ESTADOS_BD.has(c.status) ? c.status : 'confirmed';

    // Conflicto: si hay estilista específico, no debe solapar otra cita activa
    if (resolvedStaffId) {
      const conflicto = await this.citas.buscarConflictoAdmin(ctx, {
        staffId: resolvedStaffId,
        fecha: date,
        franja,
      });
      if (conflicto) {
        throw new HorarioNoDisponibleError(
          `La estilista ya tiene una cita de "${conflicto.servicioNombre}" entre ${conflicto.inicio} y ${conflicto.fin}`,
        );
      }
    }

    return this.citas.crearAdmin(ctx, {
      staffId: resolvedStaffId,
      serviceId,
      fecha: date,
      franja,
      estadoBd,
      totalPen: servicio.pricePen,
      notas: c.notes ? String(c.notes).slice(0, 500) : null,
      guestName: String(c.guestName).slice(0, 100),
      guestPhone: c.guestPhone ? String(c.guestPhone).slice(0, 20) : null,
      guestEmail: c.guestEmail ? String(c.guestEmail).slice(0, 100) : null,
    });
  }
}
