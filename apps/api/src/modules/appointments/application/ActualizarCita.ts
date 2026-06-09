// Caso de uso: edición admin de una cita — cambio de estado, reasignación de
// estilista, notas Y reprogramación (fecha/hora), con validación de conflicto en
// el destino y el abanico de notificaciones al cliente. Equivale a la ruta legacy
// PATCH /api/admin/appointments/:id.
//
// La autorización (un estilista no puede cancelar) se resuelve en la presentación
// (403), antes de invocar este caso de uso.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { FranjaHoraria } from '../domain/FranjaHoraria';
import { ESTADO_A_BD, estadoDesdeBd } from '../domain/mapeoEstado';
import {
  SolicitudCitaInvalidaError,
  CitaNoEncontradaError,
  HorarioNoDisponibleError,
} from '../domain/errors';
import type { CitaPersistida, CitaRepositorio, CambiosCitaAdmin } from '../domain/ports/CitaRepositorio';
import type { Notificador } from '../domain/ports/Notificador';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_OK = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
const ESTADOS_BD = new Set(Object.values(ESTADO_A_BD));

export interface ActualizarCitaComando {
  readonly citaId: string;
  readonly status?: string;
  readonly staffId?: string | null; // assignStaffId (undefined = no reasignar)
  readonly notes?: string | null;
  readonly date?: string;
  readonly startTime?: string;
  readonly endTime?: string;
}

export class ActualizarCita {
  constructor(
    private readonly citas: CitaRepositorio,
    private readonly notificador: Notificador,
  ) {}

  async ejecutar(ctx: ContextoTenant, c: ActualizarCitaComando): Promise<CitaPersistida> {
    const current = await this.citas.buscarPorId(ctx, c.citaId);
    if (!current) throw new CitaNoEncontradaError('Cita no encontrada');

    const cambios: {
      estado?: CambiosCitaAdmin['estado'];
      fecha?: string;
      startTime?: string;
      endTime?: string;
      staff?: { staffId: string | null };
      notas?: { valor: string | null };
    } = {};

    // ── Estado ──
    if (c.status) {
      if (!ESTADOS_BD.has(c.status)) throw new SolicitudCitaInvalidaError('Estado de cita inválido');
      cambios.estado = estadoDesdeBd(c.status);
    }

    // ── Reprogramación (fecha/hora) ──
    const curIso = current.date ? new Date(current.date as string).toISOString().slice(0, 10) : null;
    let targetFecha = curIso;
    let targetStart = current.startTime as string;
    let targetEnd = current.endTime as string;
    if (c.date !== undefined) {
      if (!DATE_OK.test(c.date)) throw new SolicitudCitaInvalidaError('Fecha inválida');
      cambios.fecha = c.date;
      targetFecha = c.date;
    }
    if (c.startTime !== undefined) {
      if (!TIME_OK.test(c.startTime)) throw new SolicitudCitaInvalidaError('Hora de inicio inválida');
      cambios.startTime = c.startTime;
      targetStart = c.startTime;
    }
    if (c.endTime !== undefined) {
      if (!TIME_OK.test(c.endTime)) throw new SolicitudCitaInvalidaError('Hora de fin inválida');
      cambios.endTime = c.endTime;
      targetEnd = c.endTime;
    }
    if (targetStart >= targetEnd) {
      throw new SolicitudCitaInvalidaError('La hora de fin debe ser posterior a la de inicio');
    }
    const isReschedule =
      (c.date !== undefined && c.date !== curIso) ||
      (c.startTime !== undefined && c.startTime !== current.startTime) ||
      (c.endTime !== undefined && c.endTime !== current.endTime);

    // ── Reasignación de estilista ──
    if (c.staffId !== undefined) {
      if (c.staffId && !UUID_RE.test(c.staffId)) throw new SolicitudCitaInvalidaError('staffId inválido');
      cambios.staff = { staffId: c.staffId || null };
    }

    // ── Conflicto en el destino (estilista + fecha/hora), excluyendo la propia ──
    const targetStaff = c.staffId !== undefined ? c.staffId || null : (current.staffId as string | null);
    if (targetStaff && (isReschedule || (c.staffId !== undefined && c.staffId))) {
      const franja = FranjaHoraria.de(targetStart, targetEnd);
      const conflicto = await this.citas.buscarConflictoAdmin(ctx, {
        staffId: targetStaff,
        fecha: targetFecha as string,
        franja,
        exceptId: c.citaId,
        incluirEnProceso: true,
      });
      if (conflicto) {
        throw new HorarioNoDisponibleError(
          `Esa estilista ya tiene una cita de "${conflicto.servicioNombre}" entre ${conflicto.inicio} y ${conflicto.fin}`,
        );
      }
    }

    // ── Notas ──
    if (c.notes !== undefined) {
      cambios.notas = { valor: c.notes ? String(c.notes).slice(0, 500) : null };
    }

    if (Object.keys(cambios).length === 0) {
      throw new SolicitudCitaInvalidaError('Nada que actualizar');
    }

    const updated = await this.citas.actualizarAdmin(ctx, c.citaId, cambios);

    // ── Notificaciones al cliente (fire-and-forget en el adaptador) ──
    // Paquetes: las confirmaciones van por "Confirmar grupo" (correo consolidado).
    const email = updated.guestEmail as string | null;
    const nombre = (updated.guestName as string | null) || 'Cliente';
    const isPackage = !!updated.packageId;

    if (isReschedule && email) {
      this.notificador.citaReprogramada(
        updated,
        { email, nombre },
        { fecha: current.date as Date | string, hora: current.startTime as string },
      );
    }

    if (c.status && email) {
      if (c.status === 'confirmed' && !isPackage) {
        this.notificador.citaConfirmada(updated, { email, nombre });
      } else if (c.status === 'in_progress' && !isPackage) {
        this.notificador.citaEnProceso(updated, { email, nombre });
      } else if (c.status === 'completed' && !isPackage) {
        this.notificador.citaCompletada(updated, { email, nombre });
      } else if (c.status === 'cancelled') {
        this.notificador.citaCancelada(updated, { email, nombre }, 'Cancelado por el salón');
      } else if (c.status === 'no_show') {
        this.notificador.citaNoAsistio(updated, { email, nombre });
      }
    }

    return updated;
  }
}
