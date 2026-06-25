import { describe, it, expect } from 'vitest';
import { Movimiento, type DatosNuevoMovimiento } from './Movimiento';
import { MontoInvalidoError, DatosMovimientoInvalidosError } from './errors';

const base: DatosNuevoMovimiento = {
  tipo: 'egreso',
  monto: 150,
  descripcion: 'Compra de tintes',
  fecha: '2026-06-20',
  source: 'expense',
};

describe('Movimiento.crear', () => {
  it('crea un egreso válido con dirección "out" derivada del tipo', () => {
    const m = Movimiento.crear(base);
    expect(m.direccion).toBe('out');
    expect(m.monto).toBe(150);
    expect(m.descripcion).toBe('Compra de tintes');
  });

  it('deriva dirección "in" para tipos de ingreso (adelanto, pago_final, venta)', () => {
    expect(Movimiento.crear({ ...base, tipo: 'adelanto' }).direccion).toBe('in');
    expect(Movimiento.crear({ ...base, tipo: 'pago_final' }).direccion).toBe('in');
    expect(Movimiento.crear({ ...base, tipo: 'venta' }).direccion).toBe('in');
  });

  it('respeta la dirección explícita en tipos ambiguos (ajuste)', () => {
    expect(Movimiento.crear({ ...base, tipo: 'ajuste', direccion: 'out' }).direccion).toBe('out');
    expect(Movimiento.crear({ ...base, tipo: 'ajuste', direccion: 'in' }).direccion).toBe('in');
  });

  it('rechaza monto <= 0', () => {
    expect(() => Movimiento.crear({ ...base, monto: 0 })).toThrow(MontoInvalidoError);
    expect(() => Movimiento.crear({ ...base, monto: -10 })).toThrow(MontoInvalidoError);
  });

  it('rechaza descripción vacía', () => {
    expect(() => Movimiento.crear({ ...base, descripcion: '   ' })).toThrow(DatosMovimientoInvalidosError);
  });

  it('rechaza fecha mal formada', () => {
    expect(() => Movimiento.crear({ ...base, fecha: '20-06-2026' })).toThrow(DatosMovimientoInvalidosError);
  });

  it('usa céntimos enteros (sin error de coma flotante)', () => {
    const m = Movimiento.crear({ ...base, monto: 0.1 + 0.2 });
    expect(m.monto).toBe(0.3);
  });
});
