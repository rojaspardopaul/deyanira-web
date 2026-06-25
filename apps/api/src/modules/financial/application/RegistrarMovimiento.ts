// Caso de uso: alta manual de un movimiento (ingreso/egreso rápido desde el FAB
// o el formulario). Construye la entidad de dominio (valida invariantes) y la
// persiste. Para movimientos automáticos desde la operación, usar
// ProyectarDesdeOperacion (idempotente).

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { Movimiento, type DatosNuevoMovimiento } from '../domain/Movimiento';
import type { MovimientoRepositorio, MovimientoPersistido } from '../domain/ports/MovimientoRepositorio';

export class RegistrarMovimiento {
  constructor(private readonly repo: MovimientoRepositorio) {}

  ejecutar(ctx: ContextoTenant, datos: DatosNuevoMovimiento): Promise<MovimientoPersistido> {
    const mov = Movimiento.crear({ ...datos, source: datos.source ?? 'manual' });
    return this.repo.guardar(ctx, mov);
  }
}
