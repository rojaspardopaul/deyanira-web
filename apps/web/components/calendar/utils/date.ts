import type { Appointment } from '../types';

/** Date → YYYY-MM-DD (local timezone) */
export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns a new Date shifted by n days */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Returns the Monday of the ISO week that contains d */
export function getWeekStart(d: Date): Date {
  const day = d.getDay(); // 0=Sunday
  return addDays(d, day === 0 ? -6 : 1 - day);
}

/**
 * Extracts YYYY-MM-DD from an Appointment without timezone shift.
 * The backend may send "2026-05-16T00:00:00.000Z"; slicing the first 10 chars
 * always returns the intended local date, independent of the viewer's timezone.
 */
export function aptDateStr(apt: Appointment): string {
  const v = apt.date as unknown;
  if (typeof v === 'string') return (v as string).slice(0, 10);
  // Rare case: Date object — use UTC to avoid losing a day in negative-offset TZs
  const d = v as Date;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Returns true when the given YYYY-MM-DD is strictly before today */
export function isPastDate(date: string): boolean {
  return date < toYMD(new Date());
}

/** Returns true when the given date+time combination is in the past */
export function isPastDateTime(date: string, time: string): boolean {
  const today = new Date();
  if (date < toYMD(today)) return true;
  if (date > toYMD(today)) return false;
  const now = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
  return time < now;
}

/** Convenience: client display name from an appointment */
export function clientName(apt: Appointment): string {
  return apt.customer?.name || apt.guestName || 'Sin nombre';
}
