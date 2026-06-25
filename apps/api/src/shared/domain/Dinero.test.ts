import { describe, it, expect } from 'vitest';
import { Dinero } from './Dinero';

describe('Dinero', () => {
  it('usa céntimos enteros (sin errores de coma flotante)', () => {
    const a = Dinero.de(0.1);
    const b = Dinero.de(0.2);
    expect(a.sumar(b).monto).toBe(0.3); // 0.1 + 0.2 con floats daría 0.30000000000000004
  });

  it('default de moneda es PEN', () => {
    expect(Dinero.de(10).moneda).toBe('PEN');
  });

  it('por() escala y redondea a céntimo (p. ej. 30% de adelanto)', () => {
    expect(Dinero.de(150).por(0.3).monto).toBe(45);
  });

  it('restar y esCero', () => {
    expect(Dinero.de(50).restar(Dinero.de(50)).esCero()).toBe(true);
  });

  it('equals compara monto y moneda', () => {
    expect(Dinero.de(10).equals(Dinero.enCentimos(1000))).toBe(true);
  });

  it('rechaza montos no finitos', () => {
    expect(() => Dinero.de(Infinity)).toThrow();
  });
});
