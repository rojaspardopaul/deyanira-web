// Caso de uso: el admin crea un recibo desde cero (cualquier cobro). Calcula el
// total a partir de los items y, opcionalmente, registra un primer pago (adelanto).

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { ReciboRepositorio, ReciboPersistido } from '../domain/ports/ReciboRepositorio';
import { SolicitudReciboInvalidaError } from '../domain/errors';

export interface ItemComando {
  readonly description: string;
  readonly qty: number;
  readonly unitPen: number;
  readonly amountPen: number;
}

export interface PagoComando {
  readonly amountPen: number;
  readonly method: string;
  readonly paidAt?: string | null;
  readonly note?: string | null;
}

export interface CrearReciboComando {
  readonly customerName: string;
  readonly customerEmail?: string | null;
  readonly customerPhone?: string | null;
  readonly customerId?: string | null;
  readonly title?: string | null;
  readonly items: ItemComando[];
  readonly bookingGroupId?: string | null;
  readonly packageId?: string | null;
  readonly notes?: string | null;
  readonly createdBy?: string | null;
  readonly payments?: PagoComando[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export class CrearRecibo {
  constructor(private readonly repo: ReciboRepositorio) {}

  async ejecutar(ctx: ContextoTenant, c: CrearReciboComando): Promise<ReciboPersistido> {
    const name = (c.customerName || '').trim();
    if (!name) throw new SolicitudReciboInvalidaError('El nombre del cliente es obligatorio');

    const items = (c.items || [])
      .map((it) => ({
        description: (it.description || '').trim(),
        qty: it.qty && it.qty > 0 ? Math.floor(it.qty) : 1,
        unitPen: round2(Number(it.unitPen) || 0),
        amountPen: round2(Number(it.amountPen) || 0),
      }))
      .filter((it) => it.description);

    if (items.length === 0) throw new SolicitudReciboInvalidaError('Agrega al menos un concepto');

    const total = round2(items.reduce((s, it) => s + it.amountPen, 0));
    if (total <= 0) throw new SolicitudReciboInvalidaError('El total debe ser mayor a 0');

    // Pagos a registrar al crear (adelanto/abonos). Se validan antes de crear.
    const pays = (c.payments || [])
      .map((p) => ({ ...p, amountPen: round2(Number(p.amountPen) || 0) }))
      .filter((p) => p.amountPen > 0);
    const sumPays = round2(pays.reduce((s, p) => s + p.amountPen, 0));
    if (sumPays > total) throw new SolicitudReciboInvalidaError('Los pagos superan el total del recibo');

    const recibo = await this.repo.crear(ctx, {
      customerId: c.customerId ?? null,
      customerName: name,
      customerEmail: c.customerEmail?.trim() || null,
      customerPhone: c.customerPhone?.trim() || null,
      title: c.title?.trim() || null,
      items,
      totalPen: total,
      bookingGroupId: c.bookingGroupId ?? null,
      packageId: c.packageId ?? null,
      notes: c.notes?.trim() || null,
      createdBy: c.createdBy ?? null,
    });

    let actual = recibo;
    for (const p of pays) {
      actual = await this.repo.agregarPago(ctx, recibo.id, {
        amountPen: p.amountPen,
        method: p.method || 'cash',
        paidAt: p.paidAt ?? null,
        note: p.note ?? null,
        registeredBy: c.createdBy ?? null,
      });
    }
    return actual;
  }
}
