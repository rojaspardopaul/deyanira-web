// Adaptador de persistencia con Prisma. ÚNICO lugar del módulo donde se importa
// Prisma. Implementa el puerto CitaRepositorio. Réplica fiel de las queries legacy.

import type { PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { Cita } from '../domain/Cita';
import type { FranjaHoraria } from '../domain/FranjaHoraria';
import type { EstadoCita } from '../domain/EstadoCita';
import { aEstadoBd } from '../domain/mapeoEstado';
import type {
  CitaRepositorio,
  CitaPersistida,
  DatosCliente,
  DatosReservaLote,
  ResultadoLote,
  FiltrosCitasAdmin,
  PaginadoCitas,
  DatosCitaAdmin,
  CambiosCitaAdmin,
  ConflictoCita,
  DatosPaqueteAdmin,
  ResultadoPaqueteAdmin,
  PagoPersistido,
} from '../domain/ports/CitaRepositorio';
import { toPersistence } from './mappers';

/* eslint-disable @typescript-eslint/no-var-requires */
// assertNoConflicts vive en lib/booking/scheduleBatch.js (compartido con el admin).
const { assertNoConflicts } = require('../../../lib/booking/scheduleBatch') as {
  assertNoConflicts: (tx: unknown, scheduled: unknown[]) => Promise<void>;
};
// generateReceiptNumber: número de recibo secuencial por día (lib de adelantos).
const { generateReceiptNumber } = require('../../../lib/payments/bookingDeposit') as {
  generateReceiptNumber: (db: unknown) => Promise<string>;
};
// Paginación admin (mismo contrato que el resto del panel): array sin ?page, envelope con ?page.
const { parsePagination, paginate } = require('../../../lib/pagination') as {
  parsePagination: (q: unknown) => { hasPage: boolean; page: number; pageSize: number; skip: number; take: number };
  paginate: (model: unknown, args: unknown, pg: unknown) => Promise<PaginadoCitas>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// service+staff incluidos: la fila resultante alimenta el DTO -> contrato HTTP legacy.
const INCLUDE = { service: true, staff: true } as const;
// Includes admin: el listado y la edición arrastran customer/package.eventType para la UI/correos.
// `service.category` alimenta el color/ícono por categoría del calendario admin.
const INCLUDE_LISTA_ADMIN = {
  service: { include: { category: { select: { id: true, name: true, slug: true, icon: true } } } },
  staff: true,
  customer: true,
  package: {
    select: {
      id: true,
      name: true,
      pricePen: true,
      groupLabel: true,
      trialAddonServiceId: true,
      eventType: { select: { id: true, name: true, slug: true, accentColor: true, icon: true } },
    },
  },
} as const;
const INCLUDE_EDIT_ADMIN = { service: true, staff: true, package: { include: { eventType: true } } } as const;
const INCLUDE_GRUPO_ADMIN = {
  service: true,
  staff: true,
  customer: true,
  package: { include: { eventType: true, items: { select: { serviceId: true } } } },
} as const;
const ESTADOS_ACTIVOS_BD = ['pending', 'confirmed'];
const ESTADOS_CONFLICTO_ADMIN = ['pending', 'confirmed', 'in_progress'];

export class PrismaCitaRepository implements CitaRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  // NOTA tenant: hoy ctx no filtra (single-tenant). Mañana se añade
  // `where: { tenantId: ctx.tenantId }` aquí, en un único punto por método.

  async estilistaRealizaServicio(_ctx: ContextoTenant, staffId: string, servicioId: string): Promise<boolean> {
    const link = await this.prisma.staffService.findFirst({ where: { staffId, serviceId: servicioId } });
    return !!link;
  }

  async hayConflicto(
    _ctx: ContextoTenant,
    params: { staffId: string; fecha: string; franja: FranjaHoraria },
  ): Promise<boolean> {
    const conflicto = await this.prisma.appointment.findFirst({
      where: {
        staffId: params.staffId,
        date: new Date(`${params.fecha}T12:00:00Z`),
        status: { in: ESTADOS_ACTIVOS_BD },
        startTime: { lt: params.franja.fin },
        endTime: { gt: params.franja.inicio },
      },
    });
    return !!conflicto;
  }

  async contarActivasDeCliente(_ctx: ContextoTenant, customerId: string): Promise<number> {
    return this.prisma.appointment.count({ where: { customerId, status: { in: ESTADOS_ACTIVOS_BD } } });
  }

  async contarActivasRecientesDeInvitado(_ctx: ContextoTenant, telefono: string): Promise<number> {
    return this.prisma.appointment.count({
      where: {
        guestPhone: telefono,
        status: { in: ESTADOS_ACTIVOS_BD },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
  }

  async asegurarCliente(_ctx: ContextoTenant, datos: DatosCliente): Promise<void> {
    await this.prisma.customer.upsert({
      where: { id: datos.id },
      update: { email: datos.email || undefined },
      create: { id: datos.id, name: datos.nombre, email: datos.email },
    });
  }

  async guardar(_ctx: ContextoTenant, cita: Cita): Promise<CitaPersistida> {
    const row = await this.prisma.appointment.create({ data: toPersistence(cita), include: INCLUDE });
    return row as unknown as CitaPersistida;
  }

  async crearLote(_ctx: ContextoTenant, d: DatosReservaLote): Promise<ResultadoLote> {
    return this.prisma.$transaction(async (tx) => {
      // Verifica conflictos por estilista (lógica compartida con el admin).
      await assertNoConflicts(tx, d.lineas);

      const created: CitaPersistida[] = [];
      for (let i = 0; i < d.lineas.length; i++) {
        const ln = d.lineas[i];
        const esPrimeraDelDiaPrincipal = ln.date === d.mainDate && i === 0;
        const row = await tx.appointment.create({
          data: {
            onDutyStaff: ln.onDutyStaff,
            staffId: ln.staffId,
            serviceId: ln.serviceId,
            packageId: d.packageId,
            bookingGroupId: d.bookingGroupId,
            date: new Date(`${ln.date}T12:00:00Z`),
            startTime: ln.startTime,
            endTime: ln.endTime,
            status: 'pending',
            totalPen: ln.totalPen,
            notes: i === 0 ? d.notas : null,
            customerId: d.solicitante.customerId,
            guestName: d.solicitante.guestName,
            guestPhone: d.solicitante.guestPhone,
            guestEmail: d.solicitante.guestEmail,
            atHome: d.domicilio.aDomicilio,
            atHomeAddress: d.domicilio.aDomicilio ? d.domicilio.direccion : null,
            atHomeDistrict: d.domicilio.aDomicilio ? d.domicilio.distrito : null,
            atHomeExtraPen: esPrimeraDelDiaPrincipal && d.domicilio.aDomicilio ? d.recargoMonto : null,
          },
          include: INCLUDE,
        });
        created.push(row as unknown as CitaPersistida);
      }

      let payment: { id: string } | null = null;
      if (d.deposito?.requerido && d.packageId) {
        const created0 = created[0] as unknown as { guestName?: string | null };
        const pago = await tx.bookingPayment.create({
          data: {
            bookingGroupId: d.bookingGroupId,
            packageId: d.packageId,
            customerId: d.solicitante.customerId,
            customerName: d.solicitante.guestName || created0.guestName || 'Cliente',
            customerEmail: d.solicitante.guestEmail,
            customerPhone: d.solicitante.guestPhone,
            totalPen: d.deposito.grandTotal,
            depositPercent: d.deposito.percent,
            depositPen: d.deposito.pen,
            paidPen: 0,
            balancePen: d.deposito.grandTotal,
            status: 'pending',
          },
        });
        payment = { id: pago.id };
      }

      return { created, payment };
    });
  }

  async listarDeCliente(
    _ctx: ContextoTenant,
    params: { customerId: string; email: string | null },
  ): Promise<CitaPersistida[]> {
    const or: Array<{ customerId: string } | { guestEmail: string }> = [{ customerId: params.customerId }];
    if (params.email) or.push({ guestEmail: params.email });
    const rows = await this.prisma.appointment.findMany({
      where: { OR: or },
      include: INCLUDE,
      orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
    });
    return rows as unknown as CitaPersistida[];
  }

  async buscarPorId(_ctx: ContextoTenant, id: string): Promise<CitaPersistida | null> {
    const row = await this.prisma.appointment.findUnique({ where: { id }, include: INCLUDE });
    return row ? (row as unknown as CitaPersistida) : null;
  }

  async cambiarEstado(_ctx: ContextoTenant, id: string, estado: EstadoCita): Promise<CitaPersistida> {
    const row = await this.prisma.appointment.update({
      where: { id },
      data: { status: aEstadoBd(estado) },
      include: INCLUDE,
    });
    return row as unknown as CitaPersistida;
  }

  // ── Gestión admin ───────────────────────────────────────────

  async listarAdmin(
    _ctx: ContextoTenant,
    filtros: FiltrosCitasAdmin,
    query: Record<string, unknown>,
  ): Promise<CitaPersistida[] | PaginadoCitas> {
    const where: Record<string, unknown> = {};
    if (filtros.fecha) {
      where.date = new Date(`${filtros.fecha}T12:00:00Z`);
    } else if (filtros.fechaDesde || filtros.fechaHasta) {
      const rango: { gte?: Date; lte?: Date } = {};
      if (filtros.fechaDesde) rango.gte = new Date(`${filtros.fechaDesde}T00:00:00Z`);
      if (filtros.fechaHasta) rango.lte = new Date(`${filtros.fechaHasta}T23:59:59Z`);
      where.date = rango;
    }
    if (filtros.soloStaffId != null) where.staffId = filtros.soloStaffId;
    else if (filtros.staffId) where.staffId = filtros.staffId;
    if (filtros.estadoBd) where.status = filtros.estadoBd;

    const orderBy = [{ date: 'asc' as const }, { startTime: 'asc' as const }];
    const pg = parsePagination(query);
    if (pg.hasPage) {
      return paginate(this.prisma.appointment, { where, include: INCLUDE_LISTA_ADMIN, orderBy }, pg);
    }
    const rows = await this.prisma.appointment.findMany({
      where,
      include: INCLUDE_LISTA_ADMIN,
      orderBy,
      take: 2000,
    });
    return rows as unknown as CitaPersistida[];
  }

  async buscarServicioBasico(_ctx: ContextoTenant, serviceId: string): Promise<{ pricePen: unknown } | null> {
    const s = await this.prisma.service.findUnique({ where: { id: serviceId }, select: { pricePen: true } });
    return s ? { pricePen: s.pricePen } : null;
  }

  async crearAdmin(_ctx: ContextoTenant, d: DatosCitaAdmin): Promise<CitaPersistida> {
    const row = await this.prisma.appointment.create({
      data: {
        staffId: d.staffId,
        onDutyStaff: !d.staffId,
        serviceId: d.serviceId,
        date: new Date(`${d.fecha}T12:00:00Z`),
        startTime: d.franja.inicio,
        endTime: d.franja.fin,
        status: d.estadoBd,
        totalPen: d.totalPen as never,
        notes: d.notas,
        guestName: d.guestName,
        guestPhone: d.guestPhone,
        guestEmail: d.guestEmail,
      },
      include: INCLUDE,
    });
    return row as unknown as CitaPersistida;
  }

  async buscarConflictoAdmin(
    _ctx: ContextoTenant,
    params: {
      staffId: string;
      fecha: string;
      franja: FranjaHoraria;
      exceptId?: string | null;
      incluirEnProceso?: boolean;
    },
  ): Promise<ConflictoCita | null> {
    const where: Record<string, unknown> = {
      staffId: params.staffId,
      date: new Date(`${params.fecha}T12:00:00Z`),
      status: { in: params.incluirEnProceso ? ESTADOS_CONFLICTO_ADMIN : ESTADOS_ACTIVOS_BD },
      startTime: { lt: params.franja.fin },
      endTime: { gt: params.franja.inicio },
    };
    if (params.exceptId) where.id = { not: params.exceptId };
    const c = await this.prisma.appointment.findFirst({ where, include: { service: true } });
    if (!c) return null;
    const conflicto = c as unknown as { service: { name: string }; startTime: string; endTime: string };
    return { servicioNombre: conflicto.service.name, inicio: conflicto.startTime, fin: conflicto.endTime };
  }

  async buscarGrupoPaquete(
    _ctx: ContextoTenant,
    params: { packageId: string; fecha: string; customerKey: string },
  ): Promise<CitaPersistida[]> {
    const filtroCliente = UUID_RE.test(params.customerKey)
      ? { customerId: params.customerKey }
      : { guestEmail: params.customerKey };
    const rows = await this.prisma.appointment.findMany({
      where: {
        packageId: params.packageId,
        date: new Date(`${params.fecha}T12:00:00Z`),
        status: { in: ESTADOS_ACTIVOS_BD },
        ...filtroCliente,
      },
      include: INCLUDE_GRUPO_ADMIN,
      orderBy: { startTime: 'asc' },
    });
    return rows as unknown as CitaPersistida[];
  }

  async buscarGrupoPorBookingGroup(
    _ctx: ContextoTenant,
    params: { bookingGroupId: string; fecha: string },
  ): Promise<CitaPersistida[]> {
    const rows = await this.prisma.appointment.findMany({
      where: {
        bookingGroupId: params.bookingGroupId,
        date: new Date(`${params.fecha}T12:00:00Z`),
        status: { in: ESTADOS_ACTIVOS_BD },
      },
      include: INCLUDE_GRUPO_ADMIN,
      orderBy: { startTime: 'asc' },
    });
    return rows as unknown as CitaPersistida[];
  }

  async confirmarPendientesDelGrupo(_ctx: ContextoTenant, ids: string[]): Promise<void> {
    await this.prisma.appointment.updateMany({
      where: { id: { in: ids }, status: 'pending' },
      data: { status: 'confirmed' },
    });
  }

  async cancelarActivasDelGrupo(_ctx: ContextoTenant, ids: string[]): Promise<void> {
    await this.prisma.appointment.updateMany({
      where: { id: { in: ids }, status: { in: ESTADOS_ACTIVOS_BD } },
      data: { status: 'cancelled' },
    });
  }

  async rechazarPagoPendienteDelGrupo(_ctx: ContextoTenant, bookingGroupId: string): Promise<void> {
    await this.prisma.bookingPayment.updateMany({
      where: { bookingGroupId, status: { in: ['pending', 'awaiting_verification'] } },
      data: { status: 'rejected' },
    });
  }

  async recargarCitas(_ctx: ContextoTenant, ids: string[]): Promise<CitaPersistida[]> {
    const rows = await this.prisma.appointment.findMany({
      where: { id: { in: ids } },
      include: INCLUDE,
      orderBy: { startTime: 'asc' },
    });
    return rows as unknown as CitaPersistida[];
  }

  async actualizarAdmin(_ctx: ContextoTenant, id: string, cambios: CambiosCitaAdmin): Promise<CitaPersistida> {
    const data: Record<string, unknown> = {};
    if (cambios.estado) data.status = aEstadoBd(cambios.estado);
    if (cambios.fecha) data.date = new Date(`${cambios.fecha}T12:00:00Z`);
    if (cambios.startTime) data.startTime = cambios.startTime;
    if (cambios.endTime) data.endTime = cambios.endTime;
    if (cambios.staff) {
      data.staffId = cambios.staff.staffId;
      data.onDutyStaff = !cambios.staff.staffId;
    }
    if (cambios.notas) data.notes = cambios.notas.valor;

    const row = await this.prisma.appointment.update({
      where: { id },
      data,
      include: INCLUDE_EDIT_ADMIN,
    });
    return row as unknown as CitaPersistida;
  }

  async crearPaqueteAdmin(_ctx: ContextoTenant, d: DatosPaqueteAdmin): Promise<ResultadoPaqueteAdmin> {
    return this.prisma.$transaction(async (tx) => {
      // Verifica conflictos por estilista (lógica compartida con el lote).
      await assertNoConflicts(tx, d.lineas);

      const created: CitaPersistida[] = [];
      for (let i = 0; i < d.lineas.length; i++) {
        const ln = d.lineas[i];
        const row = await tx.appointment.create({
          data: {
            onDutyStaff: ln.onDutyStaff,
            staffId: ln.staffId,
            serviceId: ln.serviceId,
            packageId: d.packageId,
            bookingGroupId: d.bookingGroupId,
            date: new Date(`${ln.date}T12:00:00Z`),
            startTime: ln.startTime,
            endTime: ln.endTime,
            status: 'confirmed', // alta admin = confirmada
            totalPen: ln.totalPen,
            notes: i === 0 ? d.notas : null,
            customerId: d.solicitante.customerId,
            guestName: d.solicitante.guestName,
            guestPhone: d.solicitante.guestPhone,
            guestEmail: d.solicitante.guestEmail,
          },
          include: INCLUDE,
        });
        created.push(row as unknown as CitaPersistida);
      }

      let payment: PagoPersistido | null = null;
      if (d.deposito) {
        const receiptNumber = await generateReceiptNumber(tx);
        const pago = await tx.bookingPayment.create({
          data: {
            bookingGroupId: d.bookingGroupId,
            packageId: d.packageId,
            customerId: d.solicitante.customerId,
            customerName: d.solicitante.guestName,
            customerEmail: d.solicitante.guestEmail,
            customerPhone: d.solicitante.guestPhone,
            totalPen: d.deposito.total,
            depositPercent: d.deposito.depositPercent,
            depositPen: d.deposito.depositPen,
            paidPen: d.deposito.paidPen,
            balancePen: d.deposito.balancePen,
            method: d.deposito.method,
            status: 'paid',
            proofImageUrl: d.deposito.proofImageUrl,
            receiptNumber,
            verifiedBy: d.deposito.verifiedBy,
            verifiedAt: new Date(),
          },
        });
        payment = pago as unknown as PagoPersistido;
      }

      return { created, payment };
    });
  }
}
