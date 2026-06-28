import { describe, it, expect } from 'vitest';
import { calcularSubtotal, calcularDescuento, calcularEnvioYTotal } from './CalculadoraPedido';

describe('CalculadoraPedido', () => {
  it('subtotal = suma de precio*cantidad', () => {
    expect(calcularSubtotal([{ pricePen: 50, qty: 2 }, { pricePen: 30, qty: 1 }])).toBe(130);
  });

  it('descuento percent (value = porcentaje entero)', () => {
    expect(calcularDescuento(200, { type: 'percent', value: 10 })).toBe(20);
  });

  it('descuento fixed', () => {
    expect(calcularDescuento(200, { type: 'fixed', value: 15 })).toBe(15);
  });

  it('descuento acotado al subtotal', () => {
    expect(calcularDescuento(10, { type: 'fixed', value: 50 })).toBe(10);
  });

  const envio = (costoEnvio: number, recojoEnSalon = false, envioGratisDesde = 100) =>
    ({ costoEnvio, recojoEnSalon, envioGratisDesde });

  it('envío: gratis al alcanzar el umbral, costo por distancia si no', () => {
    expect(calcularEnvioYTotal(50, 0, envio(10)).shipping).toBe(10);
    expect(calcularEnvioYTotal(150, 0, envio(10)).shipping).toBe(0);
  });

  it('recojo en salón: envío 0 aunque no alcance el umbral', () => {
    expect(calcularEnvioYTotal(50, 0, envio(10, true)).shipping).toBe(0);
  });

  it('total = subtotal + envío - descuento (nunca negativo)', () => {
    expect(calcularEnvioYTotal(150, 20, envio(10)).total).toBe(130);
    expect(calcularEnvioYTotal(5, 50, envio(10)).total).toBe(0);
  });
});
