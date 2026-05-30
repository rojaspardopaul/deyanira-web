import type { Appointment, LayoutInfo } from '../types';

/**
 * Computes side-by-side column positions for overlapping appointments.
 *
 * Algorithm:
 * 1. Sort appointments by startTime (then endTime).
 * 2. Greedily assign each appointment to the first column whose last event
 *    has already ended.
 * 3. For each appointment, count how many appointments overlap with it to
 *    determine totalCols (so all items in an overlap cluster share the same width).
 *
 * Returns a Map<aptId, { col, totalCols }>.
 */
export function computeOverlapLayout(apts: Appointment[]): Map<string, LayoutInfo> {
  const sorted = [...apts].sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime),
  );

  const colEndTime: string[] = [];
  const placement = new Map<string, number>();

  for (const apt of sorted) {
    let col = 0;
    while (col < colEndTime.length && colEndTime[col] > apt.startTime) col++;
    if (col >= colEndTime.length) colEndTime.push(apt.endTime);
    else colEndTime[col] = apt.endTime;
    placement.set(apt.id, col);
  }

  const layout = new Map<string, LayoutInfo>();
  for (const apt of sorted) {
    const overlapping = sorted.filter(
      o => o.startTime < apt.endTime && o.endTime > apt.startTime,
    );
    const maxCol = Math.max(...overlapping.map(o => placement.get(o.id)!));
    layout.set(apt.id, { col: placement.get(apt.id)!, totalCols: maxCol + 1 });
  }

  return layout;
}
