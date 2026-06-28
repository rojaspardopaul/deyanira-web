// API del panel de administración (cookie-based) + auth admin. Migrada desde
// lib/api.ts (feature-first). lib/api.ts re-exporta adminAuth y adminApi.

import { apiFetch, pageQuery, type HttpMethod, type RequestOptions, type Paged } from '@/shared/api/client';
import { receiptsApi } from '@/features/receipts/api/receipts.api';

// ── Auth admin (cookies HttpOnly) ─────────────────────────
export const adminAuth = {
  login: (email: string, password: string) =>
    apiFetch<{ ok: true; token: string; admin: { id: string; name: string; email: string; role: string; staffId: string | null }; csrfToken?: string }>(
      '/auth/admin/login',
      { method: 'POST', body: { email, password }, admin: true },
    ),
  logout: () => apiFetch<{ ok: true }>('/auth/admin/logout', { method: 'POST', admin: true }),
  me: () =>
    apiFetch<{ admin: { id: string; name: string; email: string; role: string; staffId: string | null } }>('/auth/admin/me', { admin: true }),
  rotateCsrf: () => apiFetch<{ csrfToken: string }>('/auth/admin/csrf', { method: 'POST', admin: true }),
};

// ── API de admin (cookie-based) ────────────────────────────
// Retro-compat: acepta un parámetro opcional `_legacyToken` que se ignora
// (antes era el JWT en localStorage). Las páginas existentes funcionan sin cambios.
export function adminApi(_legacyToken?: string | null) {
  void _legacyToken;
  const mut = (method: HttpMethod, body?: unknown): RequestOptions => ({ method, body, admin: true });
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
        apiFetch<{ ok: true; count: number }>(`/admin/appointments/confirm-group`, mut('POST', { packageId, date, customerKey })),
      // Variante moderna por bookingGroupId (calendario): mismo endpoint, un email
      confirmGroupByBooking: (bookingGroupId: string, date: string) =>
        apiFetch<{ ok: true; count: number }>(`/admin/appointments/confirm-group`, mut('POST', { bookingGroupId, date })),
      // Rechaza (cancela) todas las citas del grupo en esa fecha + UN email de rechazo
      rejectGroup: (bookingGroupId: string, date: string) =>
        apiFetch<{ ok: true; count: number }>(`/admin/appointments/reject-group`, mut('POST', { bookingGroupId, date })),
      // Alta de reserva de paquete (multi-servicio) + adelanto opcional
      createPackage: (data: unknown) =>
        apiFetch<{ bookingGroupId: string; appointments: unknown[]; bookingPaymentId: string | null; receiptNumber: string | null }>(
          '/admin/appointments/package', mut('POST', data)),
    },
    bookingPayments: {
      list: (status?: string) =>
        apiFetch<unknown[]>(`/admin/booking-payments${status ? `?status=${encodeURIComponent(status)}` : ''}`, getReq()),
      byGroup: (bookingGroupId: string) =>
        apiFetch<unknown[]>(`/admin/booking-payments?bookingGroupId=${encodeURIComponent(bookingGroupId)}`, getReq()),
      verify: (id: string, approved: boolean, notes?: string) =>
        apiFetch<unknown>(`/admin/booking-payments/${encodeURIComponent(id)}/verify`, mut('POST', { approved, notes })),
      record: (id: string, data: { method?: string; paidPen?: number }) =>
        apiFetch<unknown>(`/admin/booking-payments/${encodeURIComponent(id)}/record`, mut('POST', data)),
    },
    // Recibos de cobros/abonos (módulo receipts): crear, abonar, PDF, enviar correo.
    receipts: receiptsApi,
    customers: {
      list: () => apiFetch<unknown[]>('/admin/customers', getReq()),
      listPaged: (opts?: { page?: number; pageSize?: number; search?: string }) =>
        apiFetch<Paged<Record<string, unknown>>>(`/admin/customers${pageQuery(opts)}`, getReq()),
      search: (q: string) => apiFetch<unknown[]>(`/admin/customers?search=${encodeURIComponent(q)}`, getReq()),
      create: (data: { name: string; phone?: string; email?: string }) =>
        apiFetch<unknown>('/admin/customers', mut('POST', data)),
      update: (id: string, data: { name?: string; phone?: string; email?: string; isActive?: boolean }) =>
        apiFetch<unknown>(`/admin/customers/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/customers/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    reclamaciones: {
      list: (estado?: string) =>
        apiFetch<Record<string, unknown>[]>(`/admin/reclamaciones${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`, getReq()),
      respond: (id: string, data: { respuesta?: string; estado?: string }) =>
        apiFetch<unknown>(`/admin/reclamaciones/${encodeURIComponent(id)}`, mut('PATCH', data)),
    },
    staff: {
      list: () => apiFetch<unknown[]>('/admin/staff', getReq()),
      get: (id: string) => apiFetch<unknown>(`/admin/staff/${encodeURIComponent(id)}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/staff', mut('POST', data)),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/staff/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/staff/${encodeURIComponent(id)}`, mut('DELETE')),
      setSchedules: (id: string, schedules: unknown[]) =>
        apiFetch<unknown>(`/admin/staff/${encodeURIComponent(id)}/schedules`, mut('PUT', { schedules })),
      reorder: (ids: string[]) => apiFetch<{ ok: true; count: number }>('/admin/staff/reorder', mut('PUT', { ids })),
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
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/services/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/services/${encodeURIComponent(id)}`, mut('DELETE')),
      setStaff: (id: string, staffIds: string[]) =>
        apiFetch<unknown>(`/admin/services/${encodeURIComponent(id)}/staff`, mut('PUT', { staffIds })),
      setParallelWith: (id: string, withIds: string[]) =>
        apiFetch<{ parallelGroup: string | null; memberIds: string[]; members?: Array<{ id: string; name: string }> }>(
          `/admin/services/${encodeURIComponent(id)}/parallel-with`, mut('POST', { withIds })),
      setModifiers: (id: string, payload: { groups: unknown[]; rules?: unknown[] }) =>
        apiFetch<unknown>(`/admin/services/${encodeURIComponent(id)}/modifiers`, mut('PUT', payload)),
    },
    serviceCategories: {
      list: () => apiFetch<unknown[]>('/admin/service-categories', getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/service-categories', mut('POST', data)),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/service-categories/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/service-categories/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    eventTypes: {
      list: () => apiFetch<unknown[]>('/admin/event-types', getReq()),
      get: (id: string) => apiFetch<unknown>(`/admin/event-types/${encodeURIComponent(id)}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/event-types', mut('POST', data)),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/event-types/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/event-types/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    packages: {
      list: (eventTypeId?: string) =>
        apiFetch<unknown[]>(`/admin/packages${eventTypeId ? `?eventTypeId=${encodeURIComponent(eventTypeId)}` : ''}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/packages', mut('POST', data)),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/packages/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/packages/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    addons: {
      list: (eventTypeId?: string) =>
        apiFetch<unknown[]>(`/admin/addons${eventTypeId ? `?eventTypeId=${encodeURIComponent(eventTypeId)}` : ''}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/addons', mut('POST', data)),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/addons/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/addons/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    benefits: {
      list: (eventTypeId?: string) =>
        apiFetch<unknown[]>(`/admin/benefits${eventTypeId ? `?eventTypeId=${encodeURIComponent(eventTypeId)}` : ''}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/benefits', mut('POST', data)),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/benefits/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/benefits/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    catalogs: {
      list: () => apiFetch<unknown[]>('/admin/catalogs', getReq()),
      get: (id: string) => apiFetch<unknown>(`/admin/catalogs/${encodeURIComponent(id)}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/catalogs', mut('POST', data)),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/catalogs/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/catalogs/${encodeURIComponent(id)}`, mut('DELETE')),
      addItem: (catalogId: string, data: unknown) =>
        apiFetch<unknown>(`/admin/catalogs/${encodeURIComponent(catalogId)}/items`, mut('POST', data)),
      updateItem: (id: string, data: unknown) =>
        apiFetch<unknown>(`/admin/catalog-items/${encodeURIComponent(id)}`, mut('PATCH', data)),
      deleteItem: (id: string) => apiFetch<unknown>(`/admin/catalog-items/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    products: {
      list: () => apiFetch<unknown[]>('/admin/products', getReq()),
      listPaged: (opts?: { page?: number; pageSize?: number }) =>
        apiFetch<Paged<Record<string, unknown>>>(`/admin/products${pageQuery(opts)}`, getReq()),
      create: (data: unknown) => apiFetch<unknown>('/admin/products', mut('POST', data)),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/products/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/products/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    orders: {
      list: (status?: string) =>
        apiFetch<unknown[]>(`/admin/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`, getReq()),
      listPaged: (opts?: { page?: number; pageSize?: number; status?: string }) =>
        apiFetch<Paged<Record<string, unknown>>>(`/admin/orders${pageQuery(opts)}`, getReq()),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/orders/${encodeURIComponent(id)}`, mut('PATCH', data)),
    },
    gallery: {
      list: () => apiFetch<unknown[]>('/admin/gallery', getReq()),
      upload: (data: unknown) => apiFetch<unknown>('/admin/gallery/upload', mut('POST', data)),
      update: (id: string, data: unknown) => apiFetch<unknown>(`/admin/gallery/${encodeURIComponent(id)}`, mut('PATCH', data)),
      delete: (id: string) => apiFetch<unknown>(`/admin/gallery/${encodeURIComponent(id)}`, mut('DELETE')),
    },
    settings: {
      get: () => apiFetch<unknown>('/admin/settings', getReq()),
      update: (data: unknown) => apiFetch<unknown>('/admin/settings', mut('PATCH', data)),
    },
    upload: (file: string, folder?: string) => apiFetch<unknown>('/admin/upload', mut('POST', { file, folder })),
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
      monthly: (year: number) => apiFetch<unknown[]>(`/admin/accounting/monthly?year=${year}`, getReq()),
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
    // ── Centro Financiero (módulo financial, libro mayor) ──────
    finanzas: {
      resumen: (from: string, to: string) =>
        apiFetch<FinanceResumen>(`/admin/finanzas/resumen?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, getReq()),
      serie: (year: number) => apiFetch<FinanceSeriePoint[]>(`/admin/finanzas/serie?year=${year}`, getReq()),
      movimientos: {
        list: (params?: string) =>
          apiFetch<FinancePage>(`/admin/finanzas/movimientos${params ? `?${params}` : ''}`, getReq()),
        create: (data: unknown) => apiFetch<FinanceMovement>('/admin/finanzas/movimientos', mut('POST', data)),
        update: (id: string, data: Partial<{ category: string | null; accountId: string | null; paymentMethod: string | null; description: string }>) =>
          apiFetch<FinanceMovement>(`/admin/finanzas/movimientos/${encodeURIComponent(id)}`, mut('PATCH', data)),
        anular: (id: string, motivo?: string) =>
          apiFetch<FinanceMovement>(`/admin/finanzas/movimientos/${encodeURIComponent(id)}/anular`, mut('POST', { motivo: motivo ?? null })),
      },
      conciliacion: () => apiFetch<FinanceConciliacion>('/admin/finanzas/conciliacion', getReq()),
      ia: {
        estado: () => apiFetch<{ disponible: boolean }>('/admin/finanzas/ia/estado', getReq()),
        texto: (prompt: string) => apiFetch<FinanceSugerencia>('/admin/finanzas/ia/texto', mut('POST', { prompt })),
        comprobante: (file: string) => apiFetch<FinanceSugerencia>('/admin/finanzas/ia/comprobante', mut('POST', { file })),
      },
      cuentas: {
        list: () => apiFetch<FinanceAccount[]>('/admin/finanzas/cuentas', getReq()),
        create: (data: { name: string; type?: string; sortOrder?: number }) =>
          apiFetch<FinanceAccount>('/admin/finanzas/cuentas', mut('POST', data)),
        update: (id: string, data: Partial<{ name: string; type: string; isActive: boolean; sortOrder: number }>) =>
          apiFetch<FinanceAccount>(`/admin/finanzas/cuentas/${encodeURIComponent(id)}`, mut('PATCH', data)),
      },
      vouchers: {
        list: (movementId: string) =>
          apiFetch<FinanceVoucher[]>(`/admin/finanzas/movimientos/${encodeURIComponent(movementId)}/vouchers`, getReq()),
        upload: (movementId: string, file: string, fileName?: string) =>
          apiFetch<FinanceVoucher>(`/admin/finanzas/movimientos/${encodeURIComponent(movementId)}/vouchers`, mut('POST', { file, fileName })),
        delete: (id: string) => apiFetch<{ success: true }>(`/admin/finanzas/vouchers/${encodeURIComponent(id)}`, mut('DELETE')),
      },
    },
  };
}

// ── Tipos del Centro Financiero (espejo del backend) ──────────
export interface FinanceTotales { ingresos: number; egresos: number; utilidad: number }
export interface FinanceDesglose { key: string; label: string; total: number; count: number }
export interface FinanceResumen {
  periodo: { from: string; to: string };
  hoy: FinanceTotales;
  periodoActual: FinanceTotales & { variacion: FinanceTotales | null };
  margen: number;
  cajaDisponible: number;
  adelantosPendientes: { total: number; count: number };
  cuentasPorCobrar: { total: number; count: number };
  ventasProductos: { total: number; count: number };
  serviciosVendidos: { total: number; count: number };
  clientesAtendidos: number;
  ticketPromedio: number;
  porCategoria: FinanceDesglose[];
  porMetodoPago: FinanceDesglose[];
  porTipo: FinanceDesglose[];
}
export interface FinanceSeriePoint { month: number; year: number; income: number; expenses: number; profit: number }
export interface FinanceMovement {
  id: string;
  direction: 'in' | 'out';
  type: string;
  status: 'settled' | 'pending' | 'void';
  amountPen: number;
  category: string | null;
  description: string;
  occurredAt: string;
  paymentMethod: string | null;
  source: string;
  appointmentId: string | null;
  bookingPaymentId: string | null;
  orderId: string | null;
  customerId: string | null;
  staffId: string | null;
  accountId: string | null;
  account: { id: string; name: string; type: string } | null;
  receiptUrl: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
}
export interface FinancePage { items: FinanceMovement[]; total: number; page: number; pageSize: number }
export interface FinanceAccount {
  id: string; name: string; type: string; isActive: boolean; sortOrder: number; balancePen: number; createdAt: string;
}
export interface FinanceVoucher {
  id: string; movementId: string; url: string; fileType: string; fileName: string | null; publicId: string | null; createdAt: string;
}
export interface FinanceSugerencia {
  tipo: string;
  direccion: 'in' | 'out';
  monto: number | null;
  moneda: string;
  descripcion: string;
  fecha: string | null;
  categoria: string | null;
  metodoPago: string | null;
  contraparte: string | null;
  confianza: number;
}
export interface FinanceConciliacion {
  sinVoucher: { count: number; movements: FinanceMovement[] };
  sinCategoria: { count: number; movements: FinanceMovement[] };
  adelantosPendientes: { count: number; total: number; items: { id: string; customerName: string; total: number; deposit: number; createdAt: string; bookingGroupId: string | null }[] };
  pagosIncompletos: { count: number; total: number; items: { id: string; customerName: string; balancePen: number; receiptNumber: string | null }[] };
  duplicados: { count: number; groups: { key: string; movements: FinanceMovement[] }[] };
  totalPendientes: number;
}
