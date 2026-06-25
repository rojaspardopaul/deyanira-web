// Presentación HTTP admin del módulo de recibos. Se monta DENTRO del router admin
// (hereda isAdmin/CSRF/audit). Handlers delgados → caso de uso → responder.

import express, { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { crearModuloRecibos } from '../index';
import { CrearReciboSchema, AgregarPagoSchema } from './receipts.schemas';
import { traducirError } from '../../../shared/http/traducirError';

/* eslint-disable @typescript-eslint/no-var-requires */
const { validate, UUID_RE } = require('../../../lib/validate') as {
  validate: (schemas: unknown) => RequestHandler;
  UUID_RE: RegExp;
};
const { BadRequest } = require('../../../lib/errors') as { BadRequest: (msg: string) => Error };

interface AdminReq extends Request {
  admin: { id?: string };
  tenant: { tenantId: string };
}

export function crearRouterAdminRecibos(): express.Router {
  const { crearRecibo, listarRecibos, obtenerRecibo, agregarPago, anularRecibo, generarPDF, enviarPorCorreo, listarBookingsCliente } =
    crearModuloRecibos();
  const router = express.Router();

  // GET /api/admin/receipts/customer-bookings?customerId=&phone= — reservas del
  // cliente + su adelanto, para crear un recibo vinculado.
  router.get('/receipts/customer-bookings', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      const { customerId, phone } = r.query as Record<string, string | undefined>;
      const cid = customerId && UUID_RE.test(customerId) ? customerId : null;
      res.json(await listarBookingsCliente.ejecutar(r.tenant, { customerId: cid, phone: phone ?? null }));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // GET /api/admin/receipts — listado (filtros status / q)
  router.get('/receipts', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      const { status, q } = r.query as Record<string, string | undefined>;
      res.json(await listarRecibos.ejecutar(r.tenant, { status: status ?? null, q: q ?? null }));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // POST /api/admin/receipts — crear recibo (+ pago inicial opcional)
  router.post('/receipts', validate({ body: CrearReciboSchema }), (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      const recibo = await crearRecibo.ejecutar(r.tenant, { ...r.body, createdBy: r.admin?.id ?? null });
      res.status(201).json(recibo);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // GET /api/admin/receipts/:id — detalle
  router.get('/receipts/:id', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      res.json(await obtenerRecibo.ejecutar(r.tenant, r.params.id));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // POST /api/admin/receipts/:id/payments — registrar un abono
  router.post('/receipts/:id/payments', validate({ body: AgregarPagoSchema }), (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      const recibo = await agregarPago.ejecutar(r.tenant, {
        id: r.params.id,
        amountPen: Number(r.body.amountPen),
        method: r.body.method,
        paidAt: r.body.paidAt ?? null,
        note: r.body.note ?? null,
        registeredBy: r.admin?.id ?? null,
      });
      res.json(recibo);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // POST /api/admin/receipts/:id/cancel — anular recibo
  router.post('/receipts/:id/cancel', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      res.json(await anularRecibo.ejecutar(r.tenant, r.params.id));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // GET /api/admin/receipts/:id/pdf — PDF del recibo (descarga/inline)
  router.get('/receipts/:id/pdf', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      const { recibo, pdf } = await generarPDF.ejecutar(r.tenant, r.params.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Recibo-${recibo.receiptNumber}.pdf"`);
      res.send(pdf);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // POST /api/admin/receipts/:id/send-email — enviar recibo con PDF adjunto
  router.post('/receipts/:id/send-email', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      res.json(await enviarPorCorreo.ejecutar(r.tenant, r.params.id));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  return router;
}
