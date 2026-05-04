const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
};

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    next: { revalidate: 60 }, // ISR: revalidar cada 60 segundos por defecto
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || `Error ${res.status}`);
  }

  return res.json();
}

// ── API pública ───────────────────────────────────────────
export const api = {
  services: {
    list: (params?: string) => apiFetch<unknown[]>(`/services${params ? `?${params}` : ''}`),
    categories: () => apiFetch<unknown[]>('/services/categories'),
    get: (slug: string) => apiFetch<unknown>(`/services/${slug}`),
  },
  staff: {
    list: () => apiFetch<unknown[]>('/staff'),
    byService: (serviceId: string) => apiFetch<unknown[]>(`/staff/by-service/${serviceId}`),
  },
  appointments: {
    availability: (staffId: string, serviceId: string, date: string) =>
      apiFetch<{ start: string; end: string }[]>(
        `/appointments/availability?staffId=${staffId}&serviceId=${serviceId}&date=${date}`
      ),
    create: (data: unknown, token?: string) =>
      apiFetch<unknown>('/appointments', { method: 'POST', body: data, token }),
    mine: (token: string) =>
      apiFetch<unknown[]>('/appointments/me', { token }),
    cancel: (id: string, token: string) =>
      apiFetch<unknown>(`/appointments/${id}/cancel`, { method: 'PATCH', token }),
  },
  products: {
    list: (params?: string) => apiFetch<unknown[]>(`/products${params ? `?${params}` : ''}`),
    get: (slug: string) => apiFetch<unknown>(`/products/${slug}`),
    categories: () => apiFetch<unknown[]>('/products/categories'),
  },
  orders: {
    create: (data: unknown, token?: string) =>
      apiFetch<unknown>('/orders', { method: 'POST', body: data, token }),
    mine: (token: string) => apiFetch<unknown[]>('/orders/me', { token }),
  },
  payments: {
    culqi: (data: { orderId: string; culqiToken: string; email: string }) =>
      apiFetch<unknown>('/payments/culqi', { method: 'POST', body: data }),
  },
  gallery: {
    list: (category?: string) =>
      apiFetch<unknown[]>(`/gallery${category ? `?category=${category}` : ''}`),
  },
  blog: {
    list: () => apiFetch<unknown[]>('/blog', { next: { revalidate: 300 } } as never),
    get: (slug: string) => apiFetch<unknown>(`/blog/${slug}`, { next: { revalidate: 300 } } as never),
  },
  settings: {
    public: () => apiFetch<unknown>('/settings/public', { next: { revalidate: 3600 } } as never),
  },
  promotions: {
    validate: (code: string, total?: number) =>
      apiFetch<unknown>(`/promotions/validate?code=${code}${total ? `&total=${total}` : ''}`),
  },
};

// ── API de admin ──────────────────────────────────────────
export function adminApi(token: string) {
  const opts = (method: string, body?: unknown) => ({ method, body, token } as RequestOptions);

  return {
    dashboard: () => apiFetch<unknown>('/admin/dashboard', { token }),
    appointments: {
      list: (params?: string) => apiFetch<unknown[]>(`/admin/appointments${params ? `?${params}` : ''}`, { token }),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/appointments/${id}`, opts('PATCH', data)),
    },
    services: {
      list: () => apiFetch<unknown[]>('/admin/services', { token }),
      create: (data: unknown) => apiFetch<unknown>('/admin/services', opts('POST', data)),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/services/${id}`, opts('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/services/${id}`, opts('DELETE')),
    },
    products: {
      list: () => apiFetch<unknown[]>('/admin/products', { token }),
      create: (data: unknown) => apiFetch<unknown>('/admin/products', opts('POST', data)),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/products/${id}`, opts('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/products/${id}`, opts('DELETE')),
    },
    orders: {
      list: (status?: string) => apiFetch<unknown[]>(`/admin/orders${status ? `?status=${status}` : ''}`, { token }),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/orders/${id}`, opts('PATCH', data)),
    },
    gallery: {
      list: () => apiFetch<unknown[]>('/admin/gallery', { token }),
      upload: (data: unknown) => apiFetch<unknown>('/admin/gallery/upload', opts('POST', data)),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/gallery/${id}`, opts('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/gallery/${id}`, opts('DELETE')),
    },
    settings: {
      get: () => apiFetch<unknown>('/admin/settings', { token }),
      update: (data: unknown) => apiFetch<unknown>('/admin/settings', opts('PATCH', data)),
    },
    upload: (file: string, folder?: string) =>
      apiFetch<unknown>('/admin/upload', opts('POST', { file, folder })),
    accounting: {
      summary: (from: string, to: string) =>
        apiFetch<unknown>(`/admin/accounting/summary?from=${from}&to=${to}`, { token }),
      monthly: (year: number) =>
        apiFetch<unknown[]>(`/admin/accounting/monthly?year=${year}`, { token }),
      expenses: {
        list: (params?: string) =>
          apiFetch<unknown[]>(`/admin/accounting/expenses${params ? `?${params}` : ''}`, { token }),
        create: (data: unknown) =>
          apiFetch<unknown>('/admin/accounting/expenses', opts('POST', data)),
        update: (id: string, data: unknown) =>
          apiFetch<unknown>(`/admin/accounting/expenses/${id}`, opts('PATCH', data)),
        delete: (id: string) =>
          apiFetch<unknown>(`/admin/accounting/expenses/${id}`, opts('DELETE')),
      },
      otherIncome: {
        list: (params?: string) =>
          apiFetch<unknown[]>(`/admin/accounting/other-income${params ? `?${params}` : ''}`, { token }),
        create: (data: unknown) =>
          apiFetch<unknown>('/admin/accounting/other-income', opts('POST', data)),
        update: (id: string, data: unknown) =>
          apiFetch<unknown>(`/admin/accounting/other-income/${id}`, opts('PATCH', data)),
        delete: (id: string) =>
          apiFetch<unknown>(`/admin/accounting/other-income/${id}`, opts('DELETE')),
      },
    },
  };
}
