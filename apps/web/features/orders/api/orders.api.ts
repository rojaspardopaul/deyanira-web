// API de la feature de pedidos/tienda. Migrada desde lib/api.ts (feature-first).

import { apiFetch, LIVE } from '@/shared/api/client';

export const ordersApi = {
  create: (data: unknown, token?: string) =>
    apiFetch<unknown>('/orders', { method: 'POST', body: data, token }),
  mine: (token: string) => apiFetch<unknown[]>('/orders/me', { token, ...LIVE }),
  get: (id: string, email?: string) =>
    apiFetch<unknown>(
      `/orders/${encodeURIComponent(id)}${email ? `?email=${encodeURIComponent(email)}` : ''}`,
      LIVE,
    ),
  uploadProof: (id: string, data: { image: string; method?: 'yape' | 'plin' | 'transfer' }) =>
    apiFetch<{ success: boolean; status: string }>(`/orders/${encodeURIComponent(id)}/proof`, {
      method: 'POST',
      body: data,
    }),
};
