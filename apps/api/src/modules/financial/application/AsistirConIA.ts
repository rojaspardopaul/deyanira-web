// Caso de uso: IA Contable. Devuelve un movimiento SUGERIDO (borrador) para que
// el usuario lo revise y confirme. No persiste nada — la confirmación reusa el
// alta normal de movimientos.

import { IANoDisponibleError, DatosMovimientoInvalidosError } from '../domain/errors';
import type { AsistenteContable, MovimientoSugerido } from '../domain/ports/AsistenteContable';

export class AsistirConIA {
  constructor(private readonly ia: AsistenteContable) {}

  disponible(): boolean {
    return this.ia.disponible();
  }

  interpretarTexto(prompt: string): Promise<MovimientoSugerido> {
    if (!this.ia.disponible()) throw new IANoDisponibleError('IA Contable no disponible');
    const p = (prompt || '').trim();
    if (p.length < 3) throw new DatosMovimientoInvalidosError('Escribe una instrucción más detallada');
    return this.ia.interpretarTexto(p.slice(0, 1000));
  }

  analizarComprobante(fileBase64: string, mimeType: string): Promise<MovimientoSugerido> {
    if (!this.ia.disponible()) throw new IANoDisponibleError('IA Contable no disponible');
    if (!fileBase64) throw new DatosMovimientoInvalidosError('Comprobante requerido');
    return this.ia.analizarComprobante(fileBase64, mimeType);
  }
}
