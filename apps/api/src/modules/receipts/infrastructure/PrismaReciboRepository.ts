// Adaptador de persistencia con Prisma. ÚNICO lugar del módulo donde se importa
// Prisma. Implementa ReciboRepositorio. La aritmética de dinero usa Dinero
// (céntimos enteros) para evitar errores de coma flotante.

import type { PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { Dinero } from '../../../shared/domain/Dinero';
import {
  ReciboNoEncontradoError,
  ReciboAnuladoError,
  MontoInvalidoError,
  PagoExcedeSaldoError,
} from '../domain/errors';
import type {
  ReciboRepositorio,
  ReciboPersistido,
  CrearReciboDatos,
  NuevoPagoDatos,
  FiltrosRecibos,
  BookingResumen,
  CriterioBookings,
} from '../domain/ports/ReciboRepositorio';

const ESTADOS_VALIDOS = ['pending', 'partial', 'paid', 'cancelled'];

// Solo estas reservas tienen sentido para emitir un recibo (las pendientes,
// canceladas o "no asistió" no se facturan).
const ESTADOS_RECIBO = new Set(['confirmed', 'in_progress', 'completed']);

// YYYY-MM-DD en zona America/Lima.
function limaYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return typeof v === 'string' ? v : new Date().toISOString();
}

function estadoPor(total: number, pagado: number): string {
  if (pagado <= 0) return 'pending';
  if (pagado >= total) return 'paid';
  return 'partial';
}

