'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { adminApi } from '@/lib/api';
import { snapToGrid, timeToMin, minToHHMM, clamp } from '../utils/time';
import { aptDateStr } from '../utils/date';
import { HOUR_START, HOUR_END, HOUR_HEIGHT, SNAP_MINUTES } from '../constants';
import type { Appointment, DragState } from '../types';

type UseDragOptions = {
  onCommit?: (apt: Appointment, newDate: string, newStart: string, newEnd: string) => void;
  onRollback?: (apt: Appointment) => void;
};

/**
 * Drag-to-reschedule via native pointer events on window (no setPointerCapture).
 *
 * Views must mark:
 *   - Time-grid container: data-cal-grid="1"
 *   - Each day/staff column: data-cal-date="YYYY-MM-DD" (and optionally data-cal-staff="id")
 *
 * Usage in CalendarRoot:
 *   const { dragState, handleDragStart } = useDrag({ onCommit, onRollback });
 *   // Pass handleDragStart to WeekView/DayView as onDragStart prop
 */
export function useDrag({ onCommit, onRollback }: UseDragOptions = {}) {
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Stable refs so window listeners always see current values without useCallback churn
  const stateRef = useRef<DragState | null>(null);
  const durationRef = useRef(0);
  const originalRef = useRef<Appointment | null>(null);
  const optionsRef = useRef({ onCommit, onRollback });
  optionsRef.current = { onCommit, onRollback };

  const listenersActive = useRef(false);

  function setState(s: DragState | null) {
    stateRef.current = s;
    setDragState(s);
  }

  // ── Global handlers (stored in refs — same reference for add/remove) ─────
  const onMove = useRef((e: PointerEvent) => {
    const prev = stateRef.current;
    if (!prev) return;

    if (!prev.isDragging && Math.abs(e.clientY - prev.pointerY) < 4) return;

    // Locate the column being hovered via data attribute (works through scroll)
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const colEl = el?.closest('[data-cal-date]') as HTMLElement | null;
    const targetDate = colEl?.dataset.calDate || prev.targetDate;
    const targetStaffId = colEl?.dataset.calStaff || prev.targetStaffId;

    // Get grid top from the nearest data-cal-grid ancestor
    const gridEl = el?.closest('[data-cal-grid]') as HTMLElement | null;
    const gridTop = gridEl?.getBoundingClientRect().top ?? 0;

    const relY = e.clientY - gridTop - prev.offsetY;
    const rawMin = HOUR_START * 60 + (relY / HOUR_HEIGHT) * 60;
    const snappedMin = clamp(
      snapToGrid(rawMin, SNAP_MINUTES),
      HOUR_START * 60,
      (HOUR_END - 1) * 60,
    );
    const snappedStart = minToHHMM(snappedMin);
    const snappedEnd = minToHHMM(Math.min(snappedMin + durationRef.current, HOUR_END * 60));

    const next: DragState = {
      ...prev,
      isDragging: true,
      targetDate,
      targetStaffId,
      snappedStart,
      snappedEnd,
      pointerY: e.clientY,
    };
    setState(next);
  });

  const onUp = useRef(async () => {
    detach();
    const state = stateRef.current;
    const apt = originalRef.current;
    setState(null);

    if (!state?.isDragging || !apt) return;
    if (
      state.targetDate === state.originalDate &&
      state.snappedStart === state.originalStartTime
    ) return;

    optionsRef.current.onCommit?.(apt, state.targetDate, state.snappedStart, state.snappedEnd);
    try {
      const patch: Record<string, string> = {
        startTime: state.snappedStart,
        endTime: state.snappedEnd,
      };
      if (state.targetDate !== state.originalDate) patch.date = state.targetDate;
      if (state.targetStaffId && state.targetStaffId !== apt.staff?.id) {
        patch.staffId = state.targetStaffId;
      }
      await adminApi().appointments.update(apt.id, patch);
    } catch {
      optionsRef.current.onRollback?.({
        ...apt,
        date: state.originalDate,
        startTime: state.originalStartTime,
        endTime: state.originalEndTime,
      });
    }
  });

  const onKey = useRef((e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    detach();
    const isDragging = stateRef.current?.isDragging;
    const apt = originalRef.current;
    setState(null);
    if (isDragging && apt) optionsRef.current.onRollback?.(apt);
  });

  function attach() {
    if (listenersActive.current) return;
    listenersActive.current = true;
    window.addEventListener('pointermove', onMove.current);
    window.addEventListener('pointerup', onUp.current as EventListener);
    window.addEventListener('keydown', onKey.current);
  }

  function detach() {
    if (!listenersActive.current) return;
    listenersActive.current = false;
    window.removeEventListener('pointermove', onMove.current);
    window.removeEventListener('pointerup', onUp.current as EventListener);
    window.removeEventListener('keydown', onKey.current);
  }

  // Cleanup on unmount
  useEffect(() => () => detach(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public API ────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((apt: Appointment, e: React.PointerEvent, offsetY: number) => {
    e.preventDefault();
    durationRef.current = timeToMin(apt.endTime) - timeToMin(apt.startTime);
    originalRef.current = apt;
    const aptDate = aptDateStr(apt);
    const init: DragState = {
      aptId: apt.id,
      originalDate: aptDate,
      originalStartTime: apt.startTime,
      originalEndTime: apt.endTime,
      targetDate: aptDate,
      snappedStart: apt.startTime,
      snappedEnd: apt.endTime,
      pointerY: e.clientY,
      targetDayIndex: 0,
      targetStaffId: apt.staff?.id ?? null,
      offsetY,
      isDragging: false,
    };
    setState(init);
    attach();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelDrag = useCallback(() => {
    detach();
    setState(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { dragState, handleDragStart, cancelDrag };
}
