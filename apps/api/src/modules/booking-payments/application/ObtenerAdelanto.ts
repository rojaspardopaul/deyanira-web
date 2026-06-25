// Caso de uso: datos públicos de un adelanto (reserva + montos + instrucciones de
// pago del salón). Equivale a GET /api/booking-payments/:id.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { AdelantoNoEncontradoError } from '../domain/errors';
import type { AdelantoRepositorio } from '../domain/ports/AdelantoRepositorio';
import type { ConfiguracionPago } from '../domain/ports/ConfiguracionPago';

export class ObtenerAdelanto {
  constructor(
    private readonly repo: AdelantoRepositorio,
    private readonly config: ConfiguracionPago,
  ) {}

  async ejecutar(ctx: ContextoTenant, id: string): Promise<Record<string, unknown>> {
    const pago = await this.repo.buscar(ctx, id);
    if (!pago) throw new AdelantoNoEncontradoError('Reserva no encontrada');

    const { appointments, paquete } = await this.repo.cargarGrupo(ctx, String(pago.bookingGroupId));
    const salon = await this.config.datosPago(ctx);

    return {
      id: pago.id,
      status: pago.status,
      method: pago.method,
      totalPen: Number(pago.totalPen),
      depositPercent: pago.depositPercent,
      depositPen: Number(pago.depositPen),
      paidPen: Number(pago.paidPen),
      balancePen: Number(pago.balancePen),
      receiptNumber: pago.receiptNumber,
      customerName: pago.customerName,
      customerEmail: pago.customerEmail,
      customerPhone: pago.customerPhone,
      package: paquete ? { id: paquete.id, name: paquete.name, eventType: paquete.eventType } : null,
      appointments: appointments.map((a) => ({
        id: a.id,
        serviceName: (a.service as { name?: string } | null)?.name || null,
        staffName: a.onDutyStaff || !a.staff ? null : (a.staff as { name?: string } | null)?.name || null,
        onDutyStaff: Boolean(a.onDutyStaff || !a.staff),
        date: a.date,
        startTime: a.startTime,
        endTime: a.endTime,
        totalPen: Number(a.totalPen || 0),
      })),
      salon: salon || {},
      culqiPublicKey: this.config.culqiPublicKey(),
    };
  }
}
