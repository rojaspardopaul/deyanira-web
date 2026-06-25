// Value object: una franja horaria [inicio, fin) en formato 'HH:mm' (24h).
//
// Encapsula la invariante "inicio < fin" y la detección de solapamiento, que en
// el código legacy estaba dispersa (overlaps/toMin en availability.js y un
// `if (startTime >= endTime)` inline en la ruta).

import { RangoHorarioInvalidoError } from './errors';

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class FranjaHoraria {
  private constructor(
    readonly inicio: string,
    readonly fin: string,
  ) {}

  static de(inicio: string, fin: string): FranjaHoraria {
    if (!HHMM_RE.test(inicio) || !HHMM_RE.test(fin)) {
      throw new RangoHorarioInvalidoError(`Horas inválidas: ${inicio} - ${fin} (formato HH:mm)`);
    }
    if (inicio >= fin) {
      throw new RangoHorarioInvalidoError('endTime debe ser posterior a startTime');
    }
    return new FranjaHoraria(inicio, fin);
  }

  /** Minutos totales desde medianoche de una hora 'HH:mm'. */
  static minutos(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  duracionMin(): number {
    return FranjaHoraria.minutos(this.fin) - FranjaHoraria.minutos(this.inicio);
  }

  /** ¿Se solapa con otra franja? (mismo criterio que el overlaps legacy). */
  seSolapaCon(otra: FranjaHoraria): boolean {
    return this.inicio < otra.fin && this.fin > otra.inicio;
  }

  equals(otra: FranjaHoraria): boolean {
    return this.inicio === otra.inicio && this.fin === otra.fin;
  }

  toString(): string {
    return `${this.inicio}–${this.fin}`;
  }
}
