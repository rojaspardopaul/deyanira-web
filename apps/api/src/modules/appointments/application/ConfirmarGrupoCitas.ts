// Caso de uso: confirmar todas las citas (pendientes) de un paquete en una fecha,
// con un único correo de confirmación al cliente. Equivale a la ruta legacy
// POST /api/admin/appointments/confirm-group.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { SolicitudCitaInvalidaError, CitaNoEncontradaError } from '../domain/errors';
import type { CitaPersistida, CitaRepositorio } from '../domain/ports/CitaRepositorio';
import { infoPaqueteDesde, type Notificador, type InfoPaquete } from '../domain/ports/Notificador';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ConfirmarGrupoComando {
  readonly packageId?: string;
  readonly date?: string;
  readonly customerKey?: string;
  /** Alternativa moderna al trío packageId+date+customerKey (calendario admin). */
  readonly bookingGroupId?: string;
}

export class ConfirmarGrupoCitas {
  constructor(
    private readonly citas: CitaRepositorio,
    private readonly notificador: Notificador,
  ) {}

  async ejecutar(ctx: ContextoTenant, c: ConfirmarGrupoComando): Promise<{ ok: true; count: number }> {
    if (!c.date || !DATE_RE.test(c.date)) {
      throw new SolicitudCitaInvalidaError('date debe ser YYYY-MM-DD');
    }

    let grupo: CitaPersistida[];
    if (c.bookingGroupId) {
      if (!UUID_RE.test(c.bookingGroupId)) {
        throw new SolicitudCitaInvalidaError('bookingGroupId inválido');
      }
      grupo = await this.citas.buscarGrupoPorBookingGroup(ctx, {
        bookingGroupId: c.bookingGroupId,
        fecha: c.date,
      });
    } else {
      if (!c.packageId || !UUID_RE.test(c.packageId)) {
        throw new SolicitudCitaInvalidaError('packageId inválido');
      }
      if (!c.customerKey) {
        throw new SolicitudCitaInvalidaError('customerKey requerido (guestEmail o customerId)');
      }
      grupo = await this.citas.buscarGrupoPaquete(ctx, {
        packageId: c.packageId,
        fecha: c.date,
        customerKey: c.customerKey,
      });
    }
    if (grupo.length === 0) throw new CitaNoEncontradaError('No hay citas en este grupo');

    await this.citas.confirmarPendientesDelGrupo(ctx, grupo.map((a) => String(a.id)));

    // Correo único de confirmación al cliente (fire-and-forget en el adaptador).
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
      const paquete = infoPaqueteDesde(pkg);
      this.notificador.reservaConfirmada(
        recargadas,
        { email, nombre },
        paquete,
        (first.atHomeExtraPen as number | null) ?? null,
      );
    }

    return { ok: true, count: grupo.length };
  }
}
