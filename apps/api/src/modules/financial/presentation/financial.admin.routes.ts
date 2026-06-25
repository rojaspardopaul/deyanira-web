// Presentación HTTP admin del Centro Financiero. Se monta DENTRO del router admin
// (hereda isAdmin/CSRF/audit) bajo el prefijo /finanzas. Handlers delgados →
// caso de uso → responder. Errores de dominio traducidos en un punto.

import express, { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { crearModuloFinanciero } from '../index';
import {
  RegistrarMovimientoSchema,
  AnularMovimientoSchema,
  CrearCuentaSchema,
  ActualizarCuentaSchema,
} from './financial.schemas';
import { traducirError } from '../../../shared/http/traducirError';
import {
  TIPOS_MOVIMIENTO,
  FUENTES_MOVIMIENTO,
  direccionDeTipo,
  type Direccion,
  type TipoMovimiento,
  type FuenteMovimiento,
} from '../domain/TipoMovimiento';
import type { FiltrosMovimientos } from '../domain/ports/MovimientoRepositorio';

/* eslint-disable @typescript-eslint/no-var-requires */
const { validate, UUID_RE } = require('../../../lib/validate') as {
  validate: (schemas: unknown) => RequestHandler;
  UUID_RE: RegExp;
};
const { BadRequest } = require('../../../lib/errors') as { BadRequest: (msg: string) => Error };
const { uploadVoucher, deleteVoucher } = require('../../../lib/cloudinary') as {
  uploadVoucher: (file: string, folder?: string) => Promise<{ url: string; publicId: string; resourceType: string; fileType: string }>;
  deleteVoucher: (publicId: string, resourceType?: string) => Promise<unknown>;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface AdminReq extends Request {
  admin: { id?: string; role?: string };
  tenant: { tenantId: string };
}

function txt(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function crearRouterAdminFinanzas(): express.Router {
  const { registrarMovimiento, anularMovimiento, editarMovimiento, listarMovimientos, resumen, cuentas, vouchers, conciliacion, ia } = crearModuloFinanciero();
  const router = express.Router();

  // GET /api/admin/finanzas/resumen?from&to — KPIs del dashboard ejecutivo
  router.get('/finanzas/resumen', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      const from = txt(r.query.from);
      const to = txt(r.query.to);
      if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
        return next(BadRequest('Parámetros from y to requeridos (YYYY-MM-DD)'));
      }
      res.json(await resumen.resumen(r.tenant, from, to));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // GET /api/admin/finanzas/serie?year — serie mensual ingresos/egresos/utilidad
  router.get('/finanzas/serie', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      const year = parseInt(String(r.query.year), 10) || new Date().getFullYear();
      if (year < 2020 || year > 2100) return next(BadRequest('Año inválido'));
      res.json(await resumen.serie(r.tenant, year));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // GET /api/admin/finanzas/movimientos — timeline + tabla con filtros (paginado)
  router.get('/finanzas/movimientos', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      const q = r.query as Record<string, string | undefined>;
      const dir = q.direction === 'in' || q.direction === 'out' ? (q.direction as Direccion) : null;
      const tipo = q.type && TIPOS_MOVIMIENTO.includes(q.type as TipoMovimiento) ? (q.type as TipoMovimiento) : null;
      const source = q.source && FUENTES_MOVIMIENTO.includes(q.source as FuenteMovimiento) ? (q.source as FuenteMovimiento) : null;
      const filtros: FiltrosMovimientos = {
        from: q.from && DATE_RE.test(q.from) ? q.from : null,
        to: q.to && DATE_RE.test(q.to) ? q.to : null,
        direction: dir,
        type: tipo,
        source,
        accountId: q.accountId && UUID_RE.test(q.accountId) ? q.accountId : null,
        q: txt(q.q) ?? null,
        page: Math.max(1, parseInt(String(q.page || '1'), 10) || 1),
        pageSize: Math.min(200, Math.max(1, parseInt(String(q.pageSize || '50'), 10) || 50)),
        incluirAnulados: q.incluirAnulados === 'true',
      };
      res.json(await listarMovimientos.ejecutar(r.tenant, filtros));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // GET /api/admin/finanzas/movimientos/export.csv — exporta el período a CSV
  router.get('/finanzas/movimientos/export.csv', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      const q = r.query as Record<string, string | undefined>;
      const dir = q.direction === 'in' || q.direction === 'out' ? (q.direction as Direccion) : null;
      const pagina = await listarMovimientos.ejecutar(r.tenant, {
        from: q.from && DATE_RE.test(q.from) ? q.from : null,
        to: q.to && DATE_RE.test(q.to) ? q.to : null,
        direction: dir,
        type: q.type && TIPOS_MOVIMIENTO.includes(q.type as TipoMovimiento) ? (q.type as TipoMovimiento) : null,
        source: q.source && FUENTES_MOVIMIENTO.includes(q.source as FuenteMovimiento) ? (q.source as FuenteMovimiento) : null,
        accountId: null, q: txt(q.q) ?? null, page: 1, pageSize: 5000, incluirAnulados: false,
      });
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const head = ['Fecha', 'Direccion', 'Tipo', 'Categoria', 'Metodo', 'Origen', 'Descripcion', 'Monto'];
      const lines = pagina.items.map((m) => [
        m.occurredAt, m.direction === 'in' ? 'Ingreso' : 'Egreso', m.type,
        m.category ?? '', m.paymentMethod ?? '', m.source, m.description,
        (m.direction === 'in' ? '' : '-') + m.amountPen.toFixed(2),
      ].map(esc).join(','));
      const csv = '﻿' + [head.map(esc).join(','), ...lines].join('\r\n'); // BOM → Excel UTF-8
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="movimientos-${q.from || ''}_${q.to || ''}.csv"`);
      res.send(csv);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // POST /api/admin/finanzas/movimientos — alta manual (ingreso/egreso rápido)
  router.post('/finanzas/movimientos', validate({ body: RegistrarMovimientoSchema }), (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      const b = r.body as Record<string, unknown>;
      const tipo = b.tipo as TipoMovimiento;
      const direccion = (b.direccion as Direccion | undefined) ?? direccionDeTipo(tipo);
      const mov = await registrarMovimiento.ejecutar(r.tenant, {
        tipo,
        direccion,
        monto: Number(b.monto),
        descripcion: String(b.descripcion),
        fecha: String(b.fecha),
        categoria: (b.categoria as string | null) ?? null,
        metodoPago: (b.metodoPago as string | null) ?? null,
        accountId: (b.accountId as string | null) ?? null,
        customerId: (b.customerId as string | null) ?? null,
        staffId: (b.staffId as string | null) ?? null,
        receiptUrl: (b.receiptUrl as string | null) ?? null,
        source: 'manual',
        createdBy: r.admin?.id ?? null,
      });
      res.status(201).json(mov);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // PATCH /api/admin/finanzas/movimientos/:id — editar (categorizar, cuenta, método)
  router.patch('/finanzas/movimientos/:id', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      const b = r.body as Record<string, unknown>;
      const accountId = b.accountId;
      if (accountId != null && accountId !== '' && typeof accountId === 'string' && !UUID_RE.test(accountId)) {
        return next(BadRequest('accountId inválido'));
      }
      const mov = await editarMovimiento.ejecutar(r.tenant, r.params.id, {
        category: b.category === undefined ? undefined : (b.category as string | null),
        accountId: accountId === undefined ? undefined : ((accountId as string) || null),
        paymentMethod: b.paymentMethod === undefined ? undefined : (b.paymentMethod as string | null),
        description: typeof b.description === 'string' ? b.description : undefined,
      });
      res.json(mov);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // GET /api/admin/finanzas/conciliacion — inconsistencias a resolver
  router.get('/finanzas/conciliacion', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      res.json(await conciliacion.ejecutar(r.tenant));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // ── IA Contable (Gemini) ────────────────────────────────────
  // GET estado (para mostrar/ocultar la sección de IA en la UI).
  router.get('/finanzas/ia/estado', (async (_req: Request, res: Response) => {
    res.json({ disponible: ia.disponible() });
  }) as RequestHandler);

  // POST texto: "Compré tintes por 150 soles y pagué con Yape" → sugerencia.
  router.post('/finanzas/ia/texto', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
      res.json(await ia.interpretarTexto(prompt));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // POST comprobante: imagen/PDF base64 → extracción OCR estructurada.
  router.post('/finanzas/ia/comprobante', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = typeof req.body?.file === 'string' ? req.body.file : '';
      if (!file) return next(BadRequest('Archivo (file) requerido'));
      const m = file.match(/^data:([^;]{1,60});base64,/);
      const mimeType = m ? m[1] : 'image/jpeg';
      res.json(await ia.analizarComprobante(file, mimeType));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // POST /api/admin/finanzas/movimientos/:id/anular — anular con motivo
  router.post('/finanzas/movimientos/:id/anular', validate({ body: AnularMovimientoSchema }), (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      const mov = await anularMovimiento.ejecutar(r.tenant, r.params.id, (r.body?.motivo as string) ?? null, r.admin?.id ?? null);
      res.json(mov);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // ── Vouchers / comprobantes de un movimiento ────────────────
  router.get('/finanzas/movimientos/:id/vouchers', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      res.json(await vouchers.listar(r.tenant, r.params.id));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  router.post('/finanzas/movimientos/:id/vouchers', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      const file = typeof r.body?.file === 'string' ? r.body.file : null;
      if (!file) return next(BadRequest('Archivo (file) requerido'));
      const up = await uploadVoucher(file, 'vouchers'); // valida tipo/tamaño/magic
      const fileName = typeof r.body?.fileName === 'string' ? r.body.fileName.slice(0, 120) : null;
      const v = await vouchers.adjuntar(r.tenant, r.params.id, {
        url: up.url, fileType: up.fileType, publicId: up.publicId, fileName, uploadedBy: r.admin?.id ?? null,
      });
      res.status(201).json(v);
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  router.delete('/finanzas/vouchers/:id', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      const removed = await vouchers.eliminar(r.tenant, r.params.id);
      if (removed?.publicId) {
        const resourceType = removed.fileType === 'pdf' ? 'raw' : 'image';
        deleteVoucher(removed.publicId, resourceType).catch(() => {}); // best-effort
      }
      res.json({ success: true });
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  // ── Cuentas / cajas ─────────────────────────────────────────
  router.get('/finanzas/cuentas', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      res.json(await cuentas.listar(r.tenant));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  router.post('/finanzas/cuentas', validate({ body: CrearCuentaSchema }), (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      res.status(201).json(await cuentas.crear(r.tenant, r.body));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  router.patch('/finanzas/cuentas/:id', validate({ body: ActualizarCuentaSchema }), (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AdminReq;
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('id inválido'));
      res.json(await cuentas.actualizar(r.tenant, r.params.id, r.body));
    } catch (err) {
      next(traducirError(err));
    }
  }) as RequestHandler);

  return router;
}
