'use client';

import { useState, useRef, useCallback } from 'react';
import type { UndoEntry } from '../types';

/**
 * Manages a single "undo" toast notification.
 *
 * Usage:
 * ```ts
 * const { undoEntry, pushUndo, dismissUndo } = useUndoToast(6000);
 *
 * // After an optimistic update:
 * pushUndo({ message: 'Cita movida', rollback: async () => { ... } });
 *
 * // In UndoToast component, call dismissUndo() on "Deshacer" click.
 * ```
 */
export function useUndoToast(durationMs = 6000) {
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushUndo = useCallback((entry: UndoEntry) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setUndoEntry(entry);
    timerRef.current = setTimeout(() => setUndoEntry(null), durationMs);
  }, [durationMs]);

  const dismissUndo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setUndoEntry(null);
  }, []);

  const triggerUndo = useCallback(async () => {
    if (!undoEntry) return;
    dismissUndo();
    await undoEntry.rollback();
  }, [undoEntry, dismissUndo]);

  return { undoEntry, pushUndo, dismissUndo, triggerUndo };
}
