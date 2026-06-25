import { describe, it, expect } from 'vitest';
import { toPersistence } from './mappers';
import { Cita } from '../domain/Cita';
import { FranjaHoraria } from '../domain/FranjaHoraria';
import { Dinero } from '../../../shared/domain/Dinero';

function citaBase(over: Partial<Parameters<typeof Cita.crear>[0]> = {}) {
  return Cita.crear({
    servicioId: 'svc',
    staffId: null,
    onDutyStaff: true,
    fecha: '2026-06-15',
    franja: FranjaHoraria.de('10:00', '11:00'),
    total: Dinero.de(150),
    notas: null,
    solicitante: { customerId: null, guestName: 'Ana', guestPhone: '+51999', guestEmail: 'a@t.com' },
    domicilio: { aDomicilio: false, direccion: null, distrito: null, recargo: null },
    ...over,
  });
}

describe('toPersistence', () => {
  it('mapea campos base; estado pendiente -> pending; fecha con padding T12:00:00Z', () => {
    const d = toPersistence(citaBase());
    expect(d.status).toBe('pending');
    expect(d.serviceId).toBe('svc');
    expect(d.startTime).toBe('10:00');
    expect(d.endTime).toBe('11:00');
    expect(d.totalPen).toBe(150);
    expect(d.onDutyStaff).toBe(true);
    expect(d.staffId).toBeUndefined();
    expect(d.atHome).toBe(false);
    expect(d.atHomeExtraPen).toBeNull();
    expect((d.date as Date).toISOString()).toBe('2026-06-15T12:00:00.000Z');
  });

  it('incluye staffId y recargo a domicilio cuando aplica', () => {
    const d = toPersistence(
      citaBase({
        staffId: 'stf',
        domicilio: { aDomicilio: true, direccion: 'Av X', distrito: 'Surco', recargo: Dinero.de(25) },
      }),
    );
    expect(d.staffId).toBe('stf');
    expect(d.atHome).toBe(true);
    expect(d.atHomeDistrict).toBe('Surco');
    expect(d.atHomeExtraPen).toBe(25);
  });
});
