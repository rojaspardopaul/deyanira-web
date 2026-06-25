// API de catálogo público (servicios, tipos de evento, catálogos visuales, staff,
// productos). Migrada desde lib/api.ts (feature-first).

import { apiFetch, STATIC, SHOP } from '@/shared/api/client';

export const servicesApi = {
  list: (params?: string) => apiFetch<unknown[]>(`/services${params ? `?${params}` : ''}`, { ...STATIC, tags: ['services'] }),
  categories: () => apiFetch<unknown[]>('/services/categories', { ...STATIC, tags: ['services'] }),
  // Servicios más reservados (ordenados por nº de citas reales)
  popular: (limit = 6) => apiFetch<unknown[]>(`/services/popular?limit=${limit}`, { revalidate: 900, tags: ['services'] }),
  get: (slug: string) => apiFetch<unknown>(`/services/${encodeURIComponent(slug)}`, { ...STATIC, tags: ['services'] }),
  // Cálculo de precio en tiempo real (id, no slug)
  calculatePrice: (id: string, selections: Record<string, unknown>) =>
    apiFetch<{
      basePrice: number;
      baseDuration: number;
      totalPrice: number;
      totalDuration: number;
      breakdown: Array<{
        kind: 'option' | 'rule';
        groupId?: string;
        groupName?: string;
        optionId?: string;
        label: string;
        delta: number;
        durationDelta: number;
      }>;
      blocked: boolean;
      blockedReasons: string[];
      requiresLeadDays: number | null;
      validationErrors: Array<{ groupId: string; name: string; error: string }>;
    }>(`/services/${encodeURIComponent(id)}/calculate-price`, { method: 'POST', body: { selections } }),
};

export const eventTypesApi = {
  list: () => apiFetch<unknown[]>('/event-types', { ...STATIC, tags: ['event-types'] }),
  get: (slug: string) => apiFetch<unknown>(`/event-types/${encodeURIComponent(slug)}`, { ...STATIC, tags: ['event-types'] }),
  package: (id: string) => apiFetch<unknown>(`/event-types/packages/${encodeURIComponent(id)}`, { ...STATIC, tags: ['event-types'] }),
};

export const catalogsApi = {
  list: () => apiFetch<unknown[]>('/catalogs', { ...STATIC, tags: ['catalogs'] }),
  get: (slug: string) => apiFetch<unknown>(`/catalogs/${encodeURIComponent(slug)}`, { ...STATIC, tags: ['catalogs'] }),
};

export const staffApi = {
  list: () => apiFetch<unknown[]>('/staff', { ...STATIC, tags: ['staff'] }),
  byService: (serviceId: string) => apiFetch<unknown[]>(`/staff/by-service/${encodeURIComponent(serviceId)}`, { ...STATIC, tags: ['staff'] }),
};

export const productsApi = {
  list: (params?: string) => apiFetch<unknown[]>(`/products${params ? `?${params}` : ''}`, { ...SHOP, tags: ['products'] }),
  get: (slug: string) => apiFetch<unknown>(`/products/${encodeURIComponent(slug)}`, { ...SHOP, tags: ['products'] }),
  categories: () => apiFetch<unknown[]>('/products/categories', { ...STATIC, tags: ['products'] }),
};
