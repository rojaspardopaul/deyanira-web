// API de la feature de pagos. Migrada desde lib/api.ts (feature-first).

import { apiFetch } from '@/shared/api/client';

export const paymentsApi = {
  culqi: (data: { orderId: string; culqiToken: string; email: string }) =>
    apiFetch<unknown>('/payments/culqi', { method: 'POST', body: data }),
};
