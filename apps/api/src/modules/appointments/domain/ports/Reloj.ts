// Puerto de reloj (zona America/Lima). Inyectado para que las reglas dependientes
// del tiempo (no en el pasado, días de anticipación) sean deterministas en tests.
// La implementación real usa Intl/toLocale* con timeZone 'America/Lima'.

export interface AhoraLima {
  /** Fecha actual en Lima, 'YYYY-MM-DD'. */
  readonly fecha: string;
  /** Hora actual en Lima, 'HH:mm'. */
  readonly hora: string;
  /** Epoch ms (para comparar anticipación en días). */
  readonly ms: number;
}

export interface Reloj {
  ahoraLima(): AhoraLima;
}
