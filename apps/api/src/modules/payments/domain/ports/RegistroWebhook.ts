// Puerto del registro idempotente de eventos de webhook (tabla CulqiWebhookEvent).

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';

export interface EventoWebhook {
  readonly eventId: string;
  readonly type: string;
  readonly chargeId: string | null;
  readonly orderId: string | null;
  readonly payload: unknown;
}

export interface RegistroWebhook {
  /** ¿Ya se registró este evento? (idempotencia). */
  yaRegistrado(ctx: ContextoTenant, eventId: string): Promise<boolean>;

  /** Persiste el evento crudo. Devuelve el id interno. */
  registrar(ctx: ContextoTenant, evento: EventoWebhook): Promise<{ id: string }>;

  /** Marca el evento como procesado. */
  marcarProcesado(ctx: ContextoTenant, id: string): Promise<void>;
}
