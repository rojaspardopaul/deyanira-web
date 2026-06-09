// Puerto de renderizado del recibo de adelanto (HTML). Reutiliza
// lib/receipts/bookingReceipt.js.

export interface DatosRecibo {
  readonly payment: Record<string, unknown>;
  readonly appointments: Array<Record<string, unknown>>;
  readonly package: Record<string, unknown> | null;
  readonly salon: Record<string, unknown>;
}

export interface ReciboRenderer {
  html(datos: DatosRecibo): string;
}
