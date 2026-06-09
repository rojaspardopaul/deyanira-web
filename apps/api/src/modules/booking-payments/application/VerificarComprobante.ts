// Caso de uso: el admin verifica (aprueba) o rechaza un comprobante subido.
// Aprobar liquida el adelanto (confirma las citas) + envía confirmación y recibo.
// Equivale a POST /api/admin/booking-payments/:id/verify.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { AdelantoNoEncontradoError } from '../domain/errors';
import type { AdelantoRepositorio, AdelantoPersistido } from '../domain/ports/AdelantoRepositorio';
import type { NotificadorAdelantos } from '../domain/ports/NotificadorAdelantos';

export interface VerificarComprobanteComando {
  readonly id: string;
  readonly approved: boolean;
  readonly notes?: string | null;
  readonly verifiedBy: string | null;
}

export class VerificarComprobante {
  constructor(
    private readonly repo: AdelantoRepositorio,
    private readonly notificador: NotificadorAdelantos,
  ) {}

  async ejecutar(ctx: ContextoTenant, c: VerificarComprobanteComando): Promise<AdelantoPersistido> {
    const pago = await this.repo.buscar(ctx, c.id);
    if (!pago) throw new AdelantoNoEncontradoError('Pago no encontrado');

    if (!c.approved) {
      return this.repo.rechazar(ctx, c.id, {
        notes: c.notes ? String(c.notes).slice(0, 500) : (pago.notes as string | null) ?? null,
        verifiedBy: c.verifiedBy,
      });
    }

    const settled = await this.repo.registrarPago(ctx, c.id, {
      method: pago.method as string | undefined,
      verifiedBy: c.verifiedBy,
    });
    const email = settled.payment.customerEmail;
    if (email) {
      this.notificador.confirmacionYRecibo(settled.payment, settled.appointments, settled.packageInfo, {
        email,
        nombre: settled.payment.customerName || 'Cliente',
      });
    }
    return settled.payment;
  }
}
