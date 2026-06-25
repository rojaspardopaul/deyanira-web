import { describe, it, expect } from 'vitest';
// Import por namespace: el módulo objetivo es CommonJS (module.exports = {...}).
import * as calc from './calculate';

// Tests de CARACTERIZACIÓN (Fase 0): fijan el comportamiento ACTUAL del motor de
// precios para detectar cualquier regresión cuando el piloto `appointments` lo
// mueva detrás del puerto CalculadoraPrecios. No cambian la lógica, la blindan.

const opt = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  label: 'Aerógrafo',
  modifierType: 'fixed',
  modifierValue: 50,
  durationDelta: 0,
  ...over,
});

const grupo = (over: Record<string, unknown> = {}) => ({
  id: 'g1',
  name: 'Extras',
  required: false,
  fieldType: 'single_select',
  options: [opt()],
  ...over,
});

const servicio = (over: Record<string, unknown> = {}) => ({
  pricePen: 100,
  duration: 60,
  modifierGroups: [],
  conditionalRules: [],
  ...over,
});

describe('calculatePrice — base', () => {
  it('sin selección devuelve precio y duración base', () => {
    const r = calc.calculatePrice(servicio(), {});
    expect(r.basePrice).toBe(100);
    expect(r.totalPrice).toBe(100);
    expect(r.totalDuration).toBe(60);
    expect(r.blocked).toBe(false);
    expect(r.requiresLeadDays).toBeNull();
  });
});

describe('calculatePrice — modificadores', () => {
  it('fixed: suma el valor fijo y la duración del delta', () => {
    const svc = servicio({ modifierGroups: [grupo({ options: [opt({ modifierValue: 50, durationDelta: 15 })] })] });
    const r = calc.calculatePrice(svc, { g1: ['o1'] });
    expect(r.totalPrice).toBe(150);
    expect(r.totalDuration).toBe(75);
  });

  it('percent: aplica porcentaje sobre el precio base', () => {
    const svc = servicio({ modifierGroups: [grupo({ options: [opt({ modifierType: 'percent', modifierValue: 10 })] })] });
    const r = calc.calculatePrice(svc, { g1: ['o1'] });
    expect(r.totalPrice).toBe(110); // 100 + 100*0.10
  });

  it('multiplier: aplica delta = base*(valor-1)', () => {
    const svc = servicio({ modifierGroups: [grupo({ options: [opt({ modifierType: 'multiplier', modifierValue: 2 })] })] });
    const r = calc.calculatePrice(svc, { g1: ['o1'] });
    expect(r.totalPrice).toBe(200); // 100 + 100*(2-1)
  });

  it('per_quantity: multiplica valor por la cantidad seleccionada', () => {
    const svc = servicio({ modifierGroups: [grupo({ id: 'g2', options: [opt({ id: 'o2', modifierType: 'per_quantity', modifierValue: 30 })] })] });
    const r = calc.calculatePrice(svc, { g2: { optionIds: ['o2'], quantity: 3 } });
    expect(r.totalPrice).toBe(190); // 100 + 30*3
  });
});

describe('calculatePrice — reglas condicionales', () => {
  const conRegla = (rule: Record<string, unknown>) =>
    servicio({
      modifierGroups: [grupo()],
      conditionalRules: [{ isActive: true, conditions: [{ groupId: 'g1', operator: 'truthy' }], ...rule }],
    });

  it('add_price: suma monto fijo cuando la condición se cumple', () => {
    const r = calc.calculatePrice(conRegla({ effect: 'add_price', effectValue: { value: 25 }, name: 'Recargo' }), { g1: ['o1'] });
    // 100 (base) + 50 (opción fixed) + 25 (regla) = 175
    expect(r.totalPrice).toBe(175);
  });

  it('block_booking: marca blocked con la razón', () => {
    const r = calc.calculatePrice(conRegla({ effect: 'block_booking', name: 'No disponible' }), { g1: ['o1'] });
    expect(r.blocked).toBe(true);
    expect(r.blockedReasons).toContain('No disponible');
  });

  it('require_lead_days: expone los días de anticipación requeridos', () => {
    const r = calc.calculatePrice(conRegla({ effect: 'require_lead_days', effectValue: { days: 3 } }), { g1: ['o1'] });
    expect(r.requiresLeadDays).toBe(3);
  });

  it('regla inactiva no aplica', () => {
    const svc = servicio({
      modifierGroups: [grupo()],
      conditionalRules: [{ isActive: false, effect: 'add_price', effectValue: { value: 999 }, conditions: [{ groupId: 'g1', operator: 'truthy' }] }],
    });
    const r = calc.calculatePrice(svc, { g1: ['o1'] });
    expect(r.totalPrice).toBe(150); // sin el +999
  });
});

describe('validateRequired', () => {
  it('reporta grupos requeridos sin selección', () => {
    const svc = servicio({ modifierGroups: [grupo({ required: true })] });
    const errs = calc.validateRequired(svc, {});
    expect(errs).toHaveLength(1);
    expect(errs[0].groupId).toBe('g1');
  });

  it('no reporta cuando el grupo requerido está seleccionado', () => {
    const svc = servicio({ modifierGroups: [grupo({ required: true })] });
    const errs = calc.validateRequired(svc, { g1: { optionIds: ['o1'] } });
    expect(errs).toHaveLength(0);
  });
});

describe('normalizeSelection', () => {
  it('array -> optionIds', () => {
    expect(calc.normalizeSelection({ g1: ['a', 'b'] })).toEqual({ g1: { optionIds: ['a', 'b'] } });
  });
  it('string -> optionIds de un elemento', () => {
    expect(calc.normalizeSelection({ g1: 'x' })).toEqual({ g1: { optionIds: ['x'] } });
  });
  it('boolean -> value', () => {
    expect(calc.normalizeSelection({ g1: true })).toEqual({ g1: { value: true } });
  });
});
