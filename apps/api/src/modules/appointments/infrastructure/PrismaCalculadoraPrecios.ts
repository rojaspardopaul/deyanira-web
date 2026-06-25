// Adaptador de precios. Carga el servicio (con modificadores y reglas) vía Prisma
// y delega el cálculo al motor legacy lib/pricing/calculate.js, que NO se reescribe
// (está blindado por los tests de caracterización de la Fase 0).

import type { PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type {
  CalculadoraPrecios,
  ServicioParaPrecio,
  ResultadoPrecio,
  ErrorRequerido,
} from '../domain/ports/CalculadoraPrecios';

/* eslint-disable @typescript-eslint/no-var-requires */
const { calculatePrice, validateRequired } = require('../../../lib/pricing/calculate') as {
  calculatePrice: (servicio: unknown, selecciones: unknown) => ResultadoPrecio;
  validateRequired: (servicio: unknown, selecciones: unknown) => ErrorRequerido[];
};

export class PrismaCalculadoraPrecios implements CalculadoraPrecios {
  constructor(private readonly prisma: PrismaClient) {}

  async cargarServicio(_ctx: ContextoTenant, servicioId: string): Promise<ServicioParaPrecio | null> {
    return this.prisma.service.findUnique({
      where: { id: servicioId },
      include: {
        modifierGroups: {
          include: { options: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
        conditionalRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  validarRequeridos(servicio: ServicioParaPrecio, selecciones: Record<string, unknown>): ErrorRequerido[] {
    return validateRequired(servicio, selecciones);
  }

  calcular(servicio: ServicioParaPrecio, selecciones: Record<string, unknown>): ResultadoPrecio {
    const r = calculatePrice(servicio, selecciones);
    return {
      totalPrice: r.totalPrice,
      totalDuration: r.totalDuration,
      blocked: r.blocked,
      blockedReasons: r.blockedReasons,
      requiresLeadDays: r.requiresLeadDays,
    };
  }
}
