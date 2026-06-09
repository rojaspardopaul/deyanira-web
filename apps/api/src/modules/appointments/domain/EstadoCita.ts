// Estado de una cita en el lenguaje ubicuo del negocio (español).
//
// Los valores persistidos en la BD están en inglés ('pending', 'confirmed'...);
// la traducción dominio<->persistencia vive en el mapper de infraestructura
// (Fase 1B), no aquí. El dominio razona siempre en español.

export type EstadoCita = 'pendiente' | 'confirmada' | 'en_proceso' | 'cancelada' | 'completada' | 'no_asistio';

/** Estados que ocupan un horario para conflictos/límites del flujo público
 *  (cliente). El admin amplía el set con 'en_proceso' al validar conflictos de
 *  reprogramación/reasignación; ver CitaRepositorio.buscarConflictoAdmin. */
export const ESTADOS_ACTIVOS: readonly EstadoCita[] = ['pendiente', 'confirmada'];

/** Una cita recién solicitada nace pendiente (acuse "Solicitud recibida"). */
export const ESTADO_INICIAL: EstadoCita = 'pendiente';

export function esEstadoActivo(estado: EstadoCita): boolean {
  return ESTADOS_ACTIVOS.includes(estado);
}

export function puedeCancelarse(estado: EstadoCita): boolean {
  return estado !== 'cancelada' && estado !== 'completada';
}
