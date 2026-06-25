// Adaptador de renderizado del recibo de adelanto. Reutiliza
// lib/receipts/bookingReceipt.renderBookingReceiptHtml.

import type { DatosRecibo, ReciboRenderer } from '../domain/ports/ReciboRenderer';

/* eslint-disable @typescript-eslint/no-var-requires */
const { renderBookingReceiptHtml } = require('../../../lib/receipts/bookingReceipt') as {
  renderBookingReceiptHtml: (datos: {
    payment: unknown;
    appointments: unknown[];
    package: unknown;
    salon: unknown;
  }) => string;
};

export class ReciboRendererLib implements ReciboRenderer {
  html(datos: DatosRecibo): string {
    return renderBookingReceiptHtml({
      payment: datos.payment,
      appointments: datos.appointments,
      package: datos.package,
      salon: datos.salon,
    });
  }
}
