// Caso de uso: cancelar una cita propia (cliente). Equivale a la ruta legacy
// PATCH /api/appointments/:id/cancel.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { puedeCancelarse } from '../domain/EstadoCita';
import { estadoDesdeBd } from '../domain/mapeoEstado';
import { CitaNoCancelableError, CitaNoEncontradaError } from '../domain/errors';
import type { CitaPersistida, CitaRepositorio } from '../domain/ports/CitaRepositorio';
import type { Notificador } from '../domain/ports/Notificador';

export interface CancelarCitaComando {
  readonly citaId: string;
  readonly usuario: { readonly id: string; readonly email: string | null };
}

export class CancelarCita {
  constructor(
    private readonly citas: CitaRepositorio,
    private readonly notificador: Notificador,
  ) {}

  async ejecutar(ctx: ContextoTenant, comando: CancelarCitaComando): Promise<CitaPersistida> {
    const cita = await this.citas.buscarPorId(ctx, comando.citaId);
    if (!cita || cita.customerId !== comando.usuario.id) {
      throw new CitaNoEncontradaError('Cita no encontrada');
    }

    const estadoActual = estadoDesdeBd(String(cita.status));
    if (!puedeCancelarse(estadoActual)) {
      throw new CitaNoCancelableError('Esta cita no se puede cancelar');
    }

    const actualizada = await this.citas.cambiarEstado(ctx, comando.citaId, 'cancelada');

    const email = comando.usuario.email || (cita.guestEmail as string | null);
    const nombre = (cita.guestName as string | null) || 'Cliente';
    if (email) {
      this.notificador.citaCancelada(actualizada, { email, nombre }, 'Cancelado por el cliente');
    }

    return actualizada;
  }
}
