// Puerto de notificaciones de adelantos. Reutiliza lib/notifications/email.js.
// Todas fire-and-forget (no bloquean ni hacen fallar la operación).

export interface Contacto {
  readonly email: string;
  readonly nombre: string;
}

export interface NotificadorAdelantos {
  /** Acuse al cliente: "comprobante recibido, en verificación". */
  comprobanteRecibido(pago: Record<string, unknown>, contacto: Contacto): void;

  /** Aviso al salón de un comprobante por verificar. */
  comprobanteAlSalon(pago: Record<string, unknown>): void;

  /** Tras pago/verificación: confirmación de reserva + recibo al cliente
   *  (sendBookingConfirmation + sendDepositReceipt). */
  confirmacionYRecibo(
    pago: Record<string, unknown>,
    appointments: Array<Record<string, unknown>>,
    packageInfo: unknown | null,
    contacto: Contacto,
  ): void;

  /** Solo el recibo del adelanto (registro manual admin). */
  recibo(
    pago: Record<string, unknown>,
    appointments: Array<Record<string, unknown>>,
    packageInfo: unknown | null,
    contacto: Contacto,
  ): void;
}
