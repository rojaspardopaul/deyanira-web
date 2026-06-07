// Middleware que establece el ContextoTenant en cada request.
//
// HOY: setea siempre TENANT_DEFECTO. MAÑANA: resolver por host/subdominio o claim.
// Se monta temprano (antes de las rutas) para que `req.tenant` esté disponible en
// todos los handlers y casos de uso.
//
// Tipado estructural a propósito (sin depender de @types/express): la firma es
// compatible con un middleware de Express en runtime.

import { TENANT_DEFECTO, type ContextoTenant } from './ContextoTenant';

interface RequestConTenant {
  tenant?: ContextoTenant;
}

type NextFn = (err?: unknown) => void;

export function contextoTenant(req: RequestConTenant, _res: unknown, next: NextFn): void {
  req.tenant = TENANT_DEFECTO;
  next();
}
