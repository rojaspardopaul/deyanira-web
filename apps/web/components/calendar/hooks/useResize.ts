'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { adminApi } from '@/lib/api';
import { snapToGrid, timeToMin, minToHHMM, clamp } from '../utils/time';
import { aptDateStr } from '../utils/date';
import { HOUR_START, HOUR_END, HOUR_HEIGHT, SNAP_MINUTES } from '../constants';
import type { Appointment, ResizeState } from '../types';

type UseResizeOptions = {
  onCommit?: (apt: Appointment, newEndTime: string) => void;
  onRollback?: (apt: Appointment) => void;
};

/**
 * Resize-event-duration via the ResizeHandle component at the bottom of AptBlock.
 *
 * The view must mark its time-grid container with data-cal-grid="1" (same as useDrag).
 * Pointer is captured on the resize handle; window listeners handle move + up.
 *
 * Usage:
 *   const { resizeState, handleResizeStart } = useResize({ onCommit, onRollback });
 *   // Pass handleResizeStart to views as onResizeStart prop
 *   // Pass resizeState to views to render the resize ghost
 */
export function useResize({ onCommit, onRollback }: UseResizeOptions = {}) {
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);

  const stateRef    = useRef<ResizeState | null>(null);
  const originalRef = useRef<Appointment | null>(null);
  const startMinRef = useRef(0);
  const optionsRef  = useRef({ onCommit, onRollback });
  optionsRef.current = { onCommit, onRollback };

  const listenersActive = useRef(false);

  function setState(s: ResizeState | null) {
    stateRef.current = s;
    setResizeState(s);
  }

  const onMove = useRef((e: PointerEvent) => {
    const prev = stateRef.current;
    if (!prev) return;

    // Find grid top via data attribute (same approach as useDrag)
    const el    = document.elementFromPoint(e.clientX, e.clientY);
    const gridEl = el?.closest('[data-cal-grid]') as HTMLElement | null;
    const gridTop = gridEl?.getBoundingClientRect().top ?? 0;

    const relY = e.clientY - gridTop;
    const rawEndMin = HOUR_START * 60 + (relY / HOUR_HEIGHT) * 60;
    const minEnd = startMinRef.current + SNAP_MINUTES; // minimum 15 min duration
    const maxEnd = HOUR_END * 60;
    const snappedEnd = minToHHMM(clamp(snapToGrid(rawEndMin, SNAP_MINUTES), minEnd, maxEnd));

    const next: ResizeState = { ...prev, isDragging: true, snappedEnd, pointerY: e.clientY };
    setState(next);
  });

  const onUp = useRef(async () => {
    detach();
    const state = stateRef.current;
    const apt = originalRef.current;
    setState(null);

    if (!state?.isDragging || !apt) return;
    if (state.snappedEnd === state.originalEndTime) return;

    optionsRef.current.onCommit?.(apt, state.snappedEnd);
    try {
      await adminApi().appointments.update(apt.id, { endTime: state.snappedEnd });
    } catch {
      optionsRef.current.onRollback?.({ ...apt, endTime: state.originalEndTime });
    }
  });

  const onKey = useRef((e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    detach();
    const apt = originalRef.current;
    const isDragging = stateRef.current?.isDragging;
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

  useEffect(() => () => detach(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResizeStart = useCallback((apt: Appointment, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    originalRef.current = apt;
    startMinRef.current = timeToMin(apt.startTime);
    const aptDate = aptDateStr(apt);
    void aptDate; // used by the parent for UX feedback if needed

    const init: ResizeState = {
      aptId: apt.id,
      originalEndTime: apt.endTime,
      snappedEnd: apt.endTime,
      pointerY: e.clientY,
      isDragging: false,
    };
    setState(init);
    attach();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { resizeState, handleResizeStart };
}
