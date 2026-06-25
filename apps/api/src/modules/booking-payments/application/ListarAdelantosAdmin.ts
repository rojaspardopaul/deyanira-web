// Caso de uso: listado admin de adelantos (filtros status / bookingGroupId).
// Equivale a GET /api/admin/booking-payments.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { AdelantoRepositorio, AdelantoPersistido, FiltrosAdelantos } from '../domain/ports/AdelantoRepositorio';

export class ListarAdelantosAdmin {
  constructor(private readonly repo: AdelantoRepositorio) {}

  ejecutar(ctx: ContextoTenant, filtros: FiltrosAdelantos): Promise<AdelantoPersistido[]> {
    return this.repo.listarAdmin(ctx, filtros);
  }
}
