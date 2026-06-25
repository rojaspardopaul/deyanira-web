import { describe, it, expect, vi } from 'vitest';

// availability.js importa el cliente Prisma en el top-level (vía el shim lib/prisma.js).
// La lógica de duración es pura y no lo usa, así que lo mockeamos para no arrastrar
// Prisma (ni la resolución de .ts) dentro de un test de función pura.
vi.mock('../prisma', () => ({ default: {} }));

import * as availability from './availability';

// Caracterización (Fase 0) de la lógica PURA de duración con servicios en paralelo.
// El piloto reusará esto detrás del puerto ServicioDisponibilidad sin tocar el algoritmo.

describe('effectiveDurationWithParallel', () => {
  it('lista vacía => 0', () => {
    expect(availability.effectiveDurationWithParallel([])).toBe(0);
  });

  it('servicios secuenciales => suma de duraciones', () => {
    expect(availability.effectiveDurationWithParallel([{ duration: 30 }, { duration: 45 }])).toBe(75);
  });

  it('mismo parallelGroup => solo cuenta el más largo', () => {
    const r = availability.effectiveDurationWithParallel([
      { duration: 30, parallelGroup: 'a' },
      { duration: 45, parallelGroup: 'a' },
    ]);
    expect(r).toBe(45);
  });

  it('mezcla secuencial + paralelo', () => {
    const r = availability.effectiveDurationWithParallel([
      { duration: 60 },
      { duration: 30, parallelGroup: 'a' },
      { duration: 45, parallelGroup: 'a' },
    ]);
    expect(r).toBe(105); // 60 (secuencial) + 45 (máximo del grupo 'a')
  });
});

describe('DEFAULT_SCHEDULE', () => {
  it('expone Lun–Sáb 08:00–20:00', () => {
    expect(availability.DEFAULT_SCHEDULE.startTime).toBe('08:00');
    expect(availability.DEFAULT_SCHEDULE.endTime).toBe('20:00');
    expect(availability.DEFAULT_SCHEDULE.enabledDays.has(0)).toBe(false); // domingo cerrado
    expect(availability.DEFAULT_SCHEDULE.enabledDays.has(6)).toBe(true); // sábado abierto
  });
});
