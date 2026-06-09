// Adaptador de notificaciones de adelantos. Reutiliza lib/notifications/email.js.
// Fire-and-forget: los errores solo se loguean, nunca bloquean la operación.

import type { Contacto, NotificadorAdelantos } from '../domain/ports/NotificadorAdelantos';

/* eslint-disable @typescript-eslint/no-var-requires */
const email = require('../../../lib/notifications/email') as {
  sendBookingConfirmation: (a: unknown) => Promise<unknown>;
  sendDepositReceipt: (a: unknown) => Promise<unknown>;
  sendDepositProofReceived: (a: unknown) => Promise<unknown>;
  sendDepositProofToSalon: (a: unknown) => Promise<unknown>;
};
const logger = require('../../../lib/logger') as { error: (msg: string, meta?: unknown) => void };

function fireAndForget(p: Promise<unknown>): void {
  p.catch((err: Error) => logger.error('email_failed', { msg: err.message }));
}

export class NotificadorAdelantosEmail implements NotificadorAdelantos {
  comprobanteRecibido(pago: Record<string, unknown>, contacto: Contacto): void {
    fireAndForget(email.sendDepositProofReceived({ payment: pago, email: contacto.email, name: contacto.nombre }));
  }

  comprobanteAlSalon(pago: Record<string, unknown>): void {
    fireAndForget(email.sendDepositProofToSalon({ payment: pago }));
  }

  confirmacionYRecibo(
    pago: Record<string, unknown>,
    appointments: Array<Record<string, unknown>>,
    packageInfo: unknown | null,
    contacto: Contacto,
  ): void {
    fireAndForget(
      email.sendBookingConfirmation({
        appointments,
        packageInfo,
        email: contacto.email,
        name: contacto.nombre,
        atHomeExtraPen: 0,
      }),
    );
    fireAndForget(
      email.sendDepositReceipt({ payment: pago, appointments, packageInfo, email: contacto.email, name: contacto.nombre }),
    );
  }

  recibo(
    pago: Record<string, unknown>,
    appointments: Array<Record<string, unknown>>,
    packageInfo: unknown | null,
    contacto: Contacto,
  ): void {
    fireAndForget(
      email.sendDepositReceipt({ payment: pago, appointments, packageInfo, email: contacto.email, name: contacto.nombre }),
    );
  }
}
