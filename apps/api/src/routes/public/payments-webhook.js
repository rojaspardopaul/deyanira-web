// Webhook Culqi.
// Culqi envía POST con JSON. Firma HMAC-SHA256 viene en `Culqi-Signature`
// (versionado: t=<unix>,v1=<sha256hex>). Implementamos:
//   1. Validación de timestamp (≤ 5 min, anti-replay)
//   2. Validación HMAC en tiempo constante
//   3. Persistencia idempotente por event id
//   4. Actualización de la orden si aplica
//
// La ruta NO está bajo el body-parser estándar porque necesitamos el raw body
// para verificar la firma. Por eso usa express.raw() locally.
//
// Configurar en Culqi Dashboard:
//   URL: https://api.deyanira.pe/api/payments/webhook/culqi
//   Secret: <CULQI_WEBHOOK_SECRET>

const { Router } = require('express');
const crypto = require('crypto');
const express = require('express');

const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');
const env = require('../../lib/env');
const { sendOrderConfirmation } = require('../../lib/notifications/email');

const router = Router();
const MAX_SIGNATURE_AGE_S = 5 * 60;

function parseSignature(header) {
  // Formato esperado: "t=1714003200,v1=abcd1234..."
  if (typeof header !== 'string') return null;
  const parts = header.split(',').map(s => s.trim());
  const out = {};
  for (const p of parts) {
    const [k, v] = p.split('=');
    if (k && v) out[k] = v;
  }
  if (!out.t || !out.v1) return null;
  return { t: parseInt(out.t, 10), v1: out.v1 };
}

function constantTimeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

// Necesitamos el raw body sin parsear para verificar la firma.
router.post(
  '/culqi',
  express.raw({ type: 'application/json', limit: '64kb' }),
  async (req, res) => {
    try {
      const secret = env.CULQI_WEBHOOK_SECRET || process.env.CULQI_WEBHOOK_SECRET;
      if (!secret) {
        logger.error('culqi_webhook_no_secret');
        return res.status(503).json({ error: 'Webhook deshabilitado' });
      }

      const sig = parseSignature(req.headers['culqi-signature'] || req.headers['x-culqi-signature']);
      if (!sig) return res.status(400).json({ error: 'Firma ausente o mal formada' });

      const nowS = Math.floor(Date.now() / 1000);
      if (Math.abs(nowS - sig.t) > MAX_SIGNATURE_AGE_S) {
        logger.warn('culqi_webhook_stale', { ts: sig.t, now: nowS });
        return res.status(400).json({ error: 'Timestamp fuera de ventana' });
      }

      const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      // El payload firmado es "<t>.<rawBody>"
      const payload = `${sig.t}.${raw.toString('utf8')}`;
      const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      if (!constantTimeEq(expected, sig.v1)) {
        logger.warn('culqi_webhook_bad_sig', { ip: req.ip });
        return res.status(401).json({ error: 'Firma inválida' });
      }

      // Parsear JSON ya validado
      let event;
      try { event = JSON.parse(raw.toString('utf8')); }
      catch { return res.status(400).json({ error: 'Payload inválido' }); }

      const eventId = event?.id || event?.event_id;
      if (!eventId) return res.status(400).json({ error: 'event id ausente' });

      // Idempotencia: si ya existe, devolver 200 (Culqi reintenta si no 2xx)
      const existing = await prisma.culqiWebhookEvent.findUnique({ where: { eventId } });
      if (existing) return res.status(200).json({ ok: true, duplicated: true });

      // Persistir el evento crudo
      const type = String(event?.type || 'unknown').slice(0, 80);
      const data = event?.data?.object || event?.data || {};
      const chargeId = data?.id || null;
      // Recuperamos orderId desde idempotency key o metadata (el endpoint /culqi lo usa)
      const orderId = data?.metadata?.order_id || data?.idempotency_key || null;

      const stored = await prisma.culqiWebhookEvent.create({
        data: {
          eventId: String(eventId),
          type,
          chargeId: chargeId ? String(chargeId) : null,
          orderId: orderId ? String(orderId).slice(0, 36) : null,
          payload: event,
        },
      });

      // Procesar charge.created.success / charge.failed
      try {
        if (type === 'charge.created.success' || type === 'charge.succeeded') {
          if (orderId) {
            const result = await prisma.order.updateMany({
              where: { id: String(orderId), paymentStatus: { not: 'paid' } },
              data: {
                paymentStatus: 'paid',
                paymentMethod: 'culqi',
                paymentRef: chargeId || null,
                status: 'processing',
              },
            });
            if (result.count > 0) {
              const order = await prisma.order.findUnique({ where: { id: String(orderId) }, include: { items: true } });
              if (order?.shipEmail) {
                sendOrderConfirmation({ order, email: order.shipEmail }).catch(err => logger.error('email_failed', { msg: err.message }));
              }
            }
          }
        }

        await prisma.culqiWebhookEvent.update({
          where: { id: stored.id },
          data: { processed: true, processedAt: new Date() },
        });
      } catch (err) {
        logger.error('culqi_webhook_process_failed', { eventId, msg: err.message });
        // Retornamos 500 para que Culqi reintente — el evento ya está persistido
        return res.status(500).json({ error: 'Procesamiento falló, reintentar' });
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      logger.error('culqi_webhook_unhandled', { msg: err.message });
      res.status(500).json({ error: 'Error interno' });
    }
  }
);

module.exports = router;