// Estado representativo de un grupo de citas (para mostrar el estado de la reserva).
function estadoGrupo(estados: string[]): string {
  if (estados.length === 0) return 'pending';
  if (estados.every((s) => s === 'cancelled')) return 'cancelled';
  if (estados.every((s) => s === 'completed' || s === 'cancelled')) return 'completed';
  if (estados.some((s) => s === 'pending')) return 'pending';
  if (estados.some((s) => s === 'in_progress')) return 'in_progress';
  if (estados.some((s) => s === 'confirmed')) return 'confirmed';
  if (estados.some((s) => s === 'no_show')) return 'no_show';
  return estados[0];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(row: any): ReciboPersistido {
  return {
    id: row.id,
    receiptNumber: row.receiptNumber,
    customerId: row.customerId ?? null,
    customerName: row.customerName,
    customerEmail: row.customerEmail ?? null,
    customerPhone: row.customerPhone ?? null,
    title: row.title ?? null,
    totalPen: num(row.totalPen),
    paidPen: num(row.paidPen),
    balancePen: num(row.balancePen),
    status: row.status,
    bookingGroupId: row.bookingGroupId ?? null,
    packageId: row.packageId ?? null,
    notes: row.notes ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    items: (row.items ?? []).map((it: any) => ({
      description: it.description,
      qty: Number(it.qty),
      unitPen: num(it.unitPen),
      amountPen: num(it.amountPen),
    })),
    payments: (row.payments ?? []).map((p: any) => ({
      id: p.id,
      amountPen: num(p.amountPen),
      method: p.method,
      paidAt: iso(p.paidAt),
      note: p.note ?? null,
      proofImageUrl: p.proofImageUrl ?? null,
      registeredBy: p.registeredBy ?? null,
      createdAt: iso(p.createdAt),
    })),
  };
}

const INCLUDE = {
  items: { orderBy: { sortOrder: 'asc' as const } },
  payments: { orderBy: { paidAt: 'asc' as const } },
};

export class PrismaReciboRepository implements ReciboRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  // NOTA tenant: hoy ctx no filtra (single-tenant). Mañana se añade el scoping aquí.

  // REC-YYYYMMDD-### secuencial por día (receiptNumber es @unique → reintenta).
  private async siguienteNumero(db: PrismaClient): Promise<string> {
    const ymd = limaYmd().replace(/-/g, '');
    const prefix = `REC-${ymd}-`;
    const count = await db.receipt.count({ where: { receiptNumber: { startsWith: prefix } } });
    return `${prefix}${String(count + 1).padStart(3, '0')}`;
  }

  async crear(_ctx: ContextoTenant, datos: CrearReciboDatos): Promise<ReciboPersistido> {
    const total = Dinero.de(datos.totalPen);
    if (total.esNegativo()) throw new MontoInvalidoError('El total no puede ser negativo');

    // Reintenta ante colisión del número (carrera improbable).
    for (let intento = 0; intento < 5; intento++) {
      const receiptNumber = await this.siguienteNumero(this.prisma);
      try {
        const created = await this.prisma.receipt.create({
          data: {
            receiptNumber,
            customerId: datos.customerId ?? null,
            customerName: datos.customerName,
            customerEmail: datos.customerEmail ?? null,
            customerPhone: datos.customerPhone ?? null,
            title: datos.title ?? null,
            totalPen: total.monto,
            paidPen: 0,
            balancePen: total.monto,
            status: 'pending',
            bookingGroupId: datos.bookingGroupId ?? null,
            packageId: datos.packageId ?? null,
            notes: datos.notes ?? null,
            createdBy: datos.createdBy ?? null,
            items: {
              create: datos.items.map((it, i) => ({
                description: it.description,
                qty: it.qty,
                unitPen: it.unitPen,
                amountPen: it.amountPen,
                sortOrder: i,
              })),
            },
          },
          include: INCLUDE,
        });
        return mapRow(created);
      } catch (err) {
        // P2002 = unique constraint (receiptNumber) → reintentar
        if ((err as { code?: string }).code === 'P2002' && intento < 4) continue;
        throw err;
      }
    }
    throw new Error('No se pudo generar el número de recibo');
  }

  async buscar(_ctx: ContextoTenant, id: string): Promise<ReciboPersistido | null> {
    const row = await this.prisma.receipt.findUnique({ where: { id }, include: INCLUDE });
    return row ? mapRow(row) : null;
  }

  async listar(_ctx: ContextoTenant, filtros: FiltrosRecibos): Promise<ReciboPersistido[]> {
    const where: Record<string, unknown> = {};
    if (filtros.status && ESTADOS_VALIDOS.includes(filtros.status)) where.status = filtros.status;
    if (filtros.q) {
      const q = filtros.q.trim();
      where.OR = [
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q } },
        { receiptNumber: { contains: q, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.receipt.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(mapRow);
  }

  async agregarPago(_ctx: ContextoTenant, id: string, pago: NuevoPagoDatos): Promise<ReciboPersistido> {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.receipt.findUnique({ where: { id }, include: { payments: true } });
      if (!r) throw new ReciboNoEncontradoError('Recibo no encontrado');
      if (r.status === 'cancelled') throw new ReciboAnuladoError('El recibo está anulado');

      const monto = Dinero.de(pago.amountPen);
      if (monto.esCero() || monto.esNegativo()) throw new MontoInvalidoError('El monto del pago debe ser mayor a 0');

      const total = Dinero.de(num(r.totalPen));
      const pagadoActual = r.payments.reduce(
        (acc, p) => acc.sumar(Dinero.de(num(p.amountPen))),
        Dinero.cero(),
      );
      const saldo = total.restar(pagadoActual);
      if (monto.centimos > saldo.centimos) {
        throw new PagoExcedeSaldoError(`El monto excede el saldo pendiente (${saldo.monto.toFixed(2)})`);
      }

      await tx.receiptPayment.create({
        data: {
          receiptId: id,
          amountPen: pago.amountPen,
          method: pago.method,
          paidAt: pago.paidAt ? new Date(pago.paidAt) : new Date(),
          note: pago.note ?? null,
          proofImageUrl: pago.proofImageUrl ?? null,
          registeredBy: pago.registeredBy ?? null,
        },
      });

      const pagado = pagadoActual.sumar(monto);
      const balance = total.restar(pagado);
      await tx.receipt.update({
        where: { id },
        data: {
          paidPen: pagado.monto,
          balancePen: Math.max(0, balance.monto),
          status: estadoPor(total.monto, pagado.monto),
        },
      });

      const full = await tx.receipt.findUnique({ where: { id }, include: INCLUDE });
      return mapRow(full);
    });
  }

  async anular(_ctx: ContextoTenant, id: string): Promise<ReciboPersistido> {
    const existing = await this.prisma.receipt.findUnique({ where: { id } });
    if (!existing) throw new ReciboNoEncontradoError('Recibo no encontrado');
    const row = await this.prisma.receipt.update({
      where: { id },
      data: { status: 'cancelled' },
      include: INCLUDE,
    });
    return mapRow(row);
  }

  async bookingsCliente(_ctx: ContextoTenant, criterio: CriterioBookings): Promise<BookingResumen[]> {
    const phone = (criterio.phone || '').trim();
    const phoneDigits = phone.replace(/\D/g, '');
    const or: Record<string, unknown>[] = [];
    if (criterio.customerId) or.push({ customerId: criterio.customerId });
    if (phone) or.push({ guestPhone: phone });
    if (phoneDigits && phoneDigits !== phone) or.push({ guestPhone: { contains: phoneDigits } });
    if (or.length === 0) return [];

    const appts = await this.prisma.appointment.findMany({
      where: { OR: or, bookingGroupId: { not: null } },
      include: {
        service: { select: { name: true } },
        package: { select: { name: true, eventType: { select: { name: true } } } },
      },
      orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
      take: 300,
    });
    if (appts.length === 0) return [];

    // Agrupar por bookingGroupId
    const groups = new Map<string, typeof appts>();
    for (const a of appts) {
      const k = a.bookingGroupId as string;
      if (!groups.has(k)) groups.set(k, []);
      (groups.get(k) as typeof appts).push(a);
    }

    const ids = [...groups.keys()];
    const pays = await this.prisma.bookingPayment.findMany({ where: { bookingGroupId: { in: ids } } });
    const payByGroup = new Map(pays.map((p) => [p.bookingGroupId, p]));

    // Pagos ya registrados vía recibos (no anulados) ligados a estas reservas.
    const receipts = await this.prisma.receipt.findMany({
      where: { bookingGroupId: { in: ids }, status: { not: 'cancelled' } },
      include: { payments: true },
    });
    const recByGroup = new Map<string, { paid: number; method: string | null; paidAt: string | null }>();
    for (const r of receipts) {
      if (!r.bookingGroupId) continue;
      const cur = recByGroup.get(r.bookingGroupId) || { paid: 0, method: null as string | null, paidAt: null as string | null };
      for (const p of r.payments) {
        cur.paid += num(p.amountPen);
        const pa = iso(p.paidAt);
        if (!cur.paidAt || pa > cur.paidAt) { cur.paidAt = pa; cur.method = p.method; }
      }
      recByGroup.set(r.bookingGroupId, cur);
    }

    const out: BookingResumen[] = [];
    for (const [bookingGroupId, list] of groups) {
      const pkg = list.find((a) => a.package)?.package || null;
      const total = list.reduce((s, a) => s + num(a.totalPen), 0);
      const date = list.reduce((min: string, a) => {
        const d = (a.date instanceof Date ? a.date.toISOString() : String(a.date)).slice(0, 10);
        return !min || d < min ? d : min;
      }, '');
      const label = pkg
        ? (pkg.eventType?.name ? `${pkg.eventType.name} · ${pkg.name}` : pkg.name)
        : [...new Set(list.map((a) => a.service?.name).filter(Boolean))].join(', ') || 'Reserva';
      const items = pkg
        ? [{ description: label, amountPen: Math.round(total * 100) / 100 }]
        : list.filter((a) => num(a.totalPen) > 0).map((a) => ({ description: a.service?.name || 'Servicio', amountPen: num(a.totalPen) }));
      const status = estadoGrupo(list.map((a) => a.status));
      if (!ESTADOS_RECIBO.has(status)) continue; // omitir pendientes/canceladas/no-show

      const totalR = Math.round(total * 100) / 100;
      const pay = payByGroup.get(bookingGroupId) || null;
      const rec = recByGroup.get(bookingGroupId) || null;
      const bpPaid = pay ? num(pay.paidPen) : 0;
      const recPaid = rec ? Math.round(rec.paid * 100) / 100 : 0;
      const paid = Math.max(bpPaid, recPaid); // evita doble conteo recibo↔adelanto online
      const hasPay = !!pay || recPaid > 0;

      // Fuente del método/fecha del pago existente: el que más aportó.
      const fromRec = recPaid >= bpPaid && rec;
      const depMethod = fromRec ? (rec as { method: string | null }).method : (pay?.method ?? null);
      const depPaidAt = fromRec ? (rec as { paidAt: string | null }).paidAt : (pay ? iso(pay.verifiedAt || pay.createdAt) : null);

      out.push({
        bookingGroupId,
        packageId: list.find((a) => a.packageId)?.packageId || null,
        isPackage: !!pkg,
        date,
        label,
        total: totalR,
        status,
        items: items.length ? items : [{ description: label, amountPen: totalR }],
        deposit: hasPay
          ? {
              totalPen: totalR,
              depositPen: pay ? num(pay.depositPen) : Math.round(totalR * 0.5 * 100) / 100,
              paidPen: paid,
              balancePen: Math.max(0, Math.round((totalR - paid) * 100) / 100),
              status: paid >= totalR ? 'paid' : paid > 0 ? 'partial' : (pay?.status ?? 'pending'),
              receiptNumber: pay?.receiptNumber ?? null,
              method: depMethod,
              paidAt: depPaidAt,
            }
          : null,
      });
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  }
}
