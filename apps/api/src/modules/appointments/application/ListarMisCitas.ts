// Caso de uso (consulta): citas del cliente autenticado.
// Equivale a GET /api/appointments/me.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { CitaPersistida, CitaRepositorio } from '../domain/ports/CitaRepositorio';

export class ListarMisCitas {
  constructor(private readonly citas: CitaRepositorio) {}

  ejecutar(ctx: ContextoTenant, params: { customerId: string; email: string | null }): Promise<CitaPersistida[]> {
    return this.citas.listarDeCliente(ctx, params);
  }
}
