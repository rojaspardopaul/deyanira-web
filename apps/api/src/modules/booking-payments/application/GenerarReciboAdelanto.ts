// Caso de uso: recibo HTML del adelanto (solo cuando está pagado/verificado).
// Equivale a GET /api/booking-payments/:id/receipt.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { AdelantoNoEncontradoError, ReciboNoDisponibleError } from '../domain/errors';
import type { AdelantoRepositorio } from '../domain/ports/AdelantoRepositorio';
import type { ConfiguracionPago } from '../domain/ports/ConfiguracionPago';
import type { ReciboRenderer } from '../domain/ports/ReciboRenderer';

export class GenerarReciboAdelanto {
  constructor(
    private readonly repo: AdelantoRepositorio,
    private readonly config: ConfiguracionPago,
    private readonly renderer: ReciboRenderer,
  ) {}

  async ejecutar(ctx: ContextoTenant, id: string): Promise<string> {
    const pago = await this.repo.buscar(ctx, id);
    if (!pago) throw new AdelantoNoEncontradoError('Reserva no encontrada');
    if (pago.status !== 'paid') {
      throw new ReciboNoDisponibleError('El recibo estará disponible cuando se confirme el adelanto');
    }

    const { appointments, paquete } = await this.repo.cargarGrupo(ctx, String(pago.bookingGroupId));
    const salon = await this.config.salonCompleto(ctx);
    return this.renderer.html({ payment: pago, appointments, package: paquete, salon: salon || {} });
  }
}
