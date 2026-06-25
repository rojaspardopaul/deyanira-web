// Caso de uso: alta admin de una reserva de PAQUETE (multi-servicio) con adelanto
// opcional ya pagado. Equivale a la ruta legacy POST /api/admin/appointments/package.
// Crea N citas CONFIRMADAS en un grupo y, si se registra adelanto, su BookingPayment
// 'paid' + recibo + correo. Reusa el catálogo y el scheduler del flujo en lote.

import { randomUUID } from 'crypto';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import {
  SolicitudCitaInvalidaError,
  CitaEnPasadoError,
  PaqueteNoEncontradoError,
  ServicioNoEncontradoError,
} from '../domain/errors';
import type { CitaRepositorio, LineaReserva, DepositoAdminInput } from '../domain/ports/CitaRepositorio';
import type { CatalogoReservas } from '../domain/ports/CatalogoReservas';
import type { Scheduler, ItemProgramable } from '../domain/ports/Scheduler';
import type { Reloj } from '../domain/ports/Reloj';
import { infoPaqueteDesde, type Notificador } from '../domain/ports/Notificador';
import type { CitaPersistida } from '../domain/ports/CitaRepositorio';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const DEPOSITO_PORCENTAJE_DEFECTO = 50;

export interface CrearPaqueteAdminComando {
  readonly packageId?: string;
  readonly items?: ItemProgramable[];
  readonly date?: string;
  readonly startTime?: string;
  readonly guestName?: string;
  readonly guestPhone?: string | null;
  readonly guestEmail?: string | null;
  readonly customerId?: string | null;
  readonly notes?: string | null;
  readonly recordDeposit?: boolean;
  readonly depositPaidPen?: number | null;
  readonly method?: string;
  readonly proofImageUrl?: string | null;
  readonly adminId?: string | null; // verifiedBy
}

export interface ResultadoCrearPaqueteAdmin {
  readonly bookingGroupId: string;
  readonly appointments: CitaPersistida[];
  readonly bookingPaymentId: string | null;
  readonly receiptNumber: string | null;
}

export class CrearPaqueteAdmin {
  constructor(
    private readonly catalogo: CatalogoReservas,
    private readonly citas: CitaRepositorio,
    private readonly scheduler: Scheduler,
    private readonly reloj: Reloj,
    private readonly notificador: Notificador,
  ) {}

  async ejecutar(ctx: ContextoTenant, c: CrearPaqueteAdminComando): Promise<ResultadoCrearPaqueteAdmin> {
    if (!c.packageId || !UUID_RE.test(c.packageId)) throw new SolicitudCitaInvalidaError('packageId inválido');
    if (!Array.isArray(c.items) || c.items.length === 0) throw new SolicitudCitaInvalidaError('items requerido');
    if (!c.date || !DATE_RE.test(c.date)) throw new SolicitudCitaInvalidaError('date debe ser YYYY-MM-DD');
    if (!c.startTime || !TIME_RE.test(c.startTime)) throw new SolicitudCitaInvalidaError('startTime inválido');
    if (!c.guestName || !String(c.guestName).trim()) throw new SolicitudCitaInvalidaError('Nombre del cliente requerido');

    if (c.date < this.reloj.ahoraLima().fecha) throw new CitaEnPasadoError('No se pueden crear citas en el pasado');

    const pkg = await this.catalogo.cargarPaquete(ctx, c.packageId);
    if (!pkg) throw new PaqueteNoEncontradoError('Paquete no encontrado');

    // Servicios de los items (se aceptan inactivos por ser de paquete)
    const serviceIds = Array.from(new Set(c.items.map((i) => i.serviceId)));
    const servicios = await this.catalogo.cargarServiciosParaLote(ctx, serviceIds, true);
    const serviceById = new Map(servicios.map((s) => [s.id, s]));
    for (const it of c.items) {
      if (!it.serviceId || !UUID_RE.test(it.serviceId) || !serviceById.has(it.serviceId)) {
        throw new ServicioNoEncontradoError('Servicio inválido en items');
      }
    }

    const scheduled = this.scheduler.programar({ items: c.items, serviceById, date: c.date, startTime: c.startTime });
    const bookingGroupId = randomUUID();
    const pkgPrice = Number(pkg.pricePen);

    // Precio por cita: el servicio adicional (prueba) lleva SU propio precio
    // (addonPricePen); el precio del paquete va a la primera cita NO-addon (sin
    // depender del orden, por si el addon —fecha anterior— quedara primero); el
    // resto de servicios incluidos = 0 (van dentro del precio del paquete).
    let pkgAssigned = false;
    const totals = scheduled.map((s) => {
      if ((s.addonPricePen || 0) > 0) return Number(s.addonPricePen) || 0;
      if (!pkgAssigned) { pkgAssigned = true; return pkgPrice; }
      return 0;
    });
    const grandTotal = totals.reduce((sum, n) => sum + Number(n || 0), 0);

    const lineas: LineaReserva[] = scheduled.map((s, i) => ({
      onDutyStaff: s.onDutyStaff,
      staffId: s.staffId,
      serviceId: s.serviceId,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      totalPen: totals[i],
    }));

    // Adelanto (si el admin lo registra): se guarda como pagado + recibo.
    // El adelanto se calcula sobre el TOTAL de la reserva (paquete + addon).
    let deposito: DepositoAdminInput | null = null;
    if (c.recordDeposit) {
      const depositPercent = pkg.depositPercent ?? DEPOSITO_PORCENTAJE_DEFECTO;
      const depositPen = Math.round(grandTotal * depositPercent) / 100;
      const paidPen = c.depositPaidPen != null ? Number(c.depositPaidPen) : depositPen;
      const balancePen = Math.max(0, Math.round((grandTotal - paidPen) * 100) / 100);
      deposito = {
        total: grandTotal,
        depositPercent,
        depositPen,
        paidPen,
        balancePen,
        method: c.method || 'cash',
        proofImageUrl: c.proofImageUrl || null,
        verifiedBy: c.adminId || null,
      };
    }

    const customerId = c.customerId && UUID_RE.test(c.customerId) ? c.customerId : null;
    const { created, payment } = await this.citas.crearPaqueteAdmin(ctx, {
      lineas,
      packageId: pkg.id,
      bookingGroupId,
      notas: c.notes ? String(c.notes).slice(0, 500) : null,
      solicitante: {
        customerId,
        guestName: String(c.guestName).slice(0, 100),
        guestPhone: c.guestPhone ? String(c.guestPhone).slice(0, 20) : null,
        guestEmail: c.guestEmail ? String(c.guestEmail).slice(0, 100) : null,
      },
      deposito,
    });

    // Aviso al cliente (el alta admin deja la reserva CONFIRMADA), fire-and-forget:
    //   · con adelanto → recibo de adelanto (que ya comunica la confirmación),
    //   · sin adelanto → correo de confirmación de la reserva.
    if (c.guestEmail) {
      const paquete = infoPaqueteDesde(pkg);
      const ordenadas = [...created].sort(
        (a, b) =>
          String(a.date).localeCompare(String(b.date)) ||
          String(a.startTime).localeCompare(String(b.startTime)),
      );
      const contacto = { email: c.guestEmail, nombre: String(c.guestName) };
      if (payment) {
        this.notificador.reciboAdelanto(payment, ordenadas, contacto, paquete);
      } else {
        this.notificador.reservaConfirmada(ordenadas, contacto, paquete, null);
      }
    }

    return {
      bookingGroupId,
      appointments: created,
      bookingPaymentId: payment?.id ?? null,
      receiptNumber: payment?.receiptNumber ?? null,
    };
  }
}
