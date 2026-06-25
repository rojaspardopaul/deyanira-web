import { describe, it, expect, vi } from 'vitest';
import { RechazarGrupoCitas } from './RechazarGrupoCitas';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { CitaRepositorio, CitaPersistida } from '../domain/ports/CitaRepositorio';
import type { Notificador } from '../domain/ports/Notificador';
import { SolicitudCitaInvalidaError, CitaNoEncontradaError } from '../domain/errors';

const ctx: ContextoTenant = { tenantId: 'test' };
const GROUP = '33333333-3333-3333-3333-333333333333';

const grupoBase = (): CitaPersistida[] => [
  {
    id: 'apt-1',
    guestEmail: 'cli@t.com',
    guestName: 'Ana',
    atHomeExtraPen: null,
    customer: null,
    package: {
      name: 'Paquete Uno',
      groupLabel: null,
      eventType: { id: 'ev1', name: 'Novia', slug: 'novia' },
      pricePen: 450,
      trialAddonServiceId: 'svc-trial',
      items: [{ serviceId: 'svc-1' }, { serviceId: 'svc-2' }],
    },
  },
  { id: 'apt-2', guestEmail: 'cli@t.com', guestName: 'Ana' },
];

function crearDeps(o: { grupo?: CitaPersistida[] } = {}) {
  const grupo = o.grupo ?? grupoBase();
  const notificador = { reservaRechazada: vi.fn() } as unknown as Notificador;
  const cancelarActivasDelGrupo = vi.fn(async () => {});
  const rechazarPagoPendienteDelGrupo = vi.fn(async () => {});
  const citas = {
    buscarGrupoPorBookingGroup: vi.fn(async () => grupo),
    cancelarActivasDelGrupo,
    rechazarPagoPendienteDelGrupo,
    recargarCitas: vi.fn(async () => grupo),
  } as unknown as CitaRepositorio;
  const uc = new RechazarGrupoCitas(citas, notificador);
  return { uc, citas, notificador, cancelarActivasDelGrupo, rechazarPagoPendienteDelGrupo };
}

describe('RechazarGrupoCitas', () => {
  it('rechaza bookingGroupId inválido', async () => {
    const { uc } = crearDeps();
    await expect(uc.ejecutar(ctx, { bookingGroupId: 'nope', date: '2026-06-26' }))
      .rejects.toBeInstanceOf(SolicitudCitaInvalidaError);
  });

  it('rechaza date inválida', async () => {
    const { uc } = crearDeps();
    await expect(uc.ejecutar(ctx, { bookingGroupId: GROUP, date: '26/06/2026' }))
      .rejects.toBeInstanceOf(SolicitudCitaInvalidaError);
  });

  it('lanza CitaNoEncontradaError si el grupo está vacío', async () => {
    const { uc } = crearDeps({ grupo: [] });
    await expect(uc.ejecutar(ctx, { bookingGroupId: GROUP, date: '2026-06-26' }))
      .rejects.toBeInstanceOf(CitaNoEncontradaError);
  });

  it('cancela las citas del día, rechaza el pago pendiente y manda UN correo', async () => {
    const deps = crearDeps();
    const res = await deps.uc.ejecutar(ctx, { bookingGroupId: GROUP, date: '2026-06-26' });
    expect(res).toEqual({ ok: true, count: 2 });
    expect(deps.cancelarActivasDelGrupo).toHaveBeenCalledWith(ctx, ['apt-1', 'apt-2']);
    expect(deps.rechazarPagoPendienteDelGrupo).toHaveBeenCalledWith(ctx, GROUP);
    expect(deps.notificador.reservaRechazada).toHaveBeenCalledOnce();
    // El paquete del correo lleva precio e includedServiceIds (presentación por paquete).
    const llamada = (deps.notificador.reservaRechazada as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(llamada[1]).toEqual({ email: 'cli@t.com', nombre: 'Ana' });
    expect(llamada[2]).toMatchObject({
      name: 'Paquete Uno',
      pricePen: 450,
      includedServiceIds: ['svc-1', 'svc-2'],
      trialAddonServiceId: 'svc-trial',
    });
  });

  it('no manda correo si el grupo no tiene email', async () => {
    const grupo = grupoBase().map((a) => ({ ...a, guestEmail: null }));
    const deps = crearDeps({ grupo });
    const res = await deps.uc.ejecutar(ctx, { bookingGroupId: GROUP, date: '2026-06-26' });
    expect(res.count).toBe(2);
    expect(deps.notificador.reservaRechazada).not.toHaveBeenCalled();
  });
});
