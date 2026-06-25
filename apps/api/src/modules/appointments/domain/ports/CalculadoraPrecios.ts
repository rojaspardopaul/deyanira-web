// Puerto del motor de precios + catálogo de servicios para precio.
//
// En Fase 1B la implementación reutiliza tal cual lib/pricing/calculate.js (sin
// reescribir el algoritmo, blindado por los tests de caracterización) y carga el
// servicio con sus modifierGroups + conditionalRules vía Prisma.

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';

/** Servicio cargado con todo lo necesario para calcular precio (forma opaca para el dominio). */
export interface ServicioParaPrecio {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly pricePen: unknown;
  readonly modifierGroups?: unknown;
  readonly conditionalRules?: unknown;
}

export interface ErrorRequerido {
  readonly name: string;
}

export interface ResultadoPrecio {
  readonly totalPrice: number;
  readonly totalDuration: number;
  readonly blocked: boolean;
  readonly blockedReasons: string[];
  readonly requiresLeadDays: number | null;
}

export interface CalculadoraPrecios {
  /** Carga el servicio (con modificadores y reglas) listo para calcular precio. */
  cargarServicio(ctx: ContextoTenant, servicioId: string): Promise<ServicioParaPrecio | null>;

  /** Valida los grupos requeridos; devuelve los que faltan. */
  validarRequeridos(servicio: ServicioParaPrecio, selecciones: Record<string, unknown>): ErrorRequerido[];

  /** Calcula el precio autoritativo (anti-tampering) server-side. */
  calcular(servicio: ServicioParaPrecio, selecciones: Record<string, unknown>): ResultadoPrecio;
}
