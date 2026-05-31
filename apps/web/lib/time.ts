// Formato de hora 12h (a.m./p.m.) para TODA la app pública/cliente.
// El admin/calendario tiene su propia copia en components/calendar/utils/time.ts.

/** "HH:MM" (24h) → "1:30 p.m." */
export function fmtTime12(hhmm?: string | null): string {
  if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return hhmm || '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h < 12 ? 'a.m.' : 'p.m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** "HH:MM"–"HH:MM" → "1:30 – 2:15 p.m." */
export function fmtRange12(start?: string | null, end?: string | null): string {
  if (!end) return fmtTime12(start);
  return `${fmtTime12(start)} – ${fmtTime12(end)}`;
}
