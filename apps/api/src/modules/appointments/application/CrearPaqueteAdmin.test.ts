import { describe, it, expect, vi } from 'vitest';
import { CrearPaqueteAdmin, type CrearPaqueteAdminComando } from './CrearPaqueteAdmin';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { CitaRepositorio, DatosPaqueteAdmin } from '../domain/ports/CitaRepositorio';
import type { CatalogoReservas, PaqueteReserva } from '../domain/ports/CatalogoReservas';
import type { Scheduler } from '../domain/ports/Scheduler';
import type { Reloj } from '../domain/ports/Reloj';
import type { Notificador } from '../domain/ports/Notificador';
import { SolicitudCitaInvalidaError, CitaEnPasadoError, PaqueteNoEncontradoError, ServicioNoEncontradoError } from '../domain/errors';

const ctx: ContextoTenant = { tenantId: 'test' };
const PKG = '11111111-1111-1111-1111-111111111111';
const SVC = '22222222-2222-2222-2222-222222222222';

const reloj: Reloj = { ahoraLima: () => ({ fecha: '2026-06-10', hora: '08:00', ms: Date.parse('2026-06-10T08:00:00') }) };

function crearDeps(o: { paquete?: PaqueteReserva | null } = {}) {
  const pkg: PaqueteReserva = o.paquete === undefined
    ? { id: PKG, isActive: true, pricePen: 1000, requiresDeposit: true, depositPercent: 50, name: 'Novia', groupLabel: null, eventType: null, trialAddonServiceId: null, items: [{ serviceId: SVC }] }
    : (o.paquete as PaqueteReserva);
  const catalogo = {
    cargarPaquete: vi.fn(async () => o.paquete === undefined ? pkg : o.paquete),
    cargarServiciosParaLote: vi.fn(async () => [
      { id: SVC, name: 'Maquillaje', isActive: true, pricePen: 300, duration: 60, parallelGroup: null, daysBeforeMain: null },
    ]),
  } as unknown as CatalogoReservas;

  const crearPaqueteAdmin = vi.fn(async (_c: ContextoTenant, datos: DatosPaqueteAdmin) => ({
    created: datos.lineas.map((_l, i) => ({ id: `apt-${i}`, date: '2026-06-15', startTime: '10:00' })),
    payment: datos.deposito ? { id: 'pay-1', receiptNumber: 'DMB-20260615-001' } : null,
  }));
  const citas = { crearPaqueteAdmin } as unknown as CitaRepositorio;

  const scheduler = {
    programar: ({ items, serviceById, date, startTime }: Parameters<Scheduler['programar']>[0]) =>
      items.map((it, i) => ({
        serviceId: it.serviceId,
        staffId: it.staffId ?? null,
        onDutyStaff: !it.staffId,
        date: it.date ?? date,
        startTime: i === 0 ? startTime : '12:00',
        endTime: '11:00',
        addonPricePen: 0,
        service: serviceById.get(it.serviceId)!,
      })),
    diasEntre: () => 0,
  } as unknown as Scheduler;

  const notificador = { reciboAdelanto: vi.fn(), reservaConfirmada: vi.fn() } as unknown as Notificador;
  const uc = new CrearPaqueteAdmin(catalogo, citas, scheduler, reloj, notificador);
  return { uc, citas, crearPaqueteAdmin, notificador };
}

const body = (over: Partial<CrearPaqueteAdminComando> = {}): CrearPaqueteAdminComando => ({
  packageId: PKG,
  items: [{ serviceId: SVC }],
  date: '2026-06-15',
  startTime: '10:00',
  guestName: 'Ana',
  guestEmail: 'ana@t.com',
  ...over,
});

describe('CrearPaqueteAdmin', () => {
  it('valida packageId, items, fecha, hora y nombre', async () => {
    const { uc } = crearDeps();
    await expect(uc.ejecutar(ctx, body({ packageId: 'x' }))).rejects.toBeInstanceOf(SolicitudCitaInvalidaError);
    await expect(uc.ejecutar(ctx, body({ items: [] }))).rejects.toBeInstanceOf(SolicitudCitaInvalidaError);
    await expect(uc.ejecutar(ctx, body({ guestName: '  ' }))).rejects.toBeInstanceOf(SolicitudCitaInvalidaError);
  });

  it('rechaza fechas en el pasado', async () => {
    const { uc } = crearDeps();
    await expect(uc.ejecutar(ctx, body({ date: '2026-06-09' }))).rejects.toBeInstanceOf(CitaEnPasadoError);
  });

  it('404 si el paquete no existe', async () => {
    const { uc } = crearDeps({ paquete: null });
    await expect(uc.ejecutar(ctx, body())).rejects.toBeInstanceOf(PaqueteNoEncontradoError);
  });

  it('404 si un item referencia un servicio inexistente', async () => {
    const { uc } = crearDeps();
    await expect(uc.ejecutar(ctx, body({ items: [{ serviceId: '33333333-3333-3333-3333-333333333333' }] })))
      .rejects.toBeInstanceOf(ServicioNoEncontradoError);
  });

  it('alta sin adelanto: citas confirmadas, sin pago, con correo de confirmación', async () => {
    const { uc, crearPaqueteAdmin, notificador } = crearDeps();
    const res = await uc.ejecutar(ctx, body());
    const datos = crearPaqueteAdmin.mock.calls[0][1] as DatosPaqueteAdmin;
    expect(datos.deposito).toBeNull();
    expect(datos.lineas[0].totalPen).toBe(1000); // precio del paquete a la 1ª cita
    expect(res.bookingPaymentId).toBeNull();
    expect(res.receiptNumber).toBeNull();
    // Sin adelanto pero con email → confirmación de reserva (no recibo de adelanto).
    expect(notificador.reciboAdelanto).not.toHaveBeenCalled();
    expect(notificador.reservaConfirmada).toHaveBeenCalledTimes(1);
  });

  it('alta con adelanto: calcula depósito (50% por defecto) + recibo + correo', async () => {
    const { uc, crearPaqueteAdmin, notificador } = crearDeps();
    const res = await uc.ejecutar(ctx, body({ recordDeposit: true, method: 'yape', adminId: 'admin-1' }));
    const datos = crearPaqueteAdmin.mock.calls[0][1] as DatosPaqueteAdmin;
    expect(datos.deposito).toMatchObject({ depositPercent: 50, depositPen: 500, paidPen: 500, balancePen: 500, method: 'yape', verifiedBy: 'admin-1' });
    expect(res.bookingPaymentId).toBe('pay-1');
    expect(res.receiptNumber).toBe('DMB-20260615-001');
    expect(notificador.reciboAdelanto).toHaveBeenCalledTimes(1);
  });
});
