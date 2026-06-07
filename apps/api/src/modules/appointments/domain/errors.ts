// Errores de dominio del módulo de citas. Todos extienden ErrorDominio para que
// el error handler HTTP los traduzca a su status en un único punto (Fase 1C),
// eliminando los `err.status = 409` dispersos del handler legacy.

import { ErrorDominio } from '../../../shared/domain/ErrorDominio';

export class RangoHorarioInvalidoError extends ErrorDominio {
  readonly codigo = 'rango_horario_invalido';
  readonly status = 400;
}

export class DatosInvitadoRequeridosError extends ErrorDominio {
  readonly codigo = 'datos_invitado_requeridos';
  readonly status = 400;
}

export class DireccionDomicilioRequeridaError extends ErrorDominio {
  readonly codigo = 'direccion_requerida';
  readonly status = 400;
}

export class DomicilioNoDisponibleError extends ErrorDominio {
  readonly codigo = 'domicilio_no_disponible';
  readonly status = 400;
}

export class CitaEnPasadoError extends ErrorDominio {
  readonly codigo = 'cita_en_pasado';
  readonly status = 400;
}

export class SeleccionRequeridaError extends ErrorDominio {
  readonly codigo = 'seleccion_requerida';
  readonly status = 400;
}

export class AnticipacionRequeridaError extends ErrorDominio {
  readonly codigo = 'anticipacion_requerida';
  readonly status = 400;
}

export class ServicioNoDisponibleError extends ErrorDominio {
  readonly codigo = 'servicio_no_disponible';
  readonly status = 404;
}

export class EstilistaNoRealizaServicioError extends ErrorDominio {
  readonly codigo = 'estilista_no_realiza_servicio';
  readonly status = 409;
}

export class HorarioNoDisponibleError extends ErrorDominio {
  readonly codigo = 'horario_no_disponible';
  readonly status = 409;
}

export class CitaBloqueadaError extends ErrorDominio {
  readonly codigo = 'cita_bloqueada';
  readonly status = 409;
}

export class DemasiadasCitasActivasError extends ErrorDominio {
  readonly codigo = 'demasiadas_citas_activas';
  readonly status = 429;
}

export class CitaNoEncontradaError extends ErrorDominio {
  readonly codigo = 'cita_no_encontrada';
  readonly status = 404;
}

export class CitaNoCancelableError extends ErrorDominio {
  readonly codigo = 'cita_no_cancelable';
  readonly status = 400;
}

// ── Reserva en lote (paquetes) ────────────────────────────────
export class PaqueteNoEncontradoError extends ErrorDominio {
  readonly codigo = 'paquete_no_encontrado';
  readonly status = 404;
}

export class ServicioNoEncontradoError extends ErrorDominio {
  readonly codigo = 'servicio_no_encontrado';
  readonly status = 404;
}

export class FechaItemInvalidaError extends ErrorDominio {
  readonly codigo = 'fecha_item_invalida';
  readonly status = 400;
}
