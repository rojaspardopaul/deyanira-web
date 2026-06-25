// Caso de uso: anular un recibo (status 'cancelled').

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { ReciboRepositorio, ReciboPersistido } from '../domain/ports/ReciboRepositorio';

export class AnularRecibo {
  constructor(private readonly repo: ReciboRepositorio) {}

  ejecutar(ctx: ContextoTenant, id: string): Promise<ReciboPersistido> {
    return this.repo.anular(ctx, id);
  }
}
