// Caso de uso: KPIs del dashboard ejecutivo para un período. Delega la agregación
// en el modelo de lectura analítico.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type {
  AnaliticaFinanciera,
  ResumenFinancieroResultado,
  PuntoSerie,
} from '../domain/ports/AnaliticaFinanciera';

export class ResumenFinanciero {
  constructor(private readonly analitica: AnaliticaFinanciera) {}

  resumen(ctx: ContextoTenant, from: string, to: string): Promise<ResumenFinancieroResultado> {
    return this.analitica.resumen(ctx, from, to);
  }

  serie(ctx: ContextoTenant, year: number): Promise<PuntoSerie[]> {
    return this.analitica.serieMensual(ctx, year);
  }
}
