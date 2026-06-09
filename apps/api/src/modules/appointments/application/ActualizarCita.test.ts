import { describe, it, expect, vi } from 'vitest';
import { ActualizarCita } from './ActualizarCita';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { CitaRepositorio, CitaPersistida, ConflictoCita } from '../domain/ports/CitaRepositorio';
import type { Notificador } from '../domain/ports/Notificador';
import { CitaNoEncontradaError, SolicitudCitaInvalidaError, HorarioNoDisponibleError } from '../domain/errors';

const ctx: ContextoTenant = { tenantId: 'test' };
const STAFF2 = '22222222-2222-2222-2222-222222222222';

const baseCurrent = (): CitaPersistida => ({
  id: 'apt-1',
  date: new Date('2026-06-15T12:00:00Z'),
  startTime: '10:00',
  endTime: '11:00',
  staffId: 'staff-1',
  customerId: null,
  guestEmail: 'cli@t.com',
  guestName: 'Ana',
  packageId: null,
  status: 'pending',
});

function crearDeps(o: {
  current?: CitaPersistida | null;
  conflicto?: ConflictoCita | null;
  updated?: Partial<CitaPersistida>;
} = {}) {
  const current = o.current === undefined ? baseCurrent() : o.current;
  const notificador: Notificador = {
    citaSolicitada: vi.fn(),
    reservaSolicitada: vi.fn(),
    nuevaReservaAlSalon: vi.fn(),
    citaCancelada: vi.fn(),
    citaConfirmada: vi.fn(),
    citaEnProceso: vi.fn(),
    citaCompletada: vi.fn(),
    citaNoAsistio: vi.fn(),
    citaReprogramada: vi.fn(),
    reservaConfirmada: vi.fn(),
  };
  const actualizarAdmin = vi.fn(
    async (_c: ContextoTenant, id: string): Promise<CitaPersistida> => ({
      ...(current ?? { id }),
      ...o.updated,
      id,
    }),
  );
  const citas = {
    buscarPorId: vi.fn(async () => current),
    buscarConflictoAdmin: vi.fn(async () => o.conflicto ?? null),
    actualizarAdmin,
  } as unknown as CitaRepositorio;
  const uc = new ActualizarCita(citas, notificador);
  return { uc, citas, notificador, actualizarAdmin };
}

describe('ActualizarCita', () => {
  it('lanza CitaNoEncontradaError si la cita no existe', async () => {
    const { uc } = crearDeps({ current: null });
    await expect(uc.ejecutar(ctx, { citaId: 'x', status: 'confirmed' })).rejects.toBeInstanceOf(CitaNoEncontradaError);
  });

  it('rechaza un estado inválido', async () => {
    const { uc } = crearDeps();
    await expect(uc.ejecutar(ctx, { citaId: 'apt-1', status: 'foo' })).rejects.toBeInstanceOf(SolicitudCitaInvalidaError);
  });

  it('rechaza cuando no hay nada que actualizar', async () => {
    const { uc } = crearDeps();
    await expect(uc.ejecutar(ctx, { citaId: 'apt-1' })).rejects.toThrow('Nada que actualizar');
  });

  it('confirma una cita individual y notifica al cliente', async () => {
    const { uc, actualizarAdmin, notificador } = crearDeps({ updated: { status: 'confirmed' } });
    await uc.ejecutar(ctx, { citaId: 'apt-1', status: 'confirmed' });
    expect(actualizarAdmin).toHaveBeenCalledWith(ctx, 'apt-1', expect.objectContaining({ estado: 'confirmada' }));
    expect(notificador.citaConfirmada).toHaveBeenCalledTimes(1);
  });

  it('NO envía confirmación individual si la cita es de paquete', async () => {
    const current = { ...baseCurrent(), packageId: 'pkg-1' };
    const { uc, notificador } = crearDeps({ current, updated: { status: 'confirmed', packageId: 'pkg-1' } });
    await uc.ejecutar(ctx, { citaId: 'apt-1', status: 'confirmed' });
    expect(notificador.citaConfirmada).not.toHaveBeenCalled();
  });

  it('reprograma (fecha/hora) y manda el correo de reprogramación con el "antes"', async () => {
    const { uc, actualizarAdmin, notificador } = crearDeps({
      updated: { date: new Date('2026-06-16T12:00:00Z'), startTime: '14:00', endTime: '15:00' },
    });
    await uc.ejecutar(ctx, { citaId: 'apt-1', date: '2026-06-16', startTime: '14:00', endTime: '15:00' });
    expect(actualizarAdmin).toHaveBeenCalledWith(
      ctx,
      'apt-1',
      expect.objectContaining({ fecha: '2026-06-16', startTime: '14:00', endTime: '15:00' }),
    );
    expect(notificador.citaReprogramada).toHaveBeenCalledTimes(1);
    const arg = (notificador.citaReprogramada as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(arg).toMatchObject({ hora: '10:00' });
  });

  it('bloquea la reprogramación si hay conflicto en el destino', async () => {
    const { uc } = crearDeps({ conflicto: { servicioNombre: 'Corte', inicio: '14:30', fin: '15:30' } });
    await expect(
      uc.ejecutar(ctx, { citaId: 'apt-1', date: '2026-06-16', startTime: '14:00', endTime: '15:00' }),
    ).rejects.toThrow(/Corte.*14:30.*15:30/);
    await expect(
      uc.ejecutar(ctx, { citaId: 'apt-1', startTime: '14:00', endTime: '15:00' }),
    ).rejects.toBeInstanceOf(HorarioNoDisponibleError);
  });

  it('cancela con el motivo "Cancelado por el salón"', async () => {
    const { uc, notificador } = crearDeps({ updated: { status: 'cancelled' } });
    await uc.ejecutar(ctx, { citaId: 'apt-1', status: 'cancelled' });
    expect(notificador.citaCancelada).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'cli@t.com' }),
      'Cancelado por el salón',
    );
  });

  it('mapea in_progress→en proceso, completed→completada, no_show→no asistió', async () => {
    for (const [status, metodo] of [
      ['in_progress', 'citaEnProceso'],
      ['completed', 'citaCompletada'],
      ['no_show', 'citaNoAsistio'],
    ] as const) {
      const { uc, notificador } = crearDeps({ updated: { status } });
      await uc.ejecutar(ctx, { citaId: 'apt-1', status });
      expect(notificador[metodo]).toHaveBeenCalledTimes(1);
    }
  });

  it('reasigna estilista (valida UUID) y corre el chequeo de conflicto', async () => {
    const { uc, actualizarAdmin, citas } = crearDeps();
    await uc.ejecutar(ctx, { citaId: 'apt-1', staffId: STAFF2 });
    expect(actualizarAdmin).toHaveBeenCalledWith(ctx, 'apt-1', expect.objectContaining({ staff: { staffId: STAFF2 } }));
    expect(citas.buscarConflictoAdmin).toHaveBeenCalledTimes(1);
    // staffId mal formado → 400
    const { uc: uc2 } = crearDeps();
    await expect(uc2.ejecutar(ctx, { citaId: 'apt-1', staffId: 'no-uuid' })).rejects.toBeInstanceOf(SolicitudCitaInvalidaError);
  });

  it('reasignar a "de turno" (staffId null) no chequea conflicto', async () => {
    const { uc, citas } = crearDeps();
    await uc.ejecutar(ctx, { citaId: 'apt-1', staffId: null });
    expect(citas.buscarConflictoAdmin).not.toHaveBeenCalled();
  });
});
