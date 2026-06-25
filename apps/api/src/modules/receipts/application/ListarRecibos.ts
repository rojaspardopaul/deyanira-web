// Caso de uso: listado admin de recibos con filtros (status / texto).

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { ReciboRepositorio, ReciboPersistido, FiltrosRecibos } from '../domain/ports/ReciboRepositorio';

export class ListarRecibos {
  constructor(private readonly repo: ReciboRepositorio) {}

  ejecutar(ctx: ContextoTenant, filtros: FiltrosRecibos): Promise<ReciboPersistido[]> {
    return this.repo.listar(ctx, filtros);
  }
}
