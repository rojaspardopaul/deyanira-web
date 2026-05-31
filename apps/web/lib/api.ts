const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  token?: string;          // Supabase access_token (clientes)
  revalidate?: number | false;
  /**
   * Admin mode: usa cookies (credentials: 'include') + header X-CSRF-Token.
   * El JWT del admin va en cookie HttpOnly — nunca tocamos localStorage.
   */
  admin?: boolean;
  signal?: AbortSignal;
  // Tags de caché de Next para revalidación on-demand (purgables vía /api/revalidate).
  tags?: string[];
};

// Lee la cookie admin_csrf (no HttpOnly) en el cliente.
function readCsrfCookie(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|;\s*)admin_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, revalidate = 60, admin, signal, tags } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (admin && method !== 'GET') {
    const csrf = readCsrfCookie();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const init: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  };

  // Para admin: enviar cookies. Para llamadas estáticas SSR: usar revalidate.
  if (admin) {
    init.credentials = 'include';
    init.cache = 'no-store';
  } else if (typeof window === 'undefined') {
    (init as RequestInit & { next?: { revalidate: number | false; tags?: string[] } }).next = {
      revalidate,
      ...(tags && tags.length ? { tags } : {}),
    };
  }

  const res = await fetch(`${API_URL}/api${path}`, init);

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: 'Error desconocido' }));
    const err = new Error(errBody.error || `Error ${res.status}`) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = errBody.code;

    // Auto-redirect a /admin/login si la sesión admin caducó.
    // Disparamos un CustomEvent que el AdminLayout escucha.
    if (admin && res.status === 401 && typeof window !== 'undefined') {
      try {
        // Limpia el flag legacy (por si existiera)
        window.localStorage?.removeItem('admin_token');
        window.localStorage?.removeItem('admin_user');
        window.dispatchEvent(new CustomEvent('admin:session-expired'));
      } catch { /* ignore */ }
    }
    throw err;
  }

  // No-content responses
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Cache presets
const STATIC = { revalidate: 3600 } as const;
const SHOP   = { revalidate: 1800 } as const;
const LIVE   = { revalidate: 0   } as const;

// Envelope de paginación (cuando se llama un listado admin con ?page).
export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// Construye el query string de paginación (+ filtros extra opcionales).
function pageQuery(opts?: { page?: number; pageSize?: number } & Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  if (opts) {
    for (const [k, v] of Object.entries(opts)) {
      if (v !== undefined && v !== '') p.set(k, String(v));
    }
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

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
  appointments: {
    availability: (staffId: string | null | undefined, serviceId: string, date: string, duration?: number, forPackage?: boolean) => {
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
      apiFetch<{ appointments: unknown[]; total: number; atHomeExtraPen: number | null; package: { id: string; name: string; pricePen: number } | null }>(
        '/appointments/batch',
        { method: 'POST', body: data, token },
      ),
    mine: (token: string) =>
      apiFetch<unknown[]>('/appointments/me', { token, ...LIVE }),
    cancel: (id: string, token: string) =>
      apiFetch<unknown>(`/appointments/${encodeURIComponent(id)}/cancel`, { method: 'PATCH', token }),
  },
  products: {
    list: (params?: string) => apiFetch<unknown[]>(`/products${params ? `?${params}` : ''}`, { ...SHOP, tags: ['products'] }),
    get: (slug: string) => apiFetch<unknown>(`/products/${encodeURIComponent(slug)}`, { ...SHOP, tags: ['products'] }),
    categories: () => apiFetch<unknown[]>('/products/categories', { ...STATIC, tags: ['products'] }),
  },
  orders: {
    create: (data: unknown, token?: string) =>
      apiFetch<unknown>('/orders', { method: 'POST', body: data, token }),
    mine: (token: string) => apiFetch<unknown[]>('/orders/me', { token, ...LIVE }),
    get: (id: string, email?: string) =>
      apiFetch<unknown>(`/orders/${encodeURIComponent(id)}${email ? `?email=${encodeURIComponent(email)}` : ''}`, LIVE),
  },
  payments: {
    culqi: (data: { orderId: string; culqiToken: string; email: string }) =>
      apiFetch<unknown>('/payments/culqi', { method: 'POST', body: data }),
  },
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
