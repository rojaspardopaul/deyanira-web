// DTO de salida. Envuelve la cita persistida + el recargo a domicilio para que la
// presentación devuelva EXACTAMENTE el contrato HTTP legacy: { appointment, atHomeExtraPen }.

import type { CitaPersistida } from '../../domain/ports/CitaRepositorio';

export class CitaResultado {
  private constructor(
    readonly appointment: CitaPersistida,
    readonly atHomeExtraPen: number | null,
  ) {}

  static desde(appointment: CitaPersistida, atHomeExtraPen: number | null): CitaResultado {
    return new CitaResultado(appointment, atHomeExtraPen);
  }

  aJSON(): { appointment: CitaPersistida; atHomeExtraPen: number | null } {
    return { appointment: this.appointment, atHomeExtraPen: this.atHomeExtraPen };
  }
}
