// Caso de uso: listar citas para el panel admin (con filtros + scoping por
// estilista + paginación). Equivale a la ruta legacy GET /api/admin/appointments.
//
// Es una lectura sin invariantes de dominio: la presentación normaliza los filtros
// (formatos) y este caso de uso delega en el repositorio, que aplica el contrato de
// paginación legacy (array sin ?page, envelope con ?page) y el seam de tenant.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type {
  CitaRepositorio,
  CitaPersistida,
  FiltrosCitasAdmin,
  PaginadoCitas,
} from '../domain/ports/CitaRepositorio';

export class ListarCitasAdmin {
  constructor(private readonly citas: CitaRepositorio) {}

  ejecutar(
    ctx: ContextoTenant,
    filtros: FiltrosCitasAdmin,
    query: Record<string, unknown>,
  ): Promise<CitaPersistida[] | PaginadoCitas> {
    return this.citas.listarAdmin(ctx, filtros, query);
  }
}
