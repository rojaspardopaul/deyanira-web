// Adaptador de reloj en zona America/Lima. Misma técnica que la ruta legacy
// (toLocaleDateString/Time con timeZone), extraída a un puerto para tests deterministas.

import type { Reloj, AhoraLima } from '../domain/ports/Reloj';

export class RelojLima implements Reloj {
  ahoraLima(): AhoraLima {
    const ahora = new Date();
    return {
      fecha: ahora.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }),
      hora: ahora.toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' }),
      ms: ahora.getTime(),
    };
  }
}
