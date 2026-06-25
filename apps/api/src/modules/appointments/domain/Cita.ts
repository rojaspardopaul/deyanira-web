// Entidad Cita (clase plana, sin base abstracta de framework).
//
// Modela la creación de una reserva y sus INVARIANTES ESTRUCTURALES (las que no
// dependen del reloj ni de la BD): franja válida, identidad del solicitante
// (cliente registrado o invitado con nombre) y coherencia del servicio a domicilio.
//
// Las reglas que dependen del tiempo (no en el pasado, anticipación) o de datos
// externos (conflictos, precio, disponibilidad) las orquesta el caso de uso, no
// la entidad.

import { Dinero } from '../../../shared/domain/Dinero';
import { FranjaHoraria } from './FranjaHoraria';
import { EstadoCita, ESTADO_INICIAL } from './EstadoCita';
import { DatosInvitadoRequeridosError, DireccionDomicilioRequeridaError } from './errors';

/** Identidad del solicitante: cliente registrado o invitado. */
export interface Solicitante {
  readonly customerId: string | null;
  readonly guestName: string | null;
  readonly guestPhone: string | null;
  readonly guestEmail: string | null;
}

/** Datos de servicio a domicilio (a domicilio = atHome). */
export interface Domicilio {
  readonly aDomicilio: boolean;
  readonly direccion: string | null;
  readonly distrito: string | null;
  readonly recargo: Dinero | null;
}

export interface CrearCitaProps {
  readonly servicioId: string;
  readonly staffId: string | null;
  readonly onDutyStaff: boolean;
  readonly fecha: string; // 'YYYY-MM-DD'
  readonly franja: FranjaHoraria;
  readonly total: Dinero;
  readonly notas: string | null;
  readonly solicitante: Solicitante;
  readonly domicilio: Domicilio;
  readonly bookingGroupId?: string | null;
  readonly packageId?: string | null;
}

export class Cita {
  private constructor(
    readonly servicioId: string,
    readonly staffId: string | null,
    readonly onDutyStaff: boolean,
    readonly fecha: string,
    readonly franja: FranjaHoraria,
    readonly estado: EstadoCita,
    readonly total: Dinero,
    readonly notas: string | null,
    readonly solicitante: Solicitante,
    readonly domicilio: Domicilio,
    readonly bookingGroupId: string | null,
    readonly packageId: string | null,
  ) {}

  /** Fábrica que valida las invariantes estructurales y nace en estado 'pendiente'. */
  static crear(props: CrearCitaProps): Cita {
    if (!props.solicitante.customerId && !props.solicitante.guestName) {
      throw new DatosInvitadoRequeridosError('Se requiere nombre para reservar como invitado');
    }
    if (props.domicilio.aDomicilio && !props.domicilio.direccion) {
      throw new DireccionDomicilioRequeridaError('La dirección es requerida para servicios a domicilio');
    }

    return new Cita(
      props.servicioId,
      props.staffId,
      props.onDutyStaff,
      props.fecha,
      props.franja,
      ESTADO_INICIAL,
      props.total,
      props.notas,
      props.solicitante,
      props.domicilio,
      props.bookingGroupId ?? null,
      props.packageId ?? null,
    );
  }
}
