// Adaptador de programación. Reutiliza lib/booking/scheduleBatch.js (compartido con
// el alta de paquetes del admin) sin reescribir su lógica.

import type { Scheduler, ItemProgramable, CitaProgramada } from '../domain/ports/Scheduler';
import type { ServicioLote } from '../domain/ports/CatalogoReservas';

/* eslint-disable @typescript-eslint/no-var-requires */
const { scheduleItems, diffInDays } = require('../../../lib/booking/scheduleBatch') as {
  scheduleItems: (params: unknown) => CitaProgramada[];
  diffInDays: (mainDate: string, otherDate: string) => number;
};

export class SchedulerLib implements Scheduler {
  programar(params: {
    items: ItemProgramable[];
    serviceById: Map<string, ServicioLote>;
    date: string;
    startTime: string;
  }): CitaProgramada[] {
    return scheduleItems(params);
  }

  diasEntre(mainDate: string, otherDate: string): number {
    return diffInDays(mainDate, otherDate);
  }
}
