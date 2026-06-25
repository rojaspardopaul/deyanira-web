// Seam multi-tenant. Contexto request-scoped (NO es dominio): es un concern de
// aplicación que viaja por todos los casos de uso como primer parámetro `ctx`.
//
// HOY: resuelve siempre al tenant único ('deyanira'). El schema no tiene columna
// tenantId todavía, así que los repositorios reciben `ctx` pero aún no filtran.
// MAÑANA (SaaS): se resuelve por host/subdominio o claim del JWT y los repositorios
// añaden `where: { tenantId: ctx.tenantId }` en UN punto por repositorio.

export interface ContextoTenant {
  readonly tenantId: string;
}

/** Tenant único de la app single-tenant actual. */
export const TENANT_DEFECTO: ContextoTenant = Object.freeze({ tenantId: 'deyanira' });

/** Extrae el contexto del request (con fallback al tenant por defecto). */
export function contextoTenantDe(req: { tenant?: ContextoTenant }): ContextoTenant {
  return req.tenant ?? TENANT_DEFECTO;
}
