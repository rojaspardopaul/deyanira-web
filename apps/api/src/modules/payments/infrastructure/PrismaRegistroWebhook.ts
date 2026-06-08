// Adaptador del registro idempotente de eventos de webhook (tabla CulqiWebhookEvent).

import type { Prisma, PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { EventoWebhook, RegistroWebhook } from '../domain/ports/RegistroWebhook';

export class PrismaRegistroWebhook implements RegistroWebhook {
  constructor(private readonly prisma: PrismaClient) {}

  async yaRegistrado(_ctx: ContextoTenant, eventId: string): Promise<boolean> {
    const existing = await this.prisma.culqiWebhookEvent.findUnique({ where: { eventId } });
    return !!existing;
  }

  async registrar(_ctx: ContextoTenant, evento: EventoWebhook): Promise<{ id: string }> {
    const stored = await this.prisma.culqiWebhookEvent.create({
      data: {
        eventId: evento.eventId,
        type: evento.type,
        chargeId: evento.chargeId,
        orderId: evento.orderId ? evento.orderId.slice(0, 36) : null,
        payload: evento.payload as Prisma.InputJsonValue,
      },
    });
    return { id: stored.id };
  }

  async marcarProcesado(_ctx: ContextoTenant, id: string): Promise<void> {
    await this.prisma.culqiWebhookEvent.update({
      where: { id },
      data: { processed: true, processedAt: new Date() },
    });
  }
}
