// Caso de uso: reservas (grupos de citas) de un cliente + su adelanto, para crear
// un recibo vinculado a partir de una reserva existente.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { ReciboRepositorio, BookingResumen, CriterioBookings } from '../domain/ports/ReciboRepositorio';

export class ListarBookingsCliente {
  constructor(private readonly repo: ReciboRepositorio) {}

  ejecutar(ctx: ContextoTenant, criterio: CriterioBookings): Promise<BookingResumen[]> {
    if (!criterio.customerId && !(criterio.phone && criterio.phone.trim())) return Promise.resolve([]);
    return this.repo.bookingsCliente(ctx, criterio);
  }
}
