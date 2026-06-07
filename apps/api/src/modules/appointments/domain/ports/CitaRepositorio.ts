// Puerto de persistencia y consultas de citas. La implementación con Prisma vive
// en infrastructure/ (Fase 1B). El dominio solo conoce esta interfaz.
//
// Todos los métodos reciben el ContextoTenant: hoy no filtra, pero deja el seam
// listo para el scoping multiempresa (un único punto por método).

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';
import type { Cita } from '../Cita';
import type { FranjaHoraria } from '../FranjaHoraria';
import type { EstadoCita } from '../EstadoCita';

/** Cita ya persistida. Forma exacta = lo que el repo devuelve (con service+staff),
 *  que el DTO de salida pasa al cliente para preservar el contrato HTTP. */
export type CitaPersistida = { id: string } & Record<string, unknown>;

export interface DatosCliente {
  readonly id: string;
  readonly nombre: string;
  readonly email: string | null;
}

export interface CitaRepositorio {
  /** ¿La estilista realiza ese servicio? (tabla StaffService) */
  estilistaRealizaServicio(ctx: ContextoTenant, staffId: string, servicioId: string): Promise<boolean>;

  /** ¿Hay una cita activa que se solape para ese staff/fecha/franja? */
  hayConflicto(
    ctx: ContextoTenant,
    params: { staffId: string; fecha: string; franja: FranjaHoraria },
  ): Promise<boolean>;

  /** Nº de citas activas (pendiente/confirmada) de un cliente registrado. */
  contarActivasDeCliente(ctx: ContextoTenant, customerId: string): Promise<number>;

  /** Nº de citas activas recientes (7 días) de un invitado por teléfono. */
  contarActivasRecientesDeInvitado(ctx: ContextoTenant, telefono: string): Promise<number>;

  /** Upsert del Customer (garantiza que exista antes de crear la cita). */
  asegurarCliente(ctx: ContextoTenant, datos: DatosCliente): Promise<void>;

  /** Persiste la cita y devuelve la fila con service+staff incluidos. */
  guardar(ctx: ContextoTenant, cita: Cita): Promise<CitaPersistida>;

  /** Busca una cita por id (para cancelar). null si no existe. */
  buscarPorId(ctx: ContextoTenant, id: string): Promise<CitaPersistida | null>;

  /** Cambia el estado de una cita (estado de dominio; el mapper traduce a BD). */
  cambiarEstado(ctx: ContextoTenant, id: string, estado: EstadoCita): Promise<CitaPersistida>;
}
