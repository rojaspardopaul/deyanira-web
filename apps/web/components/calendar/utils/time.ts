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

/** 24-hour integer → "12 AM" / "1 PM" / "12 PM" */
export function hourToAMPM(h: number): string {
  if (h === 0)  return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
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
