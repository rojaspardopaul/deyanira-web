// Puerto de notificaciones. La implementación (Resend) reutiliza las funciones de
// lib/notifications/email.js. Las notificaciones son fire-and-forget (igual que hoy):
// nunca bloquean ni hacen fallar la creación de la cita.

import type { CitaPersistida } from './CitaRepositorio';

export interface Contacto {
  readonly email: string;
  readonly nombre: string;
}

/** Info del paquete para el correo consolidado de reserva en lote. */
export interface InfoPaquete {
  readonly name: string;
  readonly groupLabel: string | null;
  readonly eventType: { id: string; name: string; slug: string } | null;
}

export interface Notificador {
  /** Acuse al cliente: "Solicitud recibida" (stepper paso 1). */
  citaSolicitada(cita: CitaPersistida, contacto: Contacto): void;

  /** Acuse consolidado de una reserva en lote (paquete o varios servicios). */
  reservaSolicitada(
    citas: CitaPersistida[],
    contacto: Contacto,
    paquete: InfoPaquete | null,
    atHomeExtraPen: number | null,
  ): void;

  /** Aviso al salón de nueva reserva para revisar/confirmar. */
  nuevaReservaAlSalon(cita: CitaPersistida): void;

  /** Aviso al cliente de cancelación. */
  citaCancelada(cita: CitaPersistida, contacto: Contacto, motivo: string): void;
}
