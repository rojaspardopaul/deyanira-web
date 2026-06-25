// Caso de uso: registrar un abono sobre un recibo existente. La validación de
// saldo y el recálculo de totales/estado ocurren en el repositorio (transacción).

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { ReciboRepositorio, ReciboPersistido } from '../domain/ports/ReciboRepositorio';

export interface AgregarPagoComando {
  readonly id: string;
  readonly amountPen: number;
  readonly method: string;
  readonly paidAt?: string | null;
  readonly note?: string | null;
  readonly registeredBy?: string | null;
}

export class AgregarPagoRecibo {
  constructor(private readonly repo: ReciboRepositorio) {}

  ejecutar(ctx: ContextoTenant, c: AgregarPagoComando): Promise<ReciboPersistido> {
    return this.repo.agregarPago(ctx, c.id, {
      amountPen: Math.round(Number(c.amountPen) * 100) / 100,
      method: c.method || 'cash',
      paidAt: c.paidAt ?? null,
      note: c.note?.trim() || null,
      registeredBy: c.registeredBy ?? null,
    });
  }
}
