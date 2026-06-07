// Adaptador de notificaciones. Reutiliza lib/notifications/email.js. Mantiene el
// comportamiento legacy: fire-and-forget (no bloquea ni hace fallar la reserva;
// los errores solo se loguean).

import type { CitaPersistida } from '../domain/ports/CitaRepositorio';
import type { Notificador, Contacto } from '../domain/ports/Notificador';

/* eslint-disable @typescript-eslint/no-var-requires */
const email = require('../../../lib/notifications/email') as {
  sendAppointmentRequested: (a: unknown) => Promise<unknown>;
  sendNewBookingToSalon: (a: unknown) => Promise<unknown>;
  sendAppointmentCancelled: (a: unknown) => Promise<unknown>;
};
const logger = require('../../../lib/logger') as { error: (msg: string, meta?: unknown) => void };

function fireAndForget(p: Promise<unknown>): void {
  p.catch((err: Error) => logger.error('email_failed', { msg: err.message }));
}

export class NotificadorEmail implements Notificador {
  citaSolicitada(cita: CitaPersistida, contacto: Contacto): void {
    fireAndForget(email.sendAppointmentRequested({ appointment: cita, email: contacto.email, name: contacto.nombre }));
  }

  nuevaReservaAlSalon(cita: CitaPersistida): void {
    fireAndForget(email.sendNewBookingToSalon({ appointment: cita }));
  }

  citaCancelada(cita: CitaPersistida, contacto: Contacto, motivo: string): void {
    fireAndForget(
      email.sendAppointmentCancelled({ appointment: cita, email: contacto.email, name: contacto.nombre, reason: motivo }),
    );
  }
}
