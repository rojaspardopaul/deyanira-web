// Adaptador de persistencia con Prisma. ÚNICO lugar del módulo donde se importa
// Prisma. Implementa AdelantoRepositorio. La liquidación reutiliza la lógica
// compartida lib/payments/bookingDeposit.markDepositPaid (idempotente).

import type { PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { AdelantoNoEncontradoError, AdelantoYaPagadoError } from '../domain/errors';
import type {
  AdelantoRepositorio,
  AdelantoPersistido,
  GrupoReserva,
  LiquidacionAdelanto,
  FiltrosAdelantos,
  OpcionesPago,
} from '../domain/ports/AdelantoRepositorio';

/* eslint-disable @typescript-eslint/no-var-requires */
const { markDepositPaid } = require('../../../lib/payments/bookingDeposit') as {
  markDepositPaid: (db: unknown, id: string, opts: OpcionesPago) => Promise<LiquidacionAdelanto & { package: unknown }>;
};

const ESTADOS_VALIDOS = ['pending', 'awaiting_verification', 'paid', 'rejected', 'expired'];

export class PrismaAdelantoRepository implements AdelantoRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  // NOTA tenant: hoy ctx no filtra (single-tenant). Mañana se añade el scoping aquí.

  async buscar(_ctx: ContextoTenant, id: string): Promise<AdelantoPersistido | null> {
    const row = await this.prisma.bookingPayment.findUnique({ where: { id } });
    return row ? (row as unknown as AdelantoPersistido) : null;
  }

  async cargarGrupo(_ctx: ContextoTenant, bookingGroupId: string): Promise<GrupoReserva> {
    const appointments = await this.prisma.appointment.findMany({
      where: { bookingGroupId },
      include: { service: true, staff: true, package: { include: { eventType: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    const conPkg = appointments.find((a) => (a as { package?: unknown }).package);
    const paquete = ((conPkg as { package?: GrupoReserva['paquete'] } | undefined)?.package) ?? null;
    return { appointments: appointments as unknown as GrupoReserva['appointments'], paquete };
  }

  async listarAdmin(_ctx: ContextoTenant, filtros: FiltrosAdelantos): Promise<AdelantoPersistido[]> {
    const where: Record<string, unknown> = {};
    if (filtros.status && ESTADOS_VALIDOS.includes(filtros.status)) where.status = filtros.status;
    if (filtros.bookingGroupId) where.bookingGroupId = filtros.bookingGroupId;
    const rows = await this.prisma.bookingPayment.findMany({
      where,
      include: { package: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: filtros.bookingGroupId ? 1 : 200,
    });
    return rows as unknown as AdelantoPersistido[];
  }

  async guardarComprobante(
    _ctx: ContextoTenant,
    id: string,
    datos: { url: string; method: string },
  ): Promise<AdelantoPersistido> {
    const row = await this.prisma.bookingPayment.update({
      where: { id },
      data: { proofImageUrl: datos.url, method: datos.method, status: 'awaiting_verification' },
    });
    return row as unknown as AdelantoPersistido;
  }

  async rechazar(
    _ctx: ContextoTenant,
    id: string,
    datos: { notes: string | null; verifiedBy: string | null },
  ): Promise<AdelantoPersistido> {
    const row = await this.prisma.bookingPayment.update({
      where: { id },
      data: { status: 'rejected', notes: datos.notes, verifiedBy: datos.verifiedBy, verifiedAt: new Date() },
    });
    return row as unknown as AdelantoPersistido;
  }

  async registrarPago(_ctx: ContextoTenant, id: string, opciones: OpcionesPago): Promise<LiquidacionAdelanto> {
    try {
      return await markDepositPaid(this.prisma, id, opciones);
    } catch (err) {
      const e = err as { status?: number; message?: string };
      if (e.status === 404) throw new AdelantoNoEncontradoError(e.message || 'Pago no encontrado');
      if (e.status === 409) throw new AdelantoYaPagadoError(e.message || 'Este adelanto ya fue registrado');
      throw err;
    }
  }
}
