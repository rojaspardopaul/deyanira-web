// Presentación HTTP pública del módulo de adelantos. Handlers delgados: validar →
// caso de uso → responder. Errores de dominio traducidos a HttpError en un punto.

import express, { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { crearModuloAdelantos } from '../index';
import { PagoCulqiSchema, ComprobanteAdelantoSchema } from './booking-payments.schemas';
import { traducirError } from '../../../shared/http/traducirError';

/* eslint-disable @typescript-eslint/no-var-requires */
const { validate, UUID_RE } = require('../../../lib/validate') as {
  validate: (schemas: unknown) => RequestHandler;
  UUID_RE: RegExp;
};
const { BadRequest } = require('../../../lib/errors') as { BadRequest: (msg: string) => Error };

type ReqTenant = Request & { tenant: { tenantId: string } };

export function crearRouterAdelantos(): express.Router {
  const { obtenerAdelanto, pagarAdelantoCulqi, subirComprobante, generarRecibo } = crearModuloAdelantos();
  const router = express.Router();

  // El id es un UUIDv4 → challenge para el flujo guest. Rate-limit estricto en proof.
  const proofLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Intenta en unos minutos.' },
  });

  // GET /api/booking-payments/:id — datos de la reserva + adelanto + instrucciones
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as ReqTenant;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      res.json(await obtenerAdelanto.ejecutar(r.tenant, r.params.id));
    } catch (err) {
      next(traducirError(err));
    }
  });

  // POST /api/booking-payments/:id/culqi — cobro del adelanto con tarjeta
  router.post('/:id/culqi', validate({ body: PagoCulqiSchema }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as ReqTenant;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      const resultado = await pagarAdelantoCulqi.ejecutar(r.tenant, {
        id: r.params.id,
        culqiToken: r.body.culqiToken,
        email: r.body.email,
      });
      res.json(resultado);
    } catch (err) {
      next(traducirError(err));
    }
  });

  // POST /api/booking-payments/:id/proof — subir comprobante Yape/Plin/transfer
  router.post(
    '/:id/proof',
    proofLimiter,
    validate({ body: ComprobanteAdelantoSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const r = req as ReqTenant;
        if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
        const resultado = await subirComprobante.ejecutar(r.tenant, {
          id: r.params.id,
          imagenDataUrl: r.body.image,
          method: r.body.method,
        });
        res.json(resultado);
      } catch (err) {
        next(traducirError(err));
      }
    },
  );

  // GET /api/booking-payments/:id/receipt — recibo HTML (solo si está pagado)
  router.get('/:id/receipt', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as ReqTenant;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      const html = await generarRecibo.ejecutar(r.tenant, r.params.id);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      next(traducirError(err));
    }
  });

  return router;
}
