// Presentación HTTP de la GESTIÓN ADMIN de citas (módulo). Handlers DELGADOS:
// normalizar entrada -> construir comando -> invocar caso de uso -> responder.
// Los errores de dominio se traducen a HttpError en un punto (traducirError).
//
// Se monta DENTRO del router admin (hereda isAdmin/CSRF/audit/cache/invalidación)
// y SOLO si CITAS_ADMIN_MODULO_NUEVO=true; intercepta GET/POST /appointments,
// POST /appointments/confirm-group y PATCH /appointments/:id. El alta de paquetes
// con adelanto (POST /appointments/package) NO se define aquí: cae al legacy.

import express, { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { crearModuloCitas } from '../index';
import type { FiltrosCitasAdmin } from '../domain/ports/CitaRepositorio';
import { traducirError } from '../../../shared/http/traducirError';

/* eslint-disable @typescript-eslint/no-var-requires */
const { Forbidden } = require('../../../lib/errors') as { Forbidden: (msg?: string) => Error };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS_BD = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];

interface AdminReq extends Request {
  admin: { id?: string; role?: string; staffId?: string | null };
  tenant: { tenantId: string };
}

function texto(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/** Router de gestión admin de citas. Pensado para montarse con `router.use(...)`
 *  dentro del router admin (sin prefijo: define rutas `/appointments...`). */
export function crearRouterAdminCitas(): express.Router {
  const { listarCitasAdmin, crearCitaAdmin, confirmarGrupoCitas, rechazarGrupoCitas, actualizarCita, crearPaqueteAdmin } = crearModuloCitas();
  const router = express.Router();

  // GET /api/admin/appointments — listado con filtros + scoping por estilista
  router.get('/appointments', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      const date = texto(r.query.date);
      const dateFrom = texto(r.query.dateFrom);
      const dateTo = texto(r.query.dateTo);
      const staffId = texto(r.query.staffId);
      const status = texto(r.query.status);
      const esEstilista = r.admin.role === 'estilista';
      const filtros: FiltrosCitasAdmin = {
        fecha: date && DATE_RE.test(date) ? date : null,
        fechaDesde: dateFrom && DATE_RE.test(dateFrom) ? dateFrom : null,
        fechaHasta: dateTo && DATE_RE.test(dateTo) ? dateTo : null,
        staffId: !esEstilista && staffId && UUID_RE.test(staffId) ? staffId : null,
        estadoBd: status && ESTADOS_BD.includes(status) ? status : null,
        soloStaffId: esEstilista ? r.admin.staffId || 'none' : null,
      };
      const resultado = await listarCitasAdmin.ejecutar(r.tenant, filtros, r.query as Record<string, unknown>);
      res.json(resultado);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // POST /api/admin/appointments — alta manual de una cita individual
  router.post('/appointments', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      const cita = await crearCitaAdmin.ejecutar(r.tenant, r.body);
      res.status(201).json(cita);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // POST /api/admin/appointments/confirm-group — confirmar grupo de paquete (un correo)
  router.post('/appointments/confirm-group', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      const resultado = await confirmarGrupoCitas.ejecutar(r.tenant, r.body);
      res.json(resultado);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // POST /api/admin/appointments/reject-group — rechazar grupo de paquete (un correo)
  router.post('/appointments/reject-group', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      // Autorización: un estilista no puede rechazar (cancelar) citas.
      if (r.admin.role === 'estilista') {
        return next(Forbidden('No tienes permiso para rechazar reservas'));
      }
      const resultado = await rechazarGrupoCitas.ejecutar(r.tenant, r.body);
      res.json(resultado);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // POST /api/admin/appointments/package — alta de paquete (N citas) + adelanto opcional
  router.post('/appointments/package', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      const resultado = await crearPaqueteAdmin.ejecutar(r.tenant, { ...r.body, adminId: r.admin.id ?? null });
      res.status(201).json(resultado);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // PATCH /api/admin/appointments/:id — estado / reprogramar / reasignar / notas
  router.patch('/appointments/:id', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      // Autorización: un estilista no puede cancelar citas.
      if (r.admin.role === 'estilista' && r.body?.status === 'cancelled') {
        return next(Forbidden('No tienes permiso para cancelar citas'));
      }
      const actualizada = await actualizarCita.ejecutar(r.tenant, {
        citaId: r.params.id,
        status: r.body?.status,
        staffId: r.body?.staffId,
        notes: r.body?.notes,
        date: r.body?.date,
        startTime: r.body?.startTime,
        endTime: r.body?.endTime,
      });
      res.json(actualizada);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  return router;
}
