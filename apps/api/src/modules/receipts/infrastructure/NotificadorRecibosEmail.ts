// Adaptador de notificaciones de recibos. Reutiliza lib/notifications/email.js.
// El envío es manual (botón del admin), así que se espera (await) para reportar
// que se intentó; los errores de Resend se loguean dentro de email.js.

import type { Contacto, NotificadorRecibos } from '../domain/ports/NotificadorRecibos';
import type { ReciboPersistido } from '../domain/ports/ReciboRepositorio';

/* eslint-disable @typescript-eslint/no-var-requires */
const email = require('../../../lib/notifications/email') as {
  sendReceiptEmail: (a: unknown) => Promise<unknown>;
};

export class NotificadorRecibosEmail implements NotificadorRecibos {
  async enviarRecibo(recibo: ReciboPersistido, pdf: Buffer, contacto: Contacto): Promise<void> {
    await email.sendReceiptEmail({
      receipt: recibo,
      pdfBuffer: pdf,
      email: contacto.email,
      name: contacto.nombre,
    });
  }
}
