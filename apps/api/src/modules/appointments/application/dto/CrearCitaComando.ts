// Comando de entrada del caso de uso CrearCita. DTO inmutable construido desde el
// cuerpo HTTP ya validado (Zod). Resuelve aquí la ambigüedad staff/onDuty que en
// la ruta legacy estaba inline.

/** Usuario autenticado (Supabase). El nombre ya viene derivado por la presentación. */
export interface UsuarioAutenticado {
  readonly id: string;
  readonly email: string | null;
  readonly nombre: string;
}

/** Forma del cuerpo HTTP validado (subset relevante de CreateBody). */
export interface CuerpoCrearCita {
  staffId?: string | null;
  serviceId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  atHome?: boolean;
  atHomeAddress?: string;
  atHomeDistrict?: string;
  onDutyStaff?: boolean;
  modifierSelections?: Record<string, unknown>;
}

export class CrearCitaComando {
  private constructor(
    readonly servicioId: string,
    readonly staffId: string | null,
    readonly onDutyStaff: boolean,
    readonly fecha: string,
    readonly inicio: string,
    readonly fin: string,
    readonly notas: string | null,
    readonly guestName: string | null,
    readonly guestPhone: string | null,
    readonly guestEmail: string | null,
    readonly aDomicilio: boolean,
    readonly direccion: string | null,
    readonly distrito: string | null,
    readonly selecciones: Record<string, unknown>,
    readonly usuario: UsuarioAutenticado | null,
  ) {}

  static desdeHttp(body: CuerpoCrearCita, usuario: UsuarioAutenticado | null): CrearCitaComando {
    const staffRaw = body.staffId ?? null;
    // Misma resolución que la ruta legacy: "on-duty" o ausencia de staff => estilista de turno.
    const onDutyStaff = Boolean(body.onDutyStaff) || !staffRaw || staffRaw === 'on-duty';
    const staffId = staffRaw && staffRaw !== 'on-duty' ? staffRaw : null;

    return new CrearCitaComando(
      body.serviceId,
      staffId,
      onDutyStaff,
      body.date,
      body.startTime,
      body.endTime,
      body.notes ?? null,
      body.guestName ?? null,
      body.guestPhone ?? null,
      body.guestEmail ?? null,
      Boolean(body.atHome),
      body.atHomeAddress ?? null,
      body.atHomeDistrict ?? null,
      body.modifierSelections ?? {},
      usuario,
    );
  }
}
