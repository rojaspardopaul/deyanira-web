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

/** Una línea de la reserva en lote, ya programada y precificada. */
export interface LineaReserva {
  readonly onDutyStaff: boolean;
  readonly staffId: string | null;
  readonly serviceId: string;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly totalPen: number;
}

export interface DatosReservaLote {
  readonly lineas: LineaReserva[];
  readonly packageId: string | null;
  readonly bookingGroupId: string;
  readonly notas: string | null; // solo a la primera cita
  readonly solicitante: {
    customerId: string | null;
    guestName: string | null;
    guestPhone: string | null;
    guestEmail: string | null;
  };
  readonly domicilio: { aDomicilio: boolean; direccion: string | null; distrito: string | null };
  readonly recargoMonto: number | null;
  readonly mainDate: string;
  readonly deposito: { requerido: boolean; percent: number; pen: number; grandTotal: number } | null;
}

export interface ResultadoLote {
  readonly created: CitaPersistida[];
  readonly payment: { id: string } | null;
}

// ── Gestión admin ─────────────────────────────────────────────

/** Filtros del listado admin de citas (todos opcionales). */
export interface FiltrosCitasAdmin {
  /** Día exacto 'YYYY-MM-DD' (tiene prioridad sobre el rango). */
  readonly fecha?: string | null;
  readonly fechaDesde?: string | null;
  readonly fechaHasta?: string | null;
  /** Filtro explícito por estilista (solo roles que ven a todos). */
  readonly staffId?: string | null;
  /** Estado en valor BD ('pending'|'confirmed'|...). */
  readonly estadoBd?: string | null;
  /** Scoping: si no es null, restringe a las citas de ese estilista (rol estilista). */
  readonly soloStaffId?: string | null;
}

/** Envelope paginado (cuando la query trae ?page); ver lib/pagination. */
export interface PaginadoCitas {
  readonly items: CitaPersistida[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

/** Datos para el alta manual admin de una cita individual. */
export interface DatosCitaAdmin {
  readonly staffId: string | null; // null = estilista de turno (onDutyStaff)
  readonly serviceId: string;
  readonly fecha: string; // 'YYYY-MM-DD'
  readonly franja: FranjaHoraria;
  readonly estadoBd: string; // estado resuelto en valor BD
  readonly totalPen: unknown; // service.pricePen
  readonly notas: string | null;
  readonly guestName: string;
  readonly guestPhone: string | null;
  readonly guestEmail: string | null;
}

/** Cambios de una edición admin (PATCH). Una clave presente = se actualiza ese
 *  campo; ausente = se deja igual. staff/notas usan wrapper porque `null` es un
 *  valor válido (estilista de turno / quitar notas). */
export interface CambiosCitaAdmin {
  readonly estado?: EstadoCita;
  readonly fecha?: string; // 'YYYY-MM-DD'
  readonly startTime?: string;
  readonly endTime?: string;
  readonly staff?: { readonly staffId: string | null };
  readonly notas?: { readonly valor: string | null };
}

/** Detalle del conflicto encontrado (para el mensaje "La estilista ya tiene..."). */
export interface ConflictoCita {
  readonly servicioNombre: string;
  readonly inicio: string;
  readonly fin: string;
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

  /** Crea una reserva en lote (N citas + pago de adelanto) en una transacción,
   *  verificando conflictos por estilista. */
  crearLote(ctx: ContextoTenant, datos: DatosReservaLote): Promise<ResultadoLote>;

  /** Lista las citas de un cliente (por customerId o por email de invitado). */
  listarDeCliente(
    ctx: ContextoTenant,
    params: { customerId: string; email: string | null },
  ): Promise<CitaPersistida[]>;

  /** Busca una cita por id (para cancelar). null si no existe. */
  buscarPorId(ctx: ContextoTenant, id: string): Promise<CitaPersistida | null>;

  /** Cambia el estado de una cita (estado de dominio; el mapper traduce a BD). */
  cambiarEstado(ctx: ContextoTenant, id: string, estado: EstadoCita): Promise<CitaPersistida>;

  // ── Gestión admin ───────────────────────────────────────────

  /** Listado admin con filtros + scoping por estilista. Devuelve un envelope
   *  paginado si `query.page` viene; si no, un array (contrato legacy). */
  listarAdmin(
    ctx: ContextoTenant,
    filtros: FiltrosCitasAdmin,
    query: Record<string, unknown>,
  ): Promise<CitaPersistida[] | PaginadoCitas>;

  /** Precio/datos básicos de un servicio para el alta manual. null si no existe. */
  buscarServicioBasico(ctx: ContextoTenant, serviceId: string): Promise<{ pricePen: unknown } | null>;

  /** Alta manual admin de una cita individual. */
  crearAdmin(ctx: ContextoTenant, datos: DatosCitaAdmin): Promise<CitaPersistida>;

  /** Busca una cita activa que solape (staff+fecha+franja). `incluirEnProceso`
   *  añade 'in_progress' al set (reprogramación admin); `exceptId` la excluye. */
  buscarConflictoAdmin(
    ctx: ContextoTenant,
    params: {
      staffId: string;
      fecha: string;
      franja: FranjaHoraria;
      exceptId?: string | null;
      incluirEnProceso?: boolean;
    },
  ): Promise<ConflictoCita | null>;

  /** Citas pendientes/confirmadas de un paquete en una fecha y cliente (guestEmail
   *  o customerId), con service+staff+package.eventType, ordenadas por startTime. */
  buscarGrupoPaquete(
    ctx: ContextoTenant,
    params: { packageId: string; fecha: string; customerKey: string },
  ): Promise<CitaPersistida[]>;

  /** Confirma (pending→confirmed) las citas indicadas. */
  confirmarPendientesDelGrupo(ctx: ContextoTenant, ids: string[]): Promise<void>;

  /** Recarga citas por id con service+staff (para el correo consolidado). */
  recargarCitas(ctx: ContextoTenant, ids: string[]): Promise<CitaPersistida[]>;

  /** Aplica una edición admin (estado/fecha/hora/estilista/notas) y devuelve la
   *  fila con service+staff+package.eventType. */
  actualizarAdmin(ctx: ContextoTenant, id: string, cambios: CambiosCitaAdmin): Promise<CitaPersistida>;
}
