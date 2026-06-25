// Helpers de período para filtros de fecha (admin). Compartidos por el dashboard
// (/admin) y la pantalla de citas (/admin/citas). Las fechas se manejan como
// 'YYYY-MM-DD' (contrato del backend); la semana arranca en lunes (America/Lima).

export type PeriodMode = 'day' | 'week' | 'month' | 'custom';

/** Fecha local → 'YYYY-MM-DD' (sin pisar el día por zona horaria UTC). */
export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Rango de la semana actual (lunes→domingo) en 'YYYY-MM-DD'. */
export function getWeekRange(ref = new Date()): { from: string; to: string } {
  const day = ref.getDay();
  const diff = day === 0 ? -6 : 1 - day; // domingo=0 → retrocede al lunes
  const mon = new Date(ref); mon.setDate(ref.getDate() + diff);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: toISO(mon), to: toISO(sun) };
}

/** Rango del mes actual (día 1 → último día) en 'YYYY-MM-DD'. */
export function getMonthRange(ref = new Date()): { from: string; to: string } {
  return {
    from: toISO(new Date(ref.getFullYear(), ref.getMonth(), 1)),
    to: toISO(new Date(ref.getFullYear(), ref.getMonth() + 1, 0)),
  };
}

/** El período inmediatamente anterior a un rango [from..to], de la misma longitud. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const a = new Date(from + 'T12:00:00');
  const b = new Date(to + 'T12:00:00');
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
  const prevTo = new Date(a); prevTo.setDate(a.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevTo.getDate() - (days - 1));
  return { from: toISO(prevFrom), to: toISO(prevTo) };
}
