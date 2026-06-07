// Puerto de notificaciones. La implementación (Resend) reutiliza las funciones de
// lib/notifications/email.js. Las notificaciones son fire-and-forget (igual que hoy):
// nunca bloquean ni hacen fallar la creación de la cita.

import type { CitaPersistida } from './CitaRepositorio';

export interface Contacto {
  readonly email: string;
  readonly nombre: string;
}

export interface Notificador {
  /** Acuse al cliente: "Solicitud recibida" (stepper paso 1). */
  citaSolicitada(cita: CitaPersistida, contacto: Contacto): void;

  /** Aviso al salón de nueva reserva para revisar/confirmar. */
  nuevaReservaAlSalon(cita: CitaPersistida): void;

  /** Aviso al cliente de cancelación. */
  citaCancelada(cita: CitaPersistida, contacto: Contacto, motivo: string): void;
}
