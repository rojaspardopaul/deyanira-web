// Mapeo del estado entre el lenguaje ubicuo (español, dominio) y los valores
// persistidos en la BD (inglés). Es parte del lenguaje del dominio, por eso vive
// aquí; lo consumen tanto el caso de uso como el mapper de infraestructura.

import type { EstadoCita } from './EstadoCita';

export const ESTADO_A_BD: Record<EstadoCita, string> = {
  pendiente: 'pending',
  confirmada: 'confirmed',
  cancelada: 'cancelled',
  completada: 'completed',
  no_asistio: 'no_show',
};

const BD_A_ESTADO: Record<string, EstadoCita> = {
  pending: 'pendiente',
  confirmed: 'confirmada',
  cancelled: 'cancelada',
  completed: 'completada',
  no_show: 'no_asistio',
};

export function aEstadoBd(estado: EstadoCita): string {
  return ESTADO_A_BD[estado];
}

export function estadoDesdeBd(valorBd: string): EstadoCita {
  return BD_A_ESTADO[valorBd] ?? 'pendiente';
}
