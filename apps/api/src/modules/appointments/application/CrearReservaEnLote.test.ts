import { describe, it, expect, vi } from 'vitest';
import { CrearReservaEnLote } from './CrearReservaEnLote';
import { CrearReservaComando, type CuerpoCrearReserva } from './dto/CrearReservaComando';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { CatalogoReservas, PaqueteReserva, ServicioLote } from '../domain/ports/CatalogoReservas';
import type { CitaRepositorio, DatosReservaLote } from '../domain/ports/CitaRepositorio';
import type { CalculadoraPrecios } from '../domain/ports/CalculadoraPrecios';
import type { ConfiguracionDomicilio } from '../domain/ports/ConfiguracionDomicilio';
import type { Notificador } from '../domain/ports/Notificador';
import type { Reloj } from '../domain/ports/Reloj';
import type { Scheduler } from '../domain/ports/Scheduler';
import { PaqueteNoEncontradoError, ServicioNoEncontradoError } from '../domain/errors';

const ctx: ContextoTenant = { tenantId: 'test' };

const svc = (over: Partial<ServicioLote> = {}): ServicioLote => ({
  id: 'svc1',
  name: 'Maquillaje',
  isActive: true,
  pricePen: 200,
  duration: 60,
  parallelGroup: null,
  daysBeforeMain: null,
  ...over,
});

interface Overrides {
  paquete?: PaqueteReserva | null;
  servicios?: ServicioLote[];
}

function crearDeps(o: Overrides = {}) {
  let ultimoLote: DatosReservaLote | null = null;

  const catalogo: CatalogoReservas = {
    cargarPaquete: vi.fn(async () => o.paquete ?? null),
    cargarServiciosParaLote: vi.fn(async () => o.servicios ?? [svc()]),
  };
  const citas = {
    asegurarCliente: vi.fn(async () => {}),
    contarActivasDeCliente: vi.fn(async () => 0),
    crearLote: vi.fn(async (_c: ContextoTenant, d: DatosReservaLote) => {
      ultimoLote = d;
      return { created: d.lineas.map((_l, i) => ({ id: `apt-${i}` })), payment: d.deposito ? { id: 'pay-1' } : null };
    }),
  } as unknown as CitaRepositorio;
  const precios = {
    validarRequeridos: vi.fn(() => []),
    calcular: vi.fn(() => ({ totalPrice: 0, totalDuration: 0, blocked: false, blockedReasons: [], requiresLeadDays: null })),
  } as unknown as CalculadoraPrecios;
  const configDomicilio: ConfiguracionDomicilio = { obtener: vi.fn(async () => null) };
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
    reservaRechazada: vi.fn(),
    reciboAdelanto: vi.fn(),
  };
  const reloj: Reloj = { ahoraLima: () => ({ fecha: '2026-06-10', hora: '08:00', ms: Date.parse('2026-06-10T08:00:00') }) };
  const scheduler: Scheduler = {
    programar: ({ items, serviceById, startTime }) =>
      items.map((it) => ({
        serviceId: it.serviceId,
        staffId: it.staffId ?? null,
        onDutyStaff: !it.staffId,
        date: it.date ?? '2026-06-15',
        startTime: it.startTime ?? startTime,
        endTime: '11:00',
        addonPricePen: it.addonPricePen ?? 0,
        service: serviceById.get(it.serviceId)!,
      })),
    diasEntre: (a, b) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000),
  };

  return { catalogo, citas, precios, configDomicilio, notificador, reloj, scheduler, getLote: () => ultimoLote };
}

const body = (over: Partial<CuerpoCrearReserva> = {}): CuerpoCrearReserva => ({
  items: [{ serviceId: 'svc1' }],
  date: '2026-06-15',
  startTime: '10:00',
  guestName: 'Ana',
  guestEmail: 'a@t.com',
  ...over,
});

function correr(deps: ReturnType<typeof crearDeps>, b: CuerpoCrearReserva) {
  const uc = new CrearReservaEnLote(deps.catalogo, deps.citas, deps.configDomicilio, deps.precios, deps.scheduler, deps.notificador, deps.reloj);
  return uc.ejecutar(ctx, CrearReservaComando.desdeHttp(b, null));
}

describe('CrearReservaEnLote', () => {
  it('sin paquete: cada cita lleva su propio precio', async () => {
    const deps = crearDeps({ servicios: [svc({ pricePen: 200 })] });
    const res = await correr(deps, body());
    const json = res.aJSON();
    expect(json.total).toBe(200);
    expect(json.requiresDeposit).toBe(false);
    expect(deps.getLote()?.lineas[0].totalPen).toBe(200);
    expect(deps.notificador.reservaSolicitada).toHaveBeenCalledOnce();
  });

  it('con paquete + depósito: precio del paquete a la 1ra cita, resto 0, calcula adelanto', async () => {
    const paquete: PaqueteReserva = {
      id: 'pkg1', isActive: true, pricePen: 1000, requiresDeposit: true, depositPercent: 50,
      name: 'Novia', groupLabel: null, eventType: null,
      trialAddonServiceId: null, items: [{ serviceId: 'svc1' }, { serviceId: 'svc2' }],
    };
    const deps = crearDeps({ paquete, servicios: [svc({ id: 'svc1' }), svc({ id: 'svc2' })] });
    const res = await correr(deps, body({ packageId: 'pkg1', items: [{ serviceId: 'svc1' }, { serviceId: 'svc2' }] }));
    const json = res.aJSON();
    expect(json.total).toBe(1000);
    expect(json.requiresDeposit).toBe(true);
    expect(json.depositPen).toBe(500);
    expect(json.bookingPaymentId).toBe('pay-1');
    expect(deps.getLote()?.lineas.map((l) => l.totalPen)).toEqual([1000, 0]);
  });

  it('paquete inexistente -> PaqueteNoEncontradoError', async () => {
    const deps = crearDeps({ paquete: null });
    await expect(correr(deps, body({ packageId: 'pkgX' }))).rejects.toBeInstanceOf(PaqueteNoEncontradoError);
  });

  it('item con servicio inexistente -> ServicioNoEncontradoError', async () => {
    const deps = crearDeps({ servicios: [] });
    await expect(correr(deps, body())).rejects.toBeInstanceOf(ServicioNoEncontradoError);
  });
});
