// Value object de dinero — consciente de moneda (default 'PEN').
//
// Diseño "seam" para el SaaS futuro: NO incluye FX ni conversión (eso sería
// sobreingeniería para un negocio 100% PEN hoy). Solo garantiza que no se operen
// montos de monedas distintas y que la aritmética use céntimos enteros
// (evita los errores de coma flotante de los floats).

export type Moneda = 'PEN';

export class Dinero {
  private constructor(
    readonly centimos: number,
    readonly moneda: Moneda,
  ) {}

  /** Crea desde un monto en unidades (p. ej. 150.5 soles). */
  static de(monto: number, moneda: Moneda = 'PEN'): Dinero {
    if (!Number.isFinite(monto)) throw new RangeError(`Monto inválido: ${monto}`);
    return new Dinero(Math.round(monto * 100), moneda);
  }

  /** Crea desde céntimos enteros (p. ej. 15050). */
  static enCentimos(centimos: number, moneda: Moneda = 'PEN'): Dinero {
    if (!Number.isInteger(centimos)) throw new RangeError(`Céntimos debe ser entero: ${centimos}`);
    return new Dinero(centimos, moneda);
  }

  static cero(moneda: Moneda = 'PEN'): Dinero {
    return new Dinero(0, moneda);
  }

  /** Monto en unidades (soles). */
  get monto(): number {
    return this.centimos / 100;
  }

  sumar(otro: Dinero): Dinero {
    this.assertMismaMoneda(otro);
    return new Dinero(this.centimos + otro.centimos, this.moneda);
  }

  restar(otro: Dinero): Dinero {
    this.assertMismaMoneda(otro);
    return new Dinero(this.centimos - otro.centimos, this.moneda);
  }

  /** Multiplica por un factor escalar (p. ej. % de adelanto). Redondea a céntimo. */
  por(factor: number): Dinero {
    if (!Number.isFinite(factor)) throw new RangeError(`Factor inválido: ${factor}`);
    return new Dinero(Math.round(this.centimos * factor), this.moneda);
  }

  esCero(): boolean {
    return this.centimos === 0;
  }

  esNegativo(): boolean {
    return this.centimos < 0;
  }

  equals(otro: Dinero): boolean {
    return this.centimos === otro.centimos && this.moneda === otro.moneda;
  }

  toJSON(): { monto: number; moneda: Moneda } {
    return { monto: this.monto, moneda: this.moneda };
  }

  toString(): string {
    return `${this.moneda} ${this.monto.toFixed(2)}`;
  }

  private assertMismaMoneda(otro: Dinero): void {
    if (this.moneda !== otro.moneda) {
      throw new Error(`No se pueden operar monedas distintas: ${this.moneda} vs ${otro.moneda}`);
    }
  }
}
