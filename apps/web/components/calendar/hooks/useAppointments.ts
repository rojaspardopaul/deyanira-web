'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { adminApi } from '@/lib/api';
import type { Appointment } from '../types';

/**
 * Manages the appointments array with:
 * - `load(params)`: fetches from the API
 * - `optimisticUpdate(id, patch)`: immediately updates local state and returns a rollback fn
 * - `upsert(apt)`: adds or replaces a single appointment (for real-time sync and create)
 * - `remove(id)`: removes a single appointment
 * - `subscribeToChanges(dateFrom, dateTo)`: activates Supabase Realtime for live updates
 *
 * Supabase Realtime must be enabled for the Appointment table in the Supabase dashboard
 * (Database → Replication → enable for 'Appointment' table).
 */
export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof import('@supabase/ssr').createBrowserClient> extends { channel: (...a: any[]) => infer C } ? C : unknown | null>(null);

  const load = useCallback(async (params: URLSearchParams) => {
    setLoading(true);
    try {
      const data = await adminApi().appointments.list(params.toString());
      setAppointments(data as Appointment[]);
    } catch { /* caller handles auth redirect */ }
    finally { setLoading(false); }
  }, []);

  /**
   * Applies patch immediately to local state.
   * Returns a rollback function that restores the original appointment.
   */
  const optimisticUpdate = useCallback(
    (id: string, patch: Partial<Appointment>): (() => void) => {
      let original: Appointment | undefined;
      setAppointments(prev => {
        original = prev.find(a => a.id === id);
        return prev.map(a => (a.id === id ? { ...a, ...patch } : a));
      });
      return () => {
        if (original) {
          setAppointments(prev => prev.map(a => (a.id === id ? original! : a)));
        }
      };
    },
    [],
  );

  /** Adds a new appointment or replaces one with the same id */
  const upsert = useCallback((apt: Appointment) => {
    setAppointments(prev => {
      const exists = prev.some(a => a.id === apt.id);
      return exists ? prev.map(a => (a.id === apt.id ? apt : a)) : [...prev, apt];
    });
  }, []);

  /** Removes an appointment by id */
  const remove = useCallback((id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
  }, []);

  /**
   * Activates a Supabase Realtime subscription for appointments in the given date range.
   * Call with `null` to unsubscribe.
   *
   * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY env vars.
   * The 'Appointment' table must be in the Supabase realtime publication.
   */
  const subscribeToChanges = useCallback(async (dateFrom: string | null, dateTo: string | null) => {
    // Unsubscribe previous channel
    if (channelRef.current) {
      try {
        const { createBrowserClient } = await import('@supabase/ssr');
        const sb = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        await sb.removeChannel(channelRef.current as Parameters<typeof sb.removeChannel>[0]);
      } catch { /* ignore */ }
      channelRef.current = null;
    }

    if (!dateFrom || !dateTo) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;

    try {
      const { createBrowserClient } = await import('@supabase/ssr');
      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      );

      const channel = sb
        .channel(`calendar-apts-${dateFrom}-${dateTo}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'Appointment' },
          payload => {
            if (payload.eventType === 'DELETE') {
              remove((payload.old as { id: string }).id);
            } else {
              // INSERT or UPDATE — re-fetch the appointment via admin API to get full data
              const id = (payload.new as { id: string }).id;
              adminApi().appointments.list(`appointmentId=${id}`)
                .then(data => { if (data[0]) upsert(data[0] as Appointment); })
                .catch(() => {});
            }
          },
        )
        .subscribe();

      channelRef.current = channel as unknown as typeof channelRef.current;
    } catch { /* Supabase Realtime not available or not configured */ }
  }, [upsert, remove]);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => { subscribeToChanges(null, null); };
  }, [subscribeToChanges]);

  return { appointments, loading, load, optimisticUpdate, upsert, remove, subscribeToChanges, setAppointments };
}
