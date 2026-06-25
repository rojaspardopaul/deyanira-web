// Caso de uso: revisión del Centro de Conciliación (inconsistencias a resolver).

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { Conciliador, ConciliacionResultado } from '../domain/ports/Conciliador';

export class RevisarConciliacion {
  constructor(private readonly conciliador: Conciliador) {}

  ejecutar(ctx: ContextoTenant): Promise<ConciliacionResultado> {
    return this.conciliador.detectar(ctx);
  }
}
