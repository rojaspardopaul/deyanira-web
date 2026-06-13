// Adaptador de catálogo de reservas. Carga paquetes y servicios (con modificadores
// y reglas) vía Prisma. Réplica fiel de las queries del batch legacy.

import type { PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { CatalogoReservas, PaqueteReserva, ServicioLote } from '../domain/ports/CatalogoReservas';

export class CatalogoReservasPrisma implements CatalogoReservas {
  constructor(private readonly prisma: PrismaClient) {}

  async cargarPaquete(_ctx: ContextoTenant, packageId: string): Promise<PaqueteReserva | null> {
    const pkg = await this.prisma.servicePackage.findUnique({
      where: { id: packageId },
      include: {
        eventType: { select: { id: true, name: true, slug: true } },
        items: { select: { serviceId: true } },
      },
    });
    return pkg as unknown as PaqueteReserva | null;
  }

  async cargarServiciosParaLote(
    _ctx: ContextoTenant,
    serviceIds: string[],
    incluirInactivos: boolean,
  ): Promise<ServicioLote[]> {
    const where = incluirInactivos
      ? { id: { in: serviceIds } }
      : { id: { in: serviceIds }, isActive: true };
    const servicios = await this.prisma.service.findMany({
      where,
      include: {
        modifierGroups: {
          include: { options: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
        conditionalRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    return servicios as unknown as ServicioLote[];
  }
}
