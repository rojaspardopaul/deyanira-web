// Estados de cita y su presentación (label + colores). Compartido por el dashboard
// (/admin) y la pantalla de citas (/admin/citas). Estados de BD:
// pending | confirmed | in_progress | completed | cancelled | no_show.

export type AppointmentStatus =
  | 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export const STATUS_MAP: Record<string, { label: string; color: string; hex: string }> = {
  pending:     { label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-700', hex: '#eab308' },
  confirmed:   { label: 'Confirmada', color: 'bg-green-100 text-green-700',   hex: '#16a34a' },
  in_progress: { label: 'En curso',   color: 'bg-indigo-100 text-indigo-700', hex: '#6366f1' },
  completed:   { label: 'Completada', color: 'bg-blue-100 text-blue-700',     hex: '#3b82f6' },
  cancelled:   { label: 'Cancelada',  color: 'bg-red-100 text-red-500',       hex: '#ef4444' },
  no_show:     { label: 'No asistió', color: 'bg-gray-100 text-gray-500',     hex: '#9ca3af' },
};

/** Orden estable para chips, KPIs y diagramas. */
export const STATUS_ORDER: AppointmentStatus[] = [
  'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show',
];

export function statusLabel(status: string): string {
  return STATUS_MAP[status]?.label ?? status;
}
