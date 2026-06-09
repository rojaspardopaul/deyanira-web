// Caso de uso: el admin registra manualmente un adelanto sobre un grupo existente
// (efectivo/yape/etc). Liquida el adelanto + envía recibo.
// Equivale a POST /api/admin/booking-payments/:id/record.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { AdelantoRepositorio, AdelantoPersistido } from '../domain/ports/AdelantoRepositorio';
import type { NotificadorAdelantos } from '../domain/ports/NotificadorAdelantos';

export interface RegistrarAdelantoManualComando {
  readonly id: string;
  readonly method?: string;
  readonly paidPen?: number | null;
  readonly verifiedBy: string | null;
}

export class RegistrarAdelantoManual {
  constructor(
    private readonly repo: AdelantoRepositorio,
    private readonly notificador: NotificadorAdelantos,
  ) {}

  async ejecutar(ctx: ContextoTenant, c: RegistrarAdelantoManualComando): Promise<AdelantoPersistido> {
    const settled = await this.repo.registrarPago(ctx, c.id, {
      method: c.method || 'cash',
      paidPen: c.paidPen ?? null,
      verifiedBy: c.verifiedBy,
    });
    const email = settled.payment.customerEmail;
    if (email) {
      this.notificador.recibo(settled.payment, settled.appointments, settled.packageInfo, {
        email,
        nombre: settled.payment.customerName || 'Cliente',
      });
    }
    return settled.payment;
  }
}
