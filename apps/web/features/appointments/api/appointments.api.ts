// API de la feature de citas/reservas. Migrada desde lib/api.ts (feature-first).

import { apiFetch, LIVE } from '@/shared/api/client';

export const appointmentsApi = {
  availability: (
    staffId: string | null | undefined,
    serviceId: string,
    date: string,
    duration?: number,
    forPackage?: boolean,
  ) => {
    const params = new URLSearchParams({ serviceId, date });
    if (staffId) params.set('staffId', staffId);
    if (duration) params.set('duration', String(duration));
    if (forPackage) params.set('forPackage', '1');
    return apiFetch<{ start: string; end: string }[]>(`/appointments/availability?${params}`, LIVE);
  },
  create: (data: unknown, token?: string) =>
    apiFetch<unknown>('/appointments', { method: 'POST', body: data, token }),
  // Crea N citas en una sola transacción (paquete + extras) y envía un único email
  batch: (data: unknown, token?: string) =>
    apiFetch<{
      appointments: unknown[];
      total: number;
      atHomeExtraPen: number | null;
      package: { id: string; name: string; pricePen: number } | null;
    }>('/appointments/batch', { method: 'POST', body: data, token }),
  mine: (token: string) => apiFetch<unknown[]>('/appointments/me', { token, ...LIVE }),
  cancel: (id: string, token: string) =>
    apiFetch<unknown>(`/appointments/${encodeURIComponent(id)}/cancel`, { method: 'PATCH', token }),
};
