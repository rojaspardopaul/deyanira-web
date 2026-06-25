import { SNAP_MINUTES } from '../constants';

/** "HH:MM" → total minutes since midnight */
export function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** total minutes since midnight → "HH:MM" */
export function minToHHMM(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** 24-hour integer → "12 a.m." / "1 p.m." / "12 p.m." */
export function hourToAMPM(h: number): string {
  if (h === 0)  return '12 a.m.';
  if (h === 12) return '12 p.m.';
  return h < 12 ? `${h} a.m.` : `${h - 12} p.m.`;
}

/** "HH:MM" (24h) → "1:30 p.m." — formato 12h para TODA la UI (estilistas/clientes) */
export function fmtTime12(hhmm: string): string {
  if (!hhmm || !hhmm.includes(':')) return hhmm || '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h < 12 ? 'a.m.' : 'p.m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** "HH:MM"–"HH:MM" → "1:30 – 2:15 p.m." (rango 12h) */
export function fmtRange12(start: string, end: string): string {
  return `${fmtTime12(start)} – ${fmtTime12(end)}`;
}

/**
 * Snaps minutes to the nearest multiple of `snap`.
 * @example snapToGrid(67, 15) → 75  (i.e. 01:15)
 */
export function snapToGrid(minutes: number, snap = SNAP_MINUTES): number {
  return Math.round(minutes / snap) * snap;
}

/**
 * Clamps a value between min and max (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
