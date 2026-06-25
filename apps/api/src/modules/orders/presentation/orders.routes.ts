// Presentación HTTP del módulo de pedidos. Handlers delgados; errores de dominio
// traducidos a HttpError en un punto. Durante el cutover delega lo no manejado al
// router legacy (Strangler); se retira tras verificar paridad.

import express, { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { crearModuloPedidos, CrearPedidoComando } from '../index';
import { CrearPedidoSchema, ComprobanteSchema } from './orders.schemas';
import { traducirError } from '../../../shared/http/traducirError';

/* eslint-disable @typescript-eslint/no-var-requires */
const { optionalCustomer, isCustomer } = require('../../../middleware/auth') as {
  optionalCustomer: RequestHandler;
  isCustomer: RequestHandler;
};
const { validate, UUID_RE } = require('../../../lib/validate') as {
  validate: (schemas: unknown) => RequestHandler;
  UUID_RE: RegExp;
};
const { BadRequest } = require('../../../lib/errors') as { BadRequest: (msg: string) => Error };

export function crearRouterPedidos(): express.Router {
  const { crearPedido, listarMisPedidos, obtenerPedido, subirComprobante } = crearModuloPedidos();
  const router = express.Router();

  // POST /api/orders — crear pedido (MIGRADO)
  router.post('/', optionalCustomer, validate({ body: CrearPedidoSchema }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as Request & { user?: { id: string }; tenant: { tenantId: string } };
      const usuario = r.user ? { id: r.user.id } : null;
      const comando = CrearPedidoComando.desdeHttp(r.body, usuario);
      const pedido = await crearPedido.ejecutar(r.tenant, comando);
      res.status(201).json(pedido);
    } catch (err) {
      next(traducirError(err));
    }
  });

  // GET /api/orders/me — pedidos del cliente (MIGRADO)
  router.get('/me', isCustomer, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as Request & { user: { id: string }; tenant: { tenantId: string } };
      const pedidos = await listarMisPedidos.ejecutar(r.tenant, r.user.id);
      res.json(pedidos);
    } catch (err) {
      next(traducirError(err));
    }
  });

  // GET /api/orders/:id — obtener pedido con verificación de propiedad (MIGRADO)
  router.get('/:id', optionalCustomer, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as Request & { user?: { id: string }; tenant: { tenantId: string } };
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('ID inválido'));
      const pedido = await obtenerPedido.ejecutar(r.tenant, {
        id: r.params.id,
        usuario: r.user ? { id: r.user.id } : null,
        guestEmail: typeof r.query.email === 'string' ? r.query.email : null,
      });
      res.json(pedido);
    } catch (err) {
      next(traducirError(err));
    }
  });

  // POST /api/orders/:id/proof — subir comprobante de pago Yape/Plin (NUEVO)
  router.post('/:id/proof', validate({ body: ComprobanteSchema }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as Request & { tenant: { tenantId: string } };
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('ID inválido'));
      const pedido = await subirComprobante.ejecutar(r.tenant, { id: r.params.id, imagenDataUrl: r.body.image });
      res.json({ success: true, status: 'awaiting_verification', order: pedido });
    } catch (err) {
      next(traducirError(err));
    }
  });

  return router;
}
