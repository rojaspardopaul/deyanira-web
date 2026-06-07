// Presentación HTTP del módulo de citas. Handlers DELGADOS: validar -> construir
// comando -> invocar caso de uso -> responder. Los errores de dominio se traducen
// a HttpError en un punto (traducirError).
//
// Estrategia Strangler: este router maneja los endpoints YA migrados (POST /,
// PATCH /:id/cancel) y delega el resto (GET /availability, GET /me, POST /batch)
// al router legacy, que se pasa por inyección. Se monta solo si CITAS_MODULO_NUEVO=true.

import express, {
  type Request,
  type Response,
  type NextFunction,
  type Router,
  type RequestHandler,
} from 'express';
import { crearModuloCitas, CrearCitaComando } from '../index';
import { CrearCitaSchema } from './appointments.schemas';
import { traducirError } from '../../../shared/http/traducirError';

/* eslint-disable @typescript-eslint/no-var-requires */
const { optionalCustomer, isCustomer } = require('../../../middleware/auth') as {
  optionalCustomer: RequestHandler;
  isCustomer: RequestHandler;
};
const { honeypot } = require('../../../middleware/abuseGuard') as { honeypot: (field: string) => RequestHandler };
const { turnstile } = require('../../../middleware/turnstile') as { turnstile: () => RequestHandler };
const { validate, UUID_RE } = require('../../../lib/validate') as {
  validate: (schemas: unknown) => RequestHandler;
  UUID_RE: RegExp;
};
const { BadRequest } = require('../../../lib/errors') as { BadRequest: (msg: string) => Error };

interface SupabaseUser {
  id: string;
  email?: string | null;
  user_metadata?: { name?: string; full_name?: string };
}

function derivarNombre(user: SupabaseUser): string {
  return user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Cliente';
}

/** Construye el router del módulo nuevo, delegando lo no migrado al router legacy. */
export function crearRouterCitas(legacyRouter: Router): Router {
  const { crearCita, cancelarCita } = crearModuloCitas();
  const router = express.Router();

  // POST /api/appointments — crear cita individual (MIGRADO)
  router.post(
    '/',
    optionalCustomer,
    honeypot('website'),
    turnstile(),
    validate({ body: CrearCitaSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const r = req as Request & { user?: SupabaseUser; tenant: { tenantId: string } };
        if (r.body.staffId && r.body.staffId !== 'on-duty' && !UUID_RE.test(r.body.staffId)) {
          return next(BadRequest('staffId inválido'));
        }
        const usuario = r.user
          ? { id: r.user.id, email: r.user.email ?? null, nombre: derivarNombre(r.user) }
          : null;
        const comando = CrearCitaComando.desdeHttp(r.body, usuario);
        const resultado = await crearCita.ejecutar(r.tenant, comando);
        res.status(201).json(resultado.aJSON());
      } catch (err) {
        next(traducirError(err));
      }
    },
  );

  // PATCH /api/appointments/:id/cancel — cancelar cita propia (MIGRADO)
  router.patch('/:id/cancel', isCustomer, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as Request & { user: SupabaseUser; tenant: { tenantId: string } };
      if (!UUID_RE.test(r.params.id)) return next(BadRequest('ID inválido'));
      const actualizada = await cancelarCita.ejecutar(r.tenant, {
        citaId: r.params.id,
        usuario: { id: r.user.id, email: r.user.email ?? null },
      });
      res.json(actualizada);
    } catch (err) {
      next(traducirError(err));
    }
  });

  // Resto de endpoints aún no migrados (availability, /me, batch) -> router legacy.
  router.use(legacyRouter);

  return router;
}
