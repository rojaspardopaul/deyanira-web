/** Hour when the time-grid starts (inclusive) */
export const HOUR_START = 7;

/** Hour when the time-grid ends (exclusive) */
export const HOUR_END = 21;

/** Pixel height of one hour row in the time-grid */
export const HOUR_HEIGHT = 64;

/** Snap granularity in minutes for drag and resize */
export const SNAP_MINUTES = 15;

export const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

export const DAY_NAMES_SHORT = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

export const DAY_NAMES_FULL  = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

// Day abbreviations starting from Sunday (for week strip, getDay() returns 0=Sun)
export const DAY_NAMES_SUN = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];

export const STAFF_COLORS = [
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#ec4899', // pink
  '#14b8a6', // teal
];

export function staffColor(index: number): string {
  return STAFF_COLORS[index % STAFF_COLORS.length];
}
