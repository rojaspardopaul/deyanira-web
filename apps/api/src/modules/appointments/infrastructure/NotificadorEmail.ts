// Adaptador de notificaciones. Reutiliza lib/notifications/email.js. Mantiene el
// comportamiento legacy: fire-and-forget (no bloquea ni hace fallar la reserva;
// los errores solo se loguean).

import type { CitaPersistida } from '../domain/ports/CitaRepositorio';
import type { Notificador, Contacto, InfoPaquete } from '../domain/ports/Notificador';

/* eslint-disable @typescript-eslint/no-var-requires */
const email = require('../../../lib/notifications/email') as {
  sendAppointmentRequested: (a: unknown) => Promise<unknown>;
  sendBookingRequested: (a: unknown) => Promise<unknown>;
  sendNewBookingToSalon: (a: unknown) => Promise<unknown>;
  sendAppointmentCancelled: (a: unknown) => Promise<unknown>;
  sendAppointmentConfirmation: (a: unknown) => Promise<unknown>;
  sendAppointmentInProgress: (a: unknown) => Promise<unknown>;
  sendAppointmentCompleted: (a: unknown) => Promise<unknown>;
  sendAppointmentNoShow: (a: unknown) => Promise<unknown>;
  sendAppointmentRescheduled: (a: unknown) => Promise<unknown>;
  sendBookingConfirmation: (a: unknown) => Promise<unknown>;
};
const logger = require('../../../lib/logger') as { error: (msg: string, meta?: unknown) => void };

function fireAndForget(p: Promise<unknown>): void {
  p.catch((err: Error) => logger.error('email_failed', { msg: err.message }));
}

export class NotificadorEmail implements Notificador {
  citaSolicitada(cita: CitaPersistida, contacto: Contacto): void {
    fireAndForget(email.sendAppointmentRequested({ appointment: cita, email: contacto.email, name: contacto.nombre }));
  }

  reservaSolicitada(
    citas: CitaPersistida[],
    contacto: Contacto,
    paquete: InfoPaquete | null,
    atHomeExtraPen: number | null,
  ): void {
    fireAndForget(
      email.sendBookingRequested({
        appointments: citas,
        packageInfo: paquete,
        email: contacto.email,
        name: contacto.nombre,
        atHomeExtraPen,
      }),
    );
  }

  nuevaReservaAlSalon(cita: CitaPersistida): void {
    fireAndForget(email.sendNewBookingToSalon({ appointment: cita }));
  }

  citaCancelada(cita: CitaPersistida, contacto: Contacto, motivo: string): void {
    fireAndForget(
      email.sendAppointmentCancelled({ appointment: cita, email: contacto.email, name: contacto.nombre, reason: motivo }),
    );
  }

  // ── Gestión admin ───────────────────────────────────────────

  citaConfirmada(cita: CitaPersistida, contacto: Contacto): void {
    fireAndForget(email.sendAppointmentConfirmation({ appointment: cita, email: contacto.email, name: contacto.nombre }));
  }

  citaEnProceso(cita: CitaPersistida, contacto: Contacto): void {
    fireAndForget(email.sendAppointmentInProgress({ appointment: cita, email: contacto.email, name: contacto.nombre }));
  }

  citaCompletada(cita: CitaPersistida, contacto: Contacto): void {
    fireAndForget(email.sendAppointmentCompleted({ appointment: cita, email: contacto.email, name: contacto.nombre }));
  }

  citaNoAsistio(cita: CitaPersistida, contacto: Contacto): void {
    fireAndForget(email.sendAppointmentNoShow({ appointment: cita, email: contacto.email, name: contacto.nombre }));
  }

  citaReprogramada(
    cita: CitaPersistida,
    contacto: Contacto,
    anterior: { fecha: Date | string; hora: string },
  ): void {
    fireAndForget(
      email.sendAppointmentRescheduled({
        appointment: cita,
        email: contacto.email,
        name: contacto.nombre,
        beforeDate: anterior.fecha,
        beforeStart: anterior.hora,
      }),
    );
  }

  reservaConfirmada(
    citas: CitaPersistida[],
    contacto: Contacto,
    paquete: InfoPaquete | null,
    atHomeExtraPen: number | null,
  ): void {
    fireAndForget(
      email.sendBookingConfirmation({
        appointments: citas,
        packageInfo: paquete,
        email: contacto.email,
        name: contacto.nombre,
        atHomeExtraPen,
      }),
    );
  }
}
