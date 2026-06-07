import { describe, it, expect, vi } from 'vitest';
import { CrearCita } from './CrearCita';
import { CrearCitaComando, type CuerpoCrearCita, type UsuarioAutenticado } from './dto/CrearCitaComando';
import { Dinero } from '../../../shared/domain/Dinero';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { Cita } from '../domain/Cita';
import type { CitaRepositorio, CitaPersistida } from '../domain/ports/CitaRepositorio';
import type { CalculadoraPrecios, ResultadoPrecio, ServicioParaPrecio } from '../domain/ports/CalculadoraPrecios';
import type { ConfiguracionDomicilio } from '../domain/ports/ConfiguracionDomicilio';
import type { Notificador } from '../domain/ports/Notificador';
import type { Reloj } from '../domain/ports/Reloj';
import {
  AnticipacionRequeridaError,
  CitaBloqueadaError,
  CitaEnPasadoError,
  DatosInvitadoRequeridosError,
  DemasiadasCitasActivasError,
  DireccionDomicilioRequeridaError,
  EstilistaNoRealizaServicioError,
  HorarioNoDisponibleError,
  RangoHorarioInvalidoError,
  ServicioNoDisponibleError,
} from '../domain/errors';

const ctx: ContextoTenant = { tenantId: 'test' };

// ── Fakes de los puertos ──────────────────────────────────────
interface DepsOverrides {
  realiza?: boolean;
  conflicto?: boolean;
  activasCliente?: number;
  recientesInvitado?: number;
  servicio?: ServicioParaPrecio | null;
  faltantes?: { name: string }[];
  precio?: Partial<ResultadoPrecio>;
  configDomicilio?: { habilitado: boolean; recargo: number } | null;
}

function crearDeps(o: DepsOverrides = {}) {
  const guardadas: Cita[] = [];
  const persistida = (cita: Cita): CitaPersistida => ({
    id: 'apt-1',
    status: 'pending',
    customerId: cita.solicitante.customerId,
    guestName: cita.solicitante.guestName,
    guestEmail: cita.solicitante.guestEmail,
    totalPen: cita.total.monto,
  });

  const citas: CitaRepositorio = {
    estilistaRealizaServicio: vi.fn(async () => o.realiza ?? true),
    hayConflicto: vi.fn(async () => o.conflicto ?? false),
    contarActivasDeCliente: vi.fn(async () => o.activasCliente ?? 0),
    contarActivasRecientesDeInvitado: vi.fn(async () => o.recientesInvitado ?? 0),
    asegurarCliente: vi.fn(async () => {}),
    guardar: vi.fn(async (_c, cita: Cita) => {
      guardadas.push(cita);
      return persistida(cita);
    }),
    buscarPorId: vi.fn(async () => null),
    cambiarEstado: vi.fn(async () => persistida(guardadas[0])),
  };

  const precios: CalculadoraPrecios = {
    cargarServicio: vi.fn(async () =>
      o.servicio === undefined ? ({ id: 'svc', name: 'Maquillaje', isActive: true, pricePen: 100 }) : o.servicio,
    ),
    validarRequeridos: vi.fn(() => o.faltantes ?? []),
    calcular: vi.fn((): ResultadoPrecio => ({
      totalPrice: 100,
      totalDuration: 60,
      blocked: false,
      blockedReasons: [],
      requiresLeadDays: null,
      ...o.precio,
    })),
  };

  const configDomicilio: ConfiguracionDomicilio = {
    obtener: vi.fn(async () =>
      o.configDomicilio === null
        ? null
        : {
            habilitado: o.configDomicilio?.habilitado ?? true,
            recargoPara: () => Dinero.de(o.configDomicilio?.recargo ?? 25),
          },
    ),
  };

  const notificador: Notificador = {
    citaSolicitada: vi.fn(),
    nuevaReservaAlSalon: vi.fn(),
    citaCancelada: vi.fn(),
  };

  const reloj: Reloj = {
    ahoraLima: () => ({ fecha: '2026-06-10', hora: '08:00', ms: Date.parse('2026-06-10T08:00:00') }),
  };

  return { citas, precios, configDomicilio, notificador, reloj, guardadas };
}

const bodyBase = (over: Partial<CuerpoCrearCita> = {}): CuerpoCrearCita => ({
  serviceId: 'svc',
  date: '2026-06-15',
  startTime: '10:00',
  endTime: '11:00',
  guestName: 'Ana',
  guestPhone: '+51999888777',
  guestEmail: 'ana@test.com',
  ...over,
});

