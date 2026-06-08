// God-file en migración a feature-first. El cliente HTTP base vive en
// @/shared/api/client y las features ya migradas (appointments, orders, payments)
// en @/features/*/api. Este archivo COMPONE el objeto `api` (barrel) para no romper
// los imports existentes; el resto de namespaces se irá extrayendo igual.

import {
  apiFetch,
  STATIC,
  SHOP,
  LIVE,
  pageQuery,
  type HttpMethod,
  type RequestOptions,
  type Paged,
} from '@/shared/api/client';
import { appointmentsApi } from '@/features/appointments/api/appointments.api';
import { ordersApi } from '@/features/orders/api/orders.api';
import { paymentsApi } from '@/features/payments/api/payments.api';

export type { Paged };

// ── API pública ───────────────────────────────────────────
export const api = {
  services: {
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
  },
  eventTypes: {
    list: () => apiFetch<unknown[]>('/event-types', { ...STATIC, tags: ['event-types'] }),
    get: (slug: string) => apiFetch<unknown>(`/event-types/${encodeURIComponent(slug)}`, { ...STATIC, tags: ['event-types'] }),
    package: (id: string) => apiFetch<unknown>(`/event-types/packages/${encodeURIComponent(id)}`, { ...STATIC, tags: ['event-types'] }),
  },
  catalogs: {
    list: () => apiFetch<unknown[]>('/catalogs', { ...STATIC, tags: ['catalogs'] }),
    get: (slug: string) => apiFetch<unknown>(`/catalogs/${encodeURIComponent(slug)}`, { ...STATIC, tags: ['catalogs'] }),
  },
  staff: {
    list: () => apiFetch<unknown[]>('/staff', { ...STATIC, tags: ['staff'] }),
    byService: (serviceId: string) => apiFetch<unknown[]>(`/staff/by-service/${encodeURIComponent(serviceId)}`, { ...STATIC, tags: ['staff'] }),
  },
  appointments: appointmentsApi,
  products: {
    list: (params?: string) => apiFetch<unknown[]>(`/products${params ? `?${params}` : ''}`, { ...SHOP, tags: ['products'] }),
    get: (slug: string) => apiFetch<unknown>(`/products/${encodeURIComponent(slug)}`, { ...SHOP, tags: ['products'] }),
    categories: () => apiFetch<unknown[]>('/products/categories', { ...STATIC, tags: ['products'] }),
  },
  orders: ordersApi,
  payments: paymentsApi,
  gallery: {
    list: (category?: string) =>
      apiFetch<unknown[]>(`/gallery${category ? `?category=${encodeURIComponent(category)}` : ''}`, { ...STATIC, tags: ['gallery'] }),
  },
  blog: {
    list: () => apiFetch<unknown[]>('/blog', { revalidate: 300 }),
    get: (slug: string) => apiFetch<unknown>(`/blog/${encodeURIComponent(slug)}`, { revalidate: 300 }),
  },
  settings: {
    public: () => apiFetch<unknown>('/settings/public', { ...STATIC, tags: ['settings'] }),
  },
  bookingPayments: {
    // Datos de la reserva + adelanto + instrucciones de pago (id = UUID challenge)
    get: (id: string) => apiFetch<{
      id: string;
      status: 'pending' | 'awaiting_verification' | 'paid' | 'rejected' | 'expired';
      method: string | null;
      totalPen: number; depositPercent: number; depositPen: number;
      paidPen: number; balancePen: number;
      receiptNumber: string | null;
      customerName: string; customerEmail: string | null; customerPhone: string | null;
      package: { id: string; name: string; eventType?: { name?: string } | null } | null;
      appointments: Array<{ id: string; serviceName: string | null; staffName: string | null; onDutyStaff: boolean; date: string; startTime: string; endTime: string; totalPen: number }>;
      salon: Record<string, unknown>;
      culqiPublicKey: string | null;
    }>(`/booking-payments/${encodeURIComponent(id)}`, LIVE),
    culqi: (id: string, data: { culqiToken: string; email: string }) =>
      apiFetch<{ success: boolean; receiptNumber?: string; alreadyPaid?: boolean }>(
        `/booking-payments/${encodeURIComponent(id)}/culqi`, { method: 'POST', body: data }),
    uploadProof: (id: string, data: { image: string; method: 'yape' | 'plin' | 'transfer' }) =>
      apiFetch<{ success: boolean; status: string }>(
        `/booking-payments/${encodeURIComponent(id)}/proof`, { method: 'POST', body: data }),
  },
  promotions: {
    validate: (code: string, total?: number) => {
      const params = new URLSearchParams({ code });
      if (total) params.set('total', String(total));
      return apiFetch<unknown>(`/promotions/validate?${params}`, LIVE);
    },
  },
  customers: {
    me: (token: string) =>
      apiFetch<{ id: string; name: string; phone: string | null }>('/customers/me', { token, ...LIVE }),
    updateMe: (data: { name?: string; phone?: string }, token: string) =>
      apiFetch<unknown>('/customers/me', { method: 'PATCH', body: data, token }),
  },
  bookings: {
    // Sube una imagen del ticket de la cita a Cloudinary y devuelve la URL
    // pública. Usada para compartir por WhatsApp (wa.me + URL → tarjeta con
    // previsualización de imagen).
    shareImage: (data: { appointmentId: string; image: string }, token: string) =>
      apiFetch<{ url: string }>('/bookings/share-image', {
        method: 'POST', body: data, token,
      }),
  },
};

