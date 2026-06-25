// Puerto de la IA Contable: interpreta texto libre o un comprobante (imagen/PDF)
// y devuelve un movimiento SUGERIDO (no persistido). La confirmación la hace el
// usuario en la pantalla de revisión y reusa el alta normal de movimientos.

import type { Direccion, TipoMovimiento } from '../TipoMovimiento';

export interface MovimientoSugerido {
  readonly tipo: TipoMovimiento;
  readonly direccion: Direccion;
  readonly monto: number | null;
  readonly moneda: string;            // 'PEN' por defecto
  readonly descripcion: string;
  readonly fecha: string | null;      // 'YYYY-MM-DD' si se detectó
  readonly categoria: string | null;
  readonly metodoPago: string | null; // efectivo|transferencia|tarjeta|yape|plin|culqi
  readonly contraparte: string | null; // proveedor / cliente detectado
  readonly confianza: number;          // 0..1
}

export interface AsistenteContable {
  /** Disponible solo si hay GEMINI_API_KEY configurada. */
  disponible(): boolean;
  /** Interpreta una instrucción en lenguaje natural. */
  interpretarTexto(prompt: string): Promise<MovimientoSugerido>;
  /** Extrae los datos de un comprobante (boleta/factura/captura Yape/Plin). */
  analizarComprobante(fileBase64: string, mimeType: string): Promise<MovimientoSugerido>;
}