function ejecutar(deps: ReturnType<typeof crearDeps>, body: CuerpoCrearCita, usuario: UsuarioAutenticado | null = null) {
  const uc = new CrearCita(deps.citas, deps.precios, deps.configDomicilio, deps.notificador, deps.reloj);
  return uc.ejecutar(ctx, CrearCitaComando.desdeHttp(body, usuario));
}

// ── Tests ─────────────────────────────────────────────────────
describe('CrearCita — happy path', () => {
  it('crea la cita, notifica y devuelve el contrato { appointment, atHomeExtraPen }', async () => {
    const deps = crearDeps();
    const res = await ejecutar(deps, bodyBase());
    const json = res.aJSON();

    expect(json.appointment.id).toBe('apt-1');
    expect(json.atHomeExtraPen).toBeNull();
    expect(deps.guardadas[0].total.monto).toBe(100);
    expect(deps.notificador.citaSolicitada).toHaveBeenCalledOnce();
    expect(deps.notificador.nuevaReservaAlSalon).toHaveBeenCalledOnce();
  });

  it('a domicilio: suma el recargo al total y lo expone en atHomeExtraPen', async () => {
    const deps = crearDeps({ configDomicilio: { habilitado: true, recargo: 25 } });
    const res = await ejecutar(deps, bodyBase({ atHome: true, atHomeAddress: 'Av. Siempre Viva 123', atHomeDistrict: 'Surco' }));
    expect(res.aJSON().atHomeExtraPen).toBe(25);
    expect(deps.guardadas[0].total.monto).toBe(125);
  });
});

describe('CrearCita — validaciones e invariantes', () => {
  it('franja inválida (inicio >= fin)', async () => {
    await expect(ejecutar(crearDeps(), bodyBase({ startTime: '11:00', endTime: '10:00' }))).rejects.toBeInstanceOf(RangoHorarioInvalidoError);
  });

  it('invitado sin nombre', async () => {
    await expect(ejecutar(crearDeps(), bodyBase({ guestName: undefined }))).rejects.toBeInstanceOf(DatosInvitadoRequeridosError);
  });

  it('a domicilio sin dirección', async () => {
    await expect(ejecutar(crearDeps(), bodyBase({ atHome: true }))).rejects.toBeInstanceOf(DireccionDomicilioRequeridaError);
  });

  it('fecha en el pasado', async () => {
    await expect(ejecutar(crearDeps(), bodyBase({ date: '2026-06-01' }))).rejects.toBeInstanceOf(CitaEnPasadoError);
  });

  it('demasiadas citas activas (cliente)', async () => {
    const usuario: UsuarioAutenticado = { id: 'u1', email: 'u@test.com', nombre: 'Usuario' };
    await expect(ejecutar(crearDeps({ activasCliente: 10 }), bodyBase(), usuario)).rejects.toBeInstanceOf(DemasiadasCitasActivasError);
  });
});

describe('CrearCita — reglas con estilista y precio', () => {
  it('estilista no realiza el servicio', async () => {
    await expect(ejecutar(crearDeps({ realiza: false }), bodyBase({ staffId: 'staff-1' }))).rejects.toBeInstanceOf(EstilistaNoRealizaServicioError);
  });

  it('horario en conflicto', async () => {
    await expect(ejecutar(crearDeps({ conflicto: true }), bodyBase({ staffId: 'staff-1' }))).rejects.toBeInstanceOf(HorarioNoDisponibleError);
  });

  it('servicio inactivo', async () => {
    await expect(ejecutar(crearDeps({ servicio: { id: 'svc', name: 'X', isActive: false, pricePen: 100 } }), bodyBase())).rejects.toBeInstanceOf(ServicioNoDisponibleError);
  });

  it('precio bloqueado', async () => {
    await expect(ejecutar(crearDeps({ precio: { blocked: true, blockedReasons: ['No disponible'] } }), bodyBase())).rejects.toBeInstanceOf(CitaBloqueadaError);
  });

  it('requiere anticipación (lead days)', async () => {
    // ahora = 2026-06-10; cita 2026-06-15 (5 días); requiere 10 => falla.
    await expect(ejecutar(crearDeps({ precio: { requiresLeadDays: 10 } }), bodyBase())).rejects.toBeInstanceOf(AnticipacionRequeridaError);
  });
});
