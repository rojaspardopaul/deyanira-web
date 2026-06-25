// API de configuración pública del salón + validación de promociones. Migrada
// desde lib/api.ts.

import { apiFetch, STATIC, LIVE } from '@/shared/api/client';

export const settingsApi = {
  public: () => apiFetch<unknown>('/settings/public', { ...STATIC, tags: ['settings'] }),
};

export const promotionsApi = {
  validate: (code: string, total?: number) => {
    const params = new URLSearchParams({ code });
    if (total) params.set('total', String(total));
    return apiFetch<unknown>(`/promotions/validate?${params}`, LIVE);
  },
};
