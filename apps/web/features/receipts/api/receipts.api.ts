// API de recibos (panel admin, cookie-based). El PDF se descarga con fetch crudo
// porque apiFetch asume JSON; el resto usa el cliente compartido.

import { apiFetch, type RequestOptions } from '@/shared/api/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type ReceiptStatus = 'pending' | 'partial' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'yape' | 'plin' | 'transfer' | 'culqi';

export interface ReceiptItem {
  description: string;
  qty: number;
  unitPen: number;
  amountPen: number;
}

export interface ReceiptPayment {
  id: string;
  amountPen: number;
  method: string;
  paidAt: string;
  note: string | null;
  proofImageUrl: string | null;
  registeredBy: string | null;
  createdAt: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  title: string | null;
  totalPen: number;
  paidPen: number;
  balancePen: number;
  status: ReceiptStatus;
  bookingGroupId: string | null;
  packageId: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  items: ReceiptItem[];
  payments: ReceiptPayment[];
}

export interface CrearReciboInput {
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerId?: string | null;
  title?: string | null;
  items: ReceiptItem[];
  bookingGroupId?: string | null;
  packageId?: string | null;
  notes?: string | null;
  payments?: { amountPen: number; method: PaymentMethod; paidAt?: string | null; note?: string | null }[];
}

export interface NuevoPagoInput {
  amountPen: number;
  method: PaymentMethod;
  paidAt?: string | null;
  note?: string | null;
}

export interface BookingDeposit {
  totalPen: number;
  depositPen: number;
  paidPen: number;
  balancePen: number;
  status: string;
  receiptNumber: string | null;
  method: string | null;
  paidAt: string | null;
}

export interface CustomerBooking {
  bookingGroupId: string;
  packageId: string | null;
  isPackage: boolean;
  date: string;
  label: string;
  total: number;
  status: string;
  items: { description: string; amountPen: number }[];
  deposit: BookingDeposit | null;
}

const mut = (method: 'POST', body?: unknown): RequestOptions => ({ method, body, admin: true });
const get = (): RequestOptions => ({ admin: true });

export const receiptsApi = {
  list: (params?: { status?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.q) qs.set('q', params.q);
    const s = qs.toString();
    return apiFetch<Receipt[]>(`/admin/receipts${s ? `?${s}` : ''}`, get());
  },
  get: (id: string) => apiFetch<Receipt>(`/admin/receipts/${encodeURIComponent(id)}`, get()),
  customerBookings: (params: { customerId?: string | null; phone?: string | null }) => {
    const qs = new URLSearchParams();
    if (params.customerId) qs.set('customerId', params.customerId);
    if (params.phone) qs.set('phone', params.phone);
    return apiFetch<CustomerBooking[]>(`/admin/receipts/customer-bookings?${qs.toString()}`, get());
  },
  create: (data: CrearReciboInput) => apiFetch<Receipt>('/admin/receipts', mut('POST', data)),
  addPayment: (id: string, data: NuevoPagoInput) =>
    apiFetch<Receipt>(`/admin/receipts/${encodeURIComponent(id)}/payments`, mut('POST', data)),
  cancel: (id: string) => apiFetch<Receipt>(`/admin/receipts/${encodeURIComponent(id)}/cancel`, mut('POST')),
  sendEmail: (id: string) =>
    apiFetch<{ sent: true; email: string }>(`/admin/receipts/${encodeURIComponent(id)}/send-email`, mut('POST')),
  // PDF: fetch crudo con cookies → Blob (apiFetch asume JSON).
  pdfBlob: async (id: string): Promise<Blob> => {
    const res = await fetch(`${API_URL}/api/admin/receipts/${encodeURIComponent(id)}/pdf`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('No se pudo generar el PDF');
    return res.blob();
  },
};

export type ReceiptsApi = typeof receiptsApi;
