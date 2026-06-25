// API de pagos de reserva / adelantos (instrucciones de pago, Culqi, comprobante).
// Migrada desde lib/api.ts.

import { apiFetch, LIVE } from '@/shared/api/client';

export const bookingPaymentsApi = {
  // Datos de la reserva + adelanto + instrucciones de pago (id = UUID challenge)
  get: (id: string) =>
    apiFetch<{
      id: string;
      status: 'pending' | 'awaiting_verification' | 'paid' | 'rejected' | 'expired';
      method: string | null;
      totalPen: number;
      depositPercent: number;
      depositPen: number;
      paidPen: number;
      balancePen: number;
      receiptNumber: string | null;
      customerName: string;
      customerEmail: string | null;
      customerPhone: string | null;
      package: { id: string; name: string; eventType?: { name?: string } | null } | null;
      appointments: Array<{
        id: string;
        serviceName: string | null;
        staffName: string | null;
        onDutyStaff: boolean;
        date: string;
        startTime: string;
        endTime: string;
        totalPen: number;
      }>;
      salon: Record<string, unknown>;
      culqiPublicKey: string | null;
    }>(`/booking-payments/${encodeURIComponent(id)}`, LIVE),
  culqi: (id: string, data: { culqiToken: string; email: string }) =>
    apiFetch<{ success: boolean; receiptNumber?: string; alreadyPaid?: boolean }>(
      `/booking-payments/${encodeURIComponent(id)}/culqi`,
      { method: 'POST', body: data },
    ),
  uploadProof: (id: string, data: { image: string; method: 'yape' | 'plin' | 'transfer' }) =>
    apiFetch<{ success: boolean; status: string }>(
      `/booking-payments/${encodeURIComponent(id)}/proof`,
      { method: 'POST', body: data },
    ),
};
