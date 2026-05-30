// Helpers puros de fecha/hora para DateTimePicker.
// Reglas del proyecto:
//   • fecha = 'YYYY-MM-DD', hora = 'HH:mm' (24h)
//   • Zona horaria America/Lima: para construir un Date a partir de una fecha
//     date-only SIEMPRE se usa el padding 'T12:00:00' y así evitar el
//     corrimiento de día en offsets negativos.

export const DEFAULT_LOCALE = 'es-PE';

/** Date → 'YYYY-MM-DD' en horario local. */
export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' → Date local al mediodía (evita corrimiento de día). */
export function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Devuelve un Date desplazado n días. */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Lunes de la semana ISO que contiene a `d`. */
export function getWeekStart(d: Date): Date {
  const day = d.getDay(); // 0 = domingo
  return addDays(d, day === 0 ? -6 : 1 - day);
}

/** 'YYYY-MM-DD' de hoy. */
export function todayYMD(): string {
  return toYMD(new Date());
}

/** Compara dos 'YYYY-MM-DD' lexicográficamente (= cronológico). <0, 0, >0 */
export function compareYMD(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Construye 'YYYY-MM-DD' a partir de año, mes (0-based) y día. */
export function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 'HH:mm' → minutos desde medianoche. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** minutos → 'HH:mm'. */
export function minutesToTime(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, min));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

/** ¿Es un 'HH:mm' válido (00:00–23:59)? */
export function isValidTime(hhmm: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm);
}

/** Redondea 'HH:mm' al múltiplo de `step` minutos más cercano. */
export function roundToStep(hhmm: string, step: number): string {
  if (!isValidTime(hhmm) || step <= 0) return hhmm;
  const min = timeToMinutes(hhmm);
  return minutesToTime(Math.round(min / step) * step);
}

/**
 * Genera opciones 'HH:mm' entre minTime y maxTime (inclusive) cada `step` min.
 */
export function generateTimeOptions(minTime = '00:00', maxTime = '23:59', step = 5): string[] {
  const out: string[] = [];
  const start = timeToMinutes(minTime);
  const end = timeToMinutes(maxTime);
  for (let m = start; m <= end; m += step) out.push(minutesToTime(m));
  return out;
}

// ── Hora 12h / 24h ────────────────────────────────────────────

/** 'HH:mm' (24h) → componentes 12h. medianoche 00:xx → 12 a.m.; 12:xx → 12 p.m. */
export function to12h(hhmm: string): { hour12: number; minute: number; meridiem: 'am' | 'pm' } {
  const [h, m] = hhmm.split(':').map(Number);
  const meridiem: 'am' | 'pm' = h < 12 ? 'am' : 'pm';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { hour12, minute: m, meridiem };
}

/** Componentes 12h → 'HH:mm' (24h). */
export function from12h(hour12: number, minute: number, meridiem: 'am' | 'pm'): string {
  let h = hour12 % 12;            // 12 → 0
  if (meridiem === 'pm') h += 12; // pm: +12 (12pm → 12, 1pm → 13)
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Etiqueta legible de una hora según formato. 12h → "9:00 a.m." / "6:30 p.m.". */
export function formatTimeLabel(hhmm: string, format: '12h' | '24h' = '12h'): string {
  if (!hhmm || !isValidTime(hhmm)) return hhmm || '';
  if (format === '24h') return hhmm;
  const { hour12, minute, meridiem } = to12h(hhmm);
  return `${hour12}:${String(minute).padStart(2, '0')} ${meridiem === 'am' ? 'a.m.' : 'p.m.'}`;
}

/** ¿La hora 'HH:mm' cae dentro de algún rango deshabilitado [start, end)? */
export function inDisabledRanges(hhmm: string, ranges?: { start: string; end: string }[]): boolean {
  if (!ranges?.length) return false;
  const m = timeToMinutes(hhmm);
  return ranges.some(r => m >= timeToMinutes(r.start) && m < timeToMinutes(r.end));
}

/** Fecha legible larga en español, p. ej. "sábado, 24 de mayo de 2026". */
export function formatDateLong(ymdStr: string, locale = DEFAULT_LOCALE): string {
  if (!ymdStr) return '';
  return parseYMD(ymdStr).toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Fecha corta, p. ej. "24 may". */
export function formatDateShort(ymdStr: string, locale = DEFAULT_LOCALE): string {
  if (!ymdStr) return '';
  return parseYMD(ymdStr).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** ¿La fecha está deshabilitada por min/max/lista? */
export function isDateDisabled(
  date: string,
  opts: { minDate?: string; maxDate?: string; disabledDates?: string[] },
): boolean {
  if (opts.minDate && compareYMD(date, opts.minDate) < 0) return true;
  if (opts.maxDate && compareYMD(date, opts.maxDate) > 0) return true;
  if (opts.disabledDates?.includes(date)) return true;
  return false;
}

export const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
export const MONTHS_SHORT_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** Encabezados de día empezando en lunes. */
export const DOW_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

/** Índice 0..6 (Lu..Do) de un Date. */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}