// ── Auth admin (cookies HttpOnly) ─────────────────────────
export const adminAuth = {
  login: (email: string, password: string) =>
    apiFetch<{ ok: true; admin: { id: string; name: string; email: string; role: string; staffId: string | null }; csrfToken: string }>(
      '/auth/admin/login',
      { method: 'POST', body: { email, password }, admin: true }
    ),
  logout: () => apiFetch<{ ok: true }>('/auth/admin/logout', { method: 'POST', admin: true }),
  me: () => apiFetch<{ admin: { id: string; name: string; email: string; role: string; staffId: string | null } }>(
    '/auth/admin/me',
    { admin: true }
  ),
  rotateCsrf: () => apiFetch<{ csrfToken: string }>('/auth/admin/csrf', { method: 'POST', admin: true }),
};

// ── API de admin (cookie-based) ────────────────────────────
// Retro-compat: acepta un parámetro opcional `_legacyToken` que se ignora
// (antes era el JWT en localStorage). Las páginas existentes funcionan sin cambios.
export function adminApi(_legacyToken?: string | null) {
  void _legacyToken;
  const mut = (method: HttpMethod, body?: unknown): RequestOptions =>
    ({ method, body, admin: true });

  const getReq = (): RequestOptions => ({ admin: true });

  return {
    dashboard: () => apiFetch<unknown>('/admin/dashboard', getReq()),
    appointments: {
      list: (params?: string) =>
        apiFetch<unknown[]>(`/admin/appointments${params ? `?${params}` : ''}`, getReq()),
      listPaged: (opts?: { page?: number; pageSize?: number; status?: string; dateFrom?: string; dateTo?: string; staffId?: string }) =>
        apiFetch<Paged<Record<string, unknown>>>(`/admin/appointments${pageQuery(opts)}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/appointments', mut('POST', data)),
      update: (id: string, data: unknown) =>
        apiFetch<unknown>(`/admin/appointments/${encodeURIComponent(id)}`, mut('PATCH', data)),
      // Confirma todas las citas de un paquete en una fecha y envía UN solo email
      confirmGroup: (packageId: string, date: string, customerKey: string) =>
        apiFetch<{ ok: true; count: number }>(`/admin/appointments/confirm-group`,
          mut('POST', { packageId, date, customerKey })),
      // Alta de reserva de paquete (multi-servicio) + adelanto opcional
      createPackage: (data: unknown) =>
        apiFetch<{ bookingGroupId: string; appointments: unknown[]; bookingPaymentId: string | null; receiptNumber: string | null }>(
          '/admin/appointments/package', mut('POST', data)),
    },
    bookingPayments: {
      list: (status?: string) =>
        apiFetch<unknown[]>(`/admin/booking-payments${status ? `?status=${encodeURIComponent(status)}` : ''}`, getReq()),
      // Pago (adelanto) asociado a un grupo de reserva — para el panel del calendario.
      byGroup: (bookingGroupId: string) =>
        apiFetch<unknown[]>(`/admin/booking-payments?bookingGroupId=${encodeURIComponent(bookingGroupId)}`, getReq()),
      verify: (id: string, approved: boolean, notes?: string) =>
        apiFetch<unknown>(`/admin/booking-payments/${encodeURIComponent(id)}/verify`, mut('POST', { approved, notes })),
      record: (id: string, data: { method?: string; paidPen?: number }) =>
        apiFetch<unknown>(`/admin/booking-payments/${encodeURIComponent(id)}/record`, mut('POST', data)),
    },
    customers: {
      list: () => apiFetch<unknown[]>('/admin/customers', getReq()),
      listPaged: (opts?: { page?: number; pageSize?: number; search?: string }) =>
        apiFetch<Paged<Record<string, unknown>>>(`/admin/customers${pageQuery(opts)}`, getReq()),
      search: (q: string) =>
        apiFetch<unknown[]>(`/admin/customers?search=${encodeURIComponent(q)}`, getReq()),
      create: (data: { name: string; phone?: string; email?: string }) =>
        apiFetch<unknown>('/admin/customers', mut('POST', data)),
      update: (id: string, data: { name?: string; phone?: string; email?: string; isActive?: boolean }) =>
        apiFetch<unknown>(`/admin/customers/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) =>
        apiFetch<unknown>(`/admin/customers/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    staff: {
      list: () => apiFetch<unknown[]>('/admin/staff', getReq()),
      get: (id: string) => apiFetch<unknown>(`/admin/staff/${encodeURIComponent(id)}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/staff', mut('POST', data)),
      update: (id: string, data: unknown) =>
        apiFetch<unknown>(`/admin/staff/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/staff/${encodeURIComponent(id)}`, mut('DELETE')),
      setSchedules: (id: string, schedules: unknown[]) =>
        apiFetch<unknown>(`/admin/staff/${encodeURIComponent(id)}/schedules`, mut('PUT', { schedules })),
    },
    unavailability: {
      list: (from?: string) =>
        apiFetch<unknown[]>(`/admin/unavailability${from ? `?from=${encodeURIComponent(from)}` : ''}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/unavailability', mut('POST', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/unavailability/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    services: {
      list: () => apiFetch<unknown[]>('/admin/services', getReq()),
      get: (id: string) => apiFetch<unknown>(`/admin/services/${encodeURIComponent(id)}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/services', mut('POST', data)),
      update: (id: string, data: unknown) =>
        apiFetch<unknown>(`/admin/services/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/services/${encodeURIComponent(id)}`, mut('DELETE')),
      setStaff: (id: string, staffIds: string[]) =>
        apiFetch<unknown>(`/admin/services/${encodeURIComponent(id)}/staff`, mut('PUT', { staffIds })),
      setParallelWith: (id: string, withIds: string[]) =>
        apiFetch<{ parallelGroup: string | null; memberIds: string[]; members?: Array<{ id: string; name: string }> }>(
          `/admin/services/${encodeURIComponent(id)}/parallel-with`,
          mut('POST', { withIds }),
        ),
      // Reemplaza atómicamente toda la configuración de modificadores dinámicos
      setModifiers: (id: string, payload: { groups: unknown[]; rules?: unknown[] }) =>
        apiFetch<unknown>(`/admin/services/${encodeURIComponent(id)}/modifiers`, mut('PUT', payload)),
    },
    serviceCategories: {
      list: () => apiFetch<unknown[]>('/admin/service-categories', getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/service-categories', mut('POST', data)),
      update: (id: string, data: unknown) =>
        apiFetch<unknown>(`/admin/service-categories/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) =>
        apiFetch<unknown>(`/admin/service-categories/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    eventTypes: {
      list: () => apiFetch<unknown[]>('/admin/event-types', getReq()),
      get: (id: string) => apiFetch<unknown>(`/admin/event-types/${encodeURIComponent(id)}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/event-types', mut('POST', data)),
      update: (id: string, data: unknown) =>
        apiFetch<unknown>(`/admin/event-types/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/event-types/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    packages: {
      list: (eventTypeId?: string) =>
        apiFetch<unknown[]>(`/admin/packages${eventTypeId ? `?eventTypeId=${encodeURIComponent(eventTypeId)}` : ''}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/packages', mut('POST', data)),
      update: (id: string, data: unknown) =>
        apiFetch<unknown>(`/admin/packages/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/packages/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    addons: {
      list: (eventTypeId?: string) =>
        apiFetch<unknown[]>(`/admin/addons${eventTypeId ? `?eventTypeId=${encodeURIComponent(eventTypeId)}` : ''}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/addons', mut('POST', data)),
      update: (id: string, data: unknown) =>
        apiFetch<unknown>(`/admin/addons/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/addons/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    benefits: {
      list: (eventTypeId?: string) =>
        apiFetch<unknown[]>(`/admin/benefits${eventTypeId ? `?eventTypeId=${encodeURIComponent(eventTypeId)}` : ''}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/benefits', mut('POST', data)),
      update: (id: string, data: unknown) =>
        apiFetch<unknown>(`/admin/benefits/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/benefits/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    catalogs: {
      list: () => apiFetch<unknown[]>('/admin/catalogs', getReq()),
      get: (id: string) => apiFetch<unknown>(`/admin/catalogs/${encodeURIComponent(id)}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/catalogs', mut('POST', data)),
      update: (id: string, data: unknown) =>
        apiFetch<unknown>(`/admin/catalogs/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/catalogs/${encodeURIComponent(id)}`, mut('DELETE')),
      addItem: (catalogId: string, data: unknown) =>
        apiFetch<unknown>(`/admin/catalogs/${encodeURIComponent(catalogId)}/items`, mut('POST', data)),
      updateItem: (id: string, data: unknown) =>
        apiFetch<unknown>(`/admin/catalog-items/${encodeURIComponent(id)}`, mut('PATCH', data)),
      deleteItem: (id: string) =>
        apiFetch<unknown>(`/admin/catalog-items/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    products: {
      list: () => apiFetch<unknown[]>('/admin/products', getReq()),
      listPaged: (opts?: { page?: number; pageSize?: number }) =>
        apiFetch<Paged<Record<string, unknown>>>(`/admin/products${pageQuery(opts)}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/products', mut('POST', data)),
      update: (id: string, data: unknown) =>
        apiFetch<unknown>(`/admin/products/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/products/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    orders: {
      list: (status?: string) =>
        apiFetch<unknown[]>(`/admin/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`, getReq()),
      listPaged: (opts?: { page?: number; pageSize?: number; status?: string }) =>
        apiFetch<Paged<Record<string, unknown>>>(`/admin/orders${pageQuery(opts)}`, getReq()),
      update: (id: string, data: unknown) =>
        apiFetch<unknown>(`/admin/orders/${encodeURIComponent(id)}`, mut('PATCH', data)),
    },
    gallery: {
      list: () => apiFetch<unknown[]>('/admin/gallery', getReq()),
      upload: (data: unknown) => apiFetch<unknown>('/admin/gallery/upload', mut('POST', data)),
      update: (id: string, data: unknown) =>
        apiFetch<unknown>(`/admin/gallery/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/gallery/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    settings: {
      get: () => apiFetch<unknown>('/admin/settings', getReq()),
      update: (data: unknown) => apiFetch<unknown>('/admin/settings', mut('PATCH', data)),
    },
    upload: (file: string, folder?: string) =>
      apiFetch<unknown>('/admin/upload', mut('POST', { file, folder })),
    uploadVideo: (file: string, folder?: string) =>
      apiFetch<{ url: string; publicId: string; duration?: number }>('/admin/upload-video', mut('POST', { file, folder })),
    users: {
      list: () => apiFetch<unknown[]>('/admin/users', getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/users', mut('POST', data)),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/users/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/users/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    accounting: {
      summary: (from: string, to: string) =>
        apiFetch<unknown>(`/admin/accounting/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, getReq()),
      monthly: (year: number) =>
        apiFetch<unknown[]>(`/admin/accounting/monthly?year=${year}`, getReq()),
      expenses: {
        list: (params?: string) =>
          apiFetch<unknown[]>(`/admin/accounting/expenses${params ? `?${params}` : ''}`, getReq()),
        create: (data: unknown) => apiFetch<unknown>('/admin/accounting/expenses', mut('POST', data)),
        update: (id: string, data: unknown) =>
          apiFetch<unknown>(`/admin/accounting/expenses/${encodeURIComponent(id)}`, mut('PATCH', data)),
        delete: (id: string) => apiFetch<unknown>(`/admin/accounting/expenses/${encodeURIComponent(id)}`, mut('DELETE')),
      },
      otherIncome: {
        list: (params?: string) =>
          apiFetch<unknown[]>(`/admin/accounting/other-income${params ? `?${params}` : ''}`, getReq()),
        create: (data: unknown) => apiFetch<unknown>('/admin/accounting/other-income', mut('POST', data)),
        update: (id: string, data: unknown) =>
          apiFetch<unknown>(`/admin/accounting/other-income/${encodeURIComponent(id)}`, mut('PATCH', data)),
        delete: (id: string) => apiFetch<unknown>(`/admin/accounting/other-income/${encodeURIComponent(id)}`, mut('DELETE')),
      },
    },
  };
}
