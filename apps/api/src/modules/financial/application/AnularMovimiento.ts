// Caso de uso: anular un movimiento (status 'void') con motivo. No borra la fila
// (el libro mayor es append-first: se conserva la traza). El admin debe confirmar
// en la UI antes de invocar (convención del proyecto).

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { MovimientoRepositorio, MovimientoPersistido } from '../domain/ports/MovimientoRepositorio';

export class AnularMovimiento {
  constructor(private readonly repo: MovimientoRepositorio) {}

  ejecutar(
    ctx: ContextoTenant,
    id: string,
    motivo: string | null,
    anuladoPor: string | null,
  ): Promise<MovimientoPersistido> {
    return this.repo.anular(ctx, id, motivo, anuladoPor);
  }
}
