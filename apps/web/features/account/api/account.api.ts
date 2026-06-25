// API de la cuenta del cliente (perfil + compartir ticket de cita). Migrada desde
// lib/api.ts.

import { apiFetch, LIVE } from '@/shared/api/client';

export const customersApi = {
  me: (token: string) =>
    apiFetch<{ id: string; name: string; phone: string | null }>('/customers/me', { token, ...LIVE }),
  updateMe: (data: { name?: string; phone?: string }, token: string) =>
    apiFetch<unknown>('/customers/me', { method: 'PATCH', body: data, token }),
};

export const bookingsApi = {
  // Sube una imagen del ticket de la cita a Cloudinary y devuelve la URL pública
  // (para compartir por WhatsApp con previsualización).
  shareImage: (data: { appointmentId: string; image: string }, token: string) =>
    apiFetch<{ url: string }>('/bookings/share-image', { method: 'POST', body: data, token }),
};
