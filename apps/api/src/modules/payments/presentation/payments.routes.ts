// Presentación HTTP de pagos: tarjeta (Culqi) y confirmación Yape (admin).
// Handlers delgados; errores de dominio traducidos a HttpError en un punto.

import express, { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { crearModuloPagos } from '../index';
import { PagoCulqiSchema, ConfirmarYapeSchema } from './payments.schemas';
import { traducirError } from '../../../shared/http/traducirError';

/* eslint-disable @typescript-eslint/no-var-requires */
const { isAdmin } = require('../../../middleware/auth') as { isAdmin: RequestHandler };
const { validate } = require('../../../lib/validate') as { validate: (schemas: unknown) => RequestHandler };

export function crearRouterPagos(): express.Router {
  const { procesarPagoCulqi, confirmarPagoYape } = crearModuloPagos();
  const router = express.Router();

  // POST /api/payments/culqi — pago con tarjeta
  router.post('/culqi', validate({ body: PagoCulqiSchema }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as Request & { tenant: { tenantId: string } };
      const result = await procesarPagoCulqi.ejecutar(r.tenant, {
        orderId: r.body.orderId,
        culqiToken: r.body.culqiToken,
        email: r.body.email,
      });
      res.json(result);
    } catch (err) {
      next(traducirError(err));
    }
  });

  // POST /api/payments/yape-confirm — confirmación manual (solo admin)
  router.post('/yape-confirm', isAdmin, validate({ body: ConfirmarYapeSchema }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as Request & { tenant: { tenantId: string } };
      const result = await confirmarPagoYape.ejecutar(r.tenant, {
        orderId: r.body.orderId,
        reference: r.body.reference ?? null,
      });
      res.json(result);
    } catch (err) {
      next(traducirError(err));
    }
  });

  return router;
}
