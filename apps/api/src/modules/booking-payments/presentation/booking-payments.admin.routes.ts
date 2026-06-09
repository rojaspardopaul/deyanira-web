// Presentación HTTP admin del módulo de adelantos. Se monta DENTRO del router admin
// (hereda isAdmin/CSRF/audit). Handlers delgados → caso de uso → responder.

import express, { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { crearModuloAdelantos } from '../index';
import { traducirError } from '../../../shared/http/traducirError';

/* eslint-disable @typescript-eslint/no-var-requires */
const { UUID_RE } = require('../../../lib/validate') as { UUID_RE: RegExp };
const { BadRequest } = require('../../../lib/errors') as { BadRequest: (msg: string) => Error };

interface AdminReq extends Request {
  admin: { id?: string };
  tenant: { tenantId: string };
}

export function crearRouterAdminAdelantos(): express.Router {
  const { listarAdelantosAdmin, verificarComprobante, registrarAdelantoManual } = crearModuloAdelantos();
  const router = express.Router();

  // GET /api/admin/booking-payments — listado (filtros status / bookingGroupId)
  router.get('/booking-payments', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      const { status, bookingGroupId } = r.query as Record<string, string | undefined>;
      const filtros = {
        status: status ?? null,
        bookingGroupId: bookingGroupId && UUID_RE.test(bookingGroupId) ? bookingGroupId : null,
      };
      res.json(await listarAdelantosAdmin.ejecutar(r.tenant, filtros));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // POST /api/admin/booking-payments/:id/verify — aprobar/rechazar comprobante
  router.post('/booking-payments/:id/verify', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      const pago = await verificarComprobante.ejecutar(r.tenant, {
        id: r.params.id,
        approved: Boolean(r.body.approved),
        notes: typeof r.body.notes === 'string' ? r.body.notes : null,
        verifiedBy: r.admin?.id ?? null,
      });
      res.json(pago);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // POST /api/admin/booking-payments/:id/record — registrar adelanto manual
  router.post('/booking-payments/:id/record', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      const pago = await registrarAdelantoManual.ejecutar(r.tenant, {
        id: r.params.id,
        method: typeof r.body.method === 'string' ? r.body.method : undefined,
        paidPen: r.body.paidPen != null ? Number(r.body.paidPen) : null,
        verifiedBy: r.admin?.id ?? null,
      });
      res.json(pago);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  return router;
}
