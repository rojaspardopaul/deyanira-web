// Caso de uso: proyecta un movimiento al libro mayor a partir de un evento de la
// operación (cita completada, adelanto pagado, pedido pagado, captura manual).
// Es IDEMPOTENTE: usa la clave de origen (source + tipo + id de la entidad) para
// no duplicar si el evento se reprocesa (reintentos, backfill, webhooks).

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { Movimiento, type DatosNuevoMovimiento } from '../domain/Movimiento';
import type {
  MovimientoRepositorio,
  MovimientoPersistido,
  ClaveOrigen,
} from '../domain/ports/MovimientoRepositorio';

export class ProyectarDesdeOperacion {
  constructor(private readonly repo: MovimientoRepositorio) {}

  ejecutar(ctx: ContextoTenant, datos: DatosNuevoMovimiento): Promise<MovimientoPersistido> {
    const mov = Movimiento.crear(datos);
    const clave: ClaveOrigen = {
      source: datos.source,
      type: datos.tipo,
      appointmentId: datos.appointmentId ?? null,
      bookingPaymentId: datos.bookingPaymentId ?? null,
      orderId: datos.orderId ?? null,
      expenseId: datos.expenseId ?? null,
      otherIncomeId: datos.otherIncomeId ?? null,
    };
    return this.repo.guardarIdempotente(ctx, mov, clave);
  }
}
