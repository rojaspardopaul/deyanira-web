// Caso de uso: rechazar (cancelar) todas las citas activas de un paquete en una
// fecha, con un único correo de rechazo al cliente. Espejo de ConfirmarGrupoCitas
// para el botón "Rechazar paquete" del calendario admin. También marca como
// 'rejected' el adelanto pendiente del grupo para que no quede por verificar.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { SolicitudCitaInvalidaError, CitaNoEncontradaError } from '../domain/errors';
import type { CitaPersistida, CitaRepositorio } from '../domain/ports/CitaRepositorio';
import { infoPaqueteDesde, type Notificador, type InfoPaquete } from '../domain/ports/Notificador';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface RechazarGrupoComando {
  readonly bookingGroupId?: string;
  readonly date?: string;
}

export class RechazarGrupoCitas {
  constructor(
    private readonly citas: CitaRepositorio,
    private readonly notificador: Notificador,
  ) {}

  async ejecutar(ctx: ContextoTenant, c: RechazarGrupoComando): Promise<{ ok: true; count: number }> {
    if (!c.bookingGroupId || !UUID_RE.test(c.bookingGroupId)) {
      throw new SolicitudCitaInvalidaError('bookingGroupId inválido');
    }
    if (!c.date || !DATE_RE.test(c.date)) {
      throw new SolicitudCitaInvalidaError('date debe ser YYYY-MM-DD');
    }

    // Solo las citas del grupo EN ESA FECHA: el addon (prueba) de otra fecha es
    // independiente y no se toca.
    const grupo: CitaPersistida[] = await this.citas.buscarGrupoPorBookingGroup(ctx, {
      bookingGroupId: c.bookingGroupId,
      fecha: c.date,
    });
    if (grupo.length === 0) throw new CitaNoEncontradaError('No hay citas en este grupo');

    await this.citas.cancelarActivasDelGrupo(ctx, grupo.map((a) => String(a.id)));
    await this.citas.rechazarPagoPendienteDelGrupo(ctx, c.bookingGroupId);

    // Correo único de rechazo al cliente (fire-and-forget en el adaptador).
    const first = grupo[0] as Record<string, unknown>;
    const customer = first.customer as { email?: string; name?: string } | null | undefined;
    const email = (first.guestEmail as string | null) || customer?.email || null;
    const nombre = (first.guestName as string | null) || customer?.name || 'Cliente';
    if (email) {
      const recargadas = await this.citas.recargarCitas(ctx, grupo.map((a) => String(a.id)));
      const pkg = first.package as
        | {
            name: string;
            groupLabel: string | null;
            eventType: InfoPaquete['eventType'];
            pricePen: unknown;
            trialAddonServiceId?: string | null;
            items?: Array<{ serviceId: string | null }>;
          }
        | null
        | undefined;
      this.notificador.reservaRechazada(
        recargadas,
        { email, nombre },
        infoPaqueteDesde(pkg),
        (first.atHomeExtraPen as number | null) ?? null,
      );
    }

    return { ok: true, count: grupo.length };
  }
}
