// Puerto de catálogo para reservas en lote: carga paquetes y servicios (con sus
// modificadores/reglas) listos para programar y precificar.

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';

export interface PaqueteReserva {
  readonly id: string;
  readonly isActive: boolean;
  readonly pricePen: unknown;
  readonly requiresDeposit: boolean;
  readonly depositPercent: number | null;
  readonly name: string;
  readonly groupLabel: string | null;
  readonly eventType: { id: string; name: string; slug: string } | null;
  readonly trialAddonServiceId: string | null;
  readonly items: ReadonlyArray<{ serviceId: string | null }>;
}

export interface ServicioLote {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly pricePen: unknown;
  readonly duration: number;
  readonly parallelGroup: string | null;
  readonly daysBeforeMain: number | null;
  readonly modifierGroups?: unknown;
  readonly conditionalRules?: unknown;
}

export interface CatalogoReservas {
  cargarPaquete(ctx: ContextoTenant, packageId: string): Promise<PaqueteReserva | null>;
  cargarServiciosParaLote(
    ctx: ContextoTenant,
    serviceIds: string[],
    incluirInactivos: boolean,
  ): Promise<ServicioLote[]>;
}
