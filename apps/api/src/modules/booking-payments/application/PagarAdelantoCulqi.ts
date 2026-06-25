// Caso de uso: cobrar el adelanto con tarjeta (Culqi). El importe SIEMPRE sale de
// la BD (no manipulable). Idempotente vía idempotencyKey = id del pago.
// Equivale a POST /api/booking-payments/:id/culqi.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import {
  AdelantoNoEncontradoError,
  AdelantoYaPagadoError,
  EmailNoCoincideError,
  MontoMinimoError,
  PagoRechazadoError,
} from '../domain/errors';
import type { AdelantoRepositorio } from '../domain/ports/AdelantoRepositorio';
import type { PasarelaPagos, ErrorPasarela } from '../domain/ports/PasarelaPagos';
import type { NotificadorAdelantos } from '../domain/ports/NotificadorAdelantos';

export interface PagarAdelantoCulqiComando {
  readonly id: string;
  readonly culqiToken: string;
  readonly email: string;
}

export interface ResultadoPagoCulqi {
  readonly success: true;
  readonly receiptNumber?: string | null;
  readonly alreadyPaid?: boolean;
}

export class PagarAdelantoCulqi {
  constructor(
    private readonly repo: AdelantoRepositorio,
    private readonly pasarela: PasarelaPagos,
    private readonly notificador: NotificadorAdelantos,
  ) {}

  async ejecutar(ctx: ContextoTenant, c: PagarAdelantoCulqiComando): Promise<ResultadoPagoCulqi> {
    const pago = await this.repo.buscar(ctx, c.id);
    if (!pago) throw new AdelantoNoEncontradoError('Reserva no encontrada');
    if (pago.status === 'paid') throw new AdelantoYaPagadoError('Este adelanto ya fue pagado');

    const emailReserva = (pago.customerEmail as string | null) || null;
    if (emailReserva && emailReserva.toLowerCase() !== c.email.toLowerCase()) {
      throw new EmailNoCoincideError('El email no coincide con el de la reserva');
    }

    const montoCentimos = Math.round(Number(pago.depositPen) * 100);
    if (montoCentimos < 100) throw new MontoMinimoError('Monto mínimo no alcanzado');

    let cargo: { id: string };
    try {
      cargo = await this.pasarela.crearCargo({
        token: c.culqiToken,
        montoCentimos,
        email: c.email,
        descripcion: `Adelanto reserva ${c.id.slice(-8).toUpperCase()} — Deyanira Makeup Beauty`,
        idempotencyKey: c.id,
      });
    } catch (err) {
      const e = err as ErrorPasarela;
      // Ya cobrado con la misma idempotency key → liquidar si falta.
      if (e.culqiCode === 'already_exists') {
        try {
          const settled = await this.repo.registrarPago(ctx, c.id, { method: 'culqi' });
          this.notificarPagado(settled, c.email);
          return { success: true, alreadyPaid: true, receiptNumber: settled.payment.receiptNumber };
        } catch (e2) {
          if (e2 instanceof AdelantoYaPagadoError) return { success: true, alreadyPaid: true };
          throw e2;
        }
      }
      throw new PagoRechazadoError(e.message || 'Error procesando el pago');
    }

    const settled = await this.repo.registrarPago(ctx, c.id, { method: 'culqi', culqiChargeId: cargo.id });
    this.notificarPagado(settled, c.email);
    return { success: true, receiptNumber: settled.payment.receiptNumber };
  }

  private notificarPagado(
    settled: Awaited<ReturnType<AdelantoRepositorio['registrarPago']>>,
    fallbackEmail: string,
  ): void {
    const email = settled.payment.customerEmail || fallbackEmail;
    if (!email) return;
    this.notificador.confirmacionYRecibo(settled.payment, settled.appointments, settled.packageInfo, {
      email,
      nombre: settled.payment.customerName || 'Cliente',
    });
  }
}
