// Webhook de Culqi. Necesita el RAW body para verificar la firma HMAC, por eso usa
// express.raw() local (y la ruta está en RAW_BODY_PREFIXES de index.js). Réplica
// fiel del legacy: verificación de firma -> parseo -> caso de uso idempotente.

import express, { type Request, type Response } from 'express';
import { crearModuloPagos } from '../index';
import { verificarFirmaCulqi } from '../infrastructure/verificarFirmaCulqi';
import { TENANT_DEFECTO } from '../../../shared/context/ContextoTenant';

/* eslint-disable @typescript-eslint/no-var-requires */
const env = require('../../../lib/env') as { CULQI_WEBHOOK_SECRET?: string };
const logger = require('../../../lib/logger') as {
  warn: (m: string, meta?: unknown) => void;
  error: (m: string, meta?: unknown) => void;
};

interface EventoCulqi {
  id?: string;
  event_id?: string;
  type?: string;
  data?: { object?: { id?: string; metadata?: { order_id?: string }; idempotency_key?: string } };
}

export function crearRouterWebhookPagos(): express.Router {
  const { procesarWebhookCulqi } = crearModuloPagos();
  const router = express.Router();

  router.post('/culqi', express.raw({ type: 'application/json', limit: '64kb' }), async (req: Request, res: Response) => {
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      const sigHeader = req.headers['culqi-signature'] || req.headers['x-culqi-signature'];

      const v = verificarFirmaCulqi(env.CULQI_WEBHOOK_SECRET, sigHeader, raw);
      if (!v.valido) {
        if (v.status === 401) logger.warn('culqi_webhook_bad_sig', { ip: req.ip });
        return res.status(v.status || 400).json({ error: v.motivo });
      }

      let event: EventoCulqi;
      try {
        event = JSON.parse(raw.toString('utf8'));
      } catch {
        return res.status(400).json({ error: 'Payload inválido' });
      }

      const eventId = event?.id || event?.event_id;
      if (!eventId) return res.status(400).json({ error: 'event id ausente' });

      const type = String(event?.type || 'unknown').slice(0, 80);
      const data = event?.data?.object || event?.data || {};
      const chargeId = (data as { id?: string })?.id ? String((data as { id?: string }).id) : null;
      const orderIdRaw = (data as { metadata?: { order_id?: string }; idempotency_key?: string })?.metadata?.order_id
        || (data as { idempotency_key?: string })?.idempotency_key
        || null;

      try {
        const result = await procesarWebhookCulqi.ejecutar(TENANT_DEFECTO, {
          eventId: String(eventId),
          type,
          chargeId,
          orderId: orderIdRaw ? String(orderIdRaw) : null,
          payload: event,
        });
        return res.status(200).json(result);
      } catch (err) {
        // El evento ya está persistido; devolvemos 500 para que Culqi reintente.
        logger.error('culqi_webhook_process_failed', { eventId, msg: (err as Error).message });
        return res.status(500).json({ error: 'Procesamiento falló, reintentar' });
      }
    } catch (err) {
      logger.error('culqi_webhook_unhandled', { msg: (err as Error).message });
      res.status(500).json({ error: 'Error interno' });
    }
  });

  return router;
}
