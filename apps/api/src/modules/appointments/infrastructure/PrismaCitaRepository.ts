// Adaptador de persistencia con Prisma. ÚNICO lugar del módulo donde se importa
// Prisma. Implementa el puerto CitaRepositorio. Réplica fiel de las queries legacy.

import type { PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { Cita } from '../domain/Cita';
import type { FranjaHoraria } from '../domain/FranjaHoraria';
import type { EstadoCita } from '../domain/EstadoCita';
import { aEstadoBd } from '../domain/mapeoEstado';
import type { CitaRepositorio, CitaPersistida, DatosCliente } from '../domain/ports/CitaRepositorio';
import { toPersistence } from './mappers';

// service+staff incluidos: la fila resultante alimenta el DTO -> contrato HTTP legacy.
const INCLUDE = { service: true, staff: true } as const;
const ESTADOS_ACTIVOS_BD = ['pending', 'confirmed'];

export class PrismaCitaRepository implements CitaRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  // NOTA tenant: hoy ctx no filtra (single-tenant). Mañana se añade
  // `where: { tenantId: ctx.tenantId }` aquí, en un único punto por método.

  async estilistaRealizaServicio(_ctx: ContextoTenant, staffId: string, servicioId: string): Promise<boolean> {
    const link = await this.prisma.staffService.findFirst({ where: { staffId, serviceId: servicioId } });
    return !!link;
  }

  async hayConflicto(
    _ctx: ContextoTenant,
    params: { staffId: string; fecha: string; franja: FranjaHoraria },
  ): Promise<boolean> {
    const conflicto = await this.prisma.appointment.findFirst({
      where: {
        staffId: params.staffId,
        date: new Date(`${params.fecha}T12:00:00Z`),
        status: { in: ESTADOS_ACTIVOS_BD },
        startTime: { lt: params.franja.fin },
        endTime: { gt: params.franja.inicio },
      },
    });
    return !!conflicto;
  }

  async contarActivasDeCliente(_ctx: ContextoTenant, customerId: string): Promise<number> {
    return this.prisma.appointment.count({ where: { customerId, status: { in: ESTADOS_ACTIVOS_BD } } });
  }

  async contarActivasRecientesDeInvitado(_ctx: ContextoTenant, telefono: string): Promise<number> {
    return this.prisma.appointment.count({
      where: {
        guestPhone: telefono,
        status: { in: ESTADOS_ACTIVOS_BD },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
  }

  async asegurarCliente(_ctx: ContextoTenant, datos: DatosCliente): Promise<void> {
    await this.prisma.customer.upsert({
      where: { id: datos.id },
      update: { email: datos.email || undefined },
      create: { id: datos.id, name: datos.nombre, email: datos.email },
    });
  }

  async guardar(_ctx: ContextoTenant, cita: Cita): Promise<CitaPersistida> {
    const row = await this.prisma.appointment.create({ data: toPersistence(cita), include: INCLUDE });
    return row as unknown as CitaPersistida;
  }

  async buscarPorId(_ctx: ContextoTenant, id: string): Promise<CitaPersistida | null> {
    const row = await this.prisma.appointment.findUnique({ where: { id }, include: INCLUDE });
    return row ? (row as unknown as CitaPersistida) : null;
  }

  async cambiarEstado(_ctx: ContextoTenant, id: string, estado: EstadoCita): Promise<CitaPersistida> {
    const row = await this.prisma.appointment.update({
      where: { id },
      data: { status: aEstadoBd(estado) },
      include: INCLUDE,
    });
    return row as unknown as CitaPersistida;
  }
}
