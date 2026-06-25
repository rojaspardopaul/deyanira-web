// Caso de uso: edición puntual de un movimiento (categorizar, asignar cuenta,
// método o corregir descripción). Útil para resolver inconsistencias desde el
// Centro de Conciliación.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { MovimientoRepositorio, MovimientoPersistido } from '../domain/ports/MovimientoRepositorio';

export interface EditarMovimientoCambios {
  category?: string | null;
  accountId?: string | null;
  paymentMethod?: string | null;
  description?: string;
}

export class EditarMovimiento {
  constructor(private readonly repo: MovimientoRepositorio) {}

  ejecutar(ctx: ContextoTenant, id: string, cambios: EditarMovimientoCambios): Promise<MovimientoPersistido> {
    return this.repo.editar(ctx, id, cambios);
  }
}
