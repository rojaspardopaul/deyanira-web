// Barrel feature-first. El cliente HTTP base vive en @/shared/api/client y cada
// dominio en @/features/*/api. Este archivo solo COMPONE el objeto `api` y re-exporta
// el admin api / tipos, para no romper los imports existentes
// (`import { api, adminApi, adminAuth } from '@/lib/api'`).

import { servicesApi, eventTypesApi, catalogsApi, staffApi, productsApi } from '@/features/catalog/api/catalog.api';
import { appointmentsApi } from '@/features/appointments/api/appointments.api';
import { ordersApi } from '@/features/orders/api/orders.api';
import { paymentsApi } from '@/features/payments/api/payments.api';
import { galleryApi, blogApi } from '@/features/content/api/content.api';
import { settingsApi, promotionsApi } from '@/features/settings/api/settings.api';
import { bookingPaymentsApi } from '@/features/booking-payments/api/booking-payments.api';
import { customersApi, bookingsApi } from '@/features/account/api/account.api';

export type { Paged } from '@/shared/api/client';
export { adminAuth, adminApi } from '@/features/admin/api/admin.api';
export type {
  FinanceResumen, FinanceSeriePoint, FinanceMovement, FinancePage,
  FinanceAccount, FinanceTotales, FinanceDesglose, FinanceVoucher, FinanceConciliacion, FinanceSugerencia,
} from '@/features/admin/api/admin.api';

// ── API pública (barrel por feature) ──────────────────────
export const api = {
  services: servicesApi,
  eventTypes: eventTypesApi,
  catalogs: catalogsApi,
  staff: staffApi,
  appointments: appointmentsApi,
  products: productsApi,
  orders: ordersApi,
  payments: paymentsApi,
  gallery: galleryApi,
  blog: blogApi,
  settings: settingsApi,
  bookingPayments: bookingPaymentsApi,
  promotions: promotionsApi,
  customers: customersApi,
  bookings: bookingsApi,
};
