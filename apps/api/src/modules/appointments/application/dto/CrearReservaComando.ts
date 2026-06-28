// Comando del caso de uso CrearReservaEnLote (POST /api/appointments/batch).

import type { ItemProgramable } from '../../domain/ports/Scheduler';
import type { UsuarioAutenticado } from './CrearCitaComando';

export interface CuerpoCrearReserva {
  packageId?: string | null;
  items: ItemProgramable[];
  date: string;
  startTime: string;
  notes?: string | null;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  atHome?: boolean;
  atHomeAddress?: string;
  atHomeDistrict?: string;
  /** El cliente recoge y devuelve a la estilista (sin recargo). Solo válido en distritos habilitados. */
  clientPickup?: boolean;
}

export class CrearReservaComando {
  private constructor(
    readonly packageId: string | null,
    readonly items: ItemProgramable[],
    readonly fecha: string,
    readonly inicio: string,
    readonly notas: string | null,
    readonly guestName: string | null,
    readonly guestPhone: string | null,
    readonly guestEmail: string | null,
    readonly aDomicilio: boolean,
    readonly direccion: string | null,
    readonly distrito: string | null,
    readonly recogeCliente: boolean,
    readonly usuario: UsuarioAutenticado | null,
  ) {}

  static desdeHttp(body: CuerpoCrearReserva, usuario: UsuarioAutenticado | null): CrearReservaComando {
    return new CrearReservaComando(
      body.packageId ?? null,
      body.items,
      body.date,
      body.startTime,
      body.notes ?? null,
      body.guestName ?? null,
      body.guestPhone ?? null,
      body.guestEmail ?? null,
      Boolean(body.atHome),
      body.atHomeAddress ?? null,
      body.atHomeDistrict ?? null,
      Boolean(body.clientPickup),
      usuario,
    );
  }
}
