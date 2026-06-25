// Caso de uso: obtener un recibo por id (con items y pagos).

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { ReciboRepositorio, ReciboPersistido } from '../domain/ports/ReciboRepositorio';
import { ReciboNoEncontradoError } from '../domain/errors';

export class ObtenerRecibo {
  constructor(private readonly repo: ReciboRepositorio) {}

  async ejecutar(ctx: ContextoTenant, id: string): Promise<ReciboPersistido> {
    const recibo = await this.repo.buscar(ctx, id);
    if (!recibo) throw new ReciboNoEncontradoError('Recibo no encontrado');
    return recibo;
  }
}
