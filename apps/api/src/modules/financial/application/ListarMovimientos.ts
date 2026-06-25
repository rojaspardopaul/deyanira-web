// Caso de uso: listado paginado de movimientos (timeline + tabla con filtros).

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type {
  MovimientoRepositorio,
  FiltrosMovimientos,
  PaginaMovimientos,
} from '../domain/ports/MovimientoRepositorio';

export class ListarMovimientos {
  constructor(private readonly repo: MovimientoRepositorio) {}

  ejecutar(ctx: ContextoTenant, filtros: FiltrosMovimientos): Promise<PaginaMovimientos> {
    return this.repo.listar(ctx, filtros);
  }
}
