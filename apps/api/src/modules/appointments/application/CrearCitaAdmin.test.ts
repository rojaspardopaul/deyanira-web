import { describe, it, expect, vi } from 'vitest';
import { CrearCitaAdmin, type CrearCitaAdminComando } from './CrearCitaAdmin';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { CitaRepositorio, CitaPersistida, DatosCitaAdmin, ConflictoCita } from '../domain/ports/CitaRepositorio';
import type { Reloj } from '../domain/ports/Reloj';
import { SolicitudCitaInvalidaError, ServicioNoEncontradoError, CitaEnPasadoError, HorarioNoDisponibleError } from '../domain/errors';

const ctx: ContextoTenant = { tenantId: 'test' };
const SVC = '11111111-1111-1111-1111-111111111111';
const STAFF1 = '22222222-2222-2222-2222-222222222222';

const reloj: Reloj = { ahoraLima: () => ({ fecha: '2026-06-10', hora: '08:00', ms: Date.parse('2026-06-10T08:00:00') }) };

function crearDeps(o: { servicio?: { pricePen: unknown } | null; conflicto?: ConflictoCita | null } = {}) {
  const crearAdmin = vi.fn(async (_ctx: ContextoTenant, _datos: DatosCitaAdmin): Promise<CitaPersistida> => ({ id: 'apt-new' }));
  const citas = {
    buscarServicioBasico: vi.fn(async () => (o.servicio === undefined ? { pricePen: 120 } : o.servicio)),
    buscarConflictoAdmin: vi.fn(async () => o.conflicto ?? null),
    crearAdmin,
  } as unknown as CitaRepositorio;
  const uc = new CrearCitaAdmin(citas, reloj);
  return { uc, citas, crearAdmin };
}

const body = (over: Partial<CrearCitaAdminComando> = {}): CrearCitaAdminComando => ({
  staffId: STAFF1,
  serviceId: SVC,
  date: '2026-06-15',
  startTime: '10:00',
  endTime: '11:00',
  guestName: 'Ana',
  ...over,
});

describe('CrearCitaAdmin', () => {
  it('exige serviceId/date/startTime/endTime', async () => {
    const { uc } = crearDeps();
    await expect(uc.ejecutar(ctx, { guestName: 'Ana' })).rejects.toBeInstanceOf(SolicitudCitaInvalidaError);
  });

  it('valida formato de serviceId', async () => {
    const { uc } = crearDeps();
    await expect(uc.ejecutar(ctx, body({ serviceId: 'no-uuid' }))).rejects.toThrow('serviceId inválido');
  });

  it('exige fin posterior al inicio', async () => {
    const { uc } = crearDeps();
    await expect(uc.ejecutar(ctx, body({ startTime: '11:00', endTime: '10:00' }))).rejects.toBeInstanceOf(SolicitudCitaInvalidaError);
  });

  it('rechaza fechas en el pasado', async () => {
    const { uc } = crearDeps();
    await expect(uc.ejecutar(ctx, body({ date: '2026-06-09' }))).rejects.toBeInstanceOf(CitaEnPasadoError);
  });

  it('rechaza hora pasada si la fecha es hoy', async () => {
    const { uc } = crearDeps();
    await expect(uc.ejecutar(ctx, body({ date: '2026-06-10', startTime: '07:00', endTime: '07:30' }))).rejects.toBeInstanceOf(CitaEnPasadoError);
  });

  it('404 si el servicio no existe', async () => {
    const { uc } = crearDeps({ servicio: null });
    await expect(uc.ejecutar(ctx, body())).rejects.toBeInstanceOf(ServicioNoEncontradoError);
  });

  it('409 si la estilista ya tiene una cita que solapa', async () => {
    const { uc } = crearDeps({ conflicto: { servicioNombre: 'Corte', inicio: '10:30', fin: '11:30' } });
    await expect(uc.ejecutar(ctx, body())).rejects.toBeInstanceOf(HorarioNoDisponibleError);
  });

  it('crea con estilista: estado por defecto confirmed + precio del servicio', async () => {
    const { uc, crearAdmin } = crearDeps();
    await uc.ejecutar(ctx, body());
    const datos = crearAdmin.mock.calls[0][1] as DatosCitaAdmin;
    expect(datos.staffId).toBe(STAFF1);
    expect(datos.estadoBd).toBe('confirmed');
    expect(datos.totalPen).toBe(120);
    expect(datos.franja.inicio).toBe('10:00');
  });

  it('staffId "on-duty" → sin estilista y sin chequeo de conflicto', async () => {
    const { uc, citas, crearAdmin } = crearDeps();
    await uc.ejecutar(ctx, body({ staffId: 'on-duty' }));
    expect(citas.buscarConflictoAdmin).not.toHaveBeenCalled();
    const datos = crearAdmin.mock.calls[0][1] as DatosCitaAdmin;
    expect(datos.staffId).toBeNull();
  });

  it('respeta un estado explícito válido', async () => {
    const { uc, crearAdmin } = crearDeps();
    await uc.ejecutar(ctx, body({ status: 'pending' }));
    const datos = crearAdmin.mock.calls[0][1] as DatosCitaAdmin;
    expect(datos.estadoBd).toBe('pending');
  });
});
