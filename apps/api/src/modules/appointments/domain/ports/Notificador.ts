// Puerto de notificaciones. La implementación (Resend) reutiliza las funciones de
// lib/notifications/email.js. Las notificaciones son fire-and-forget (igual que hoy):
// nunca bloquean ni hacen fallar la creación de la cita.

import type { CitaPersistida } from './CitaRepositorio';

export interface Contacto {
  readonly email: string;
  readonly nombre: string;
}

/** Info del paquete para el correo consolidado de reserva en lote. */
export interface InfoPaquete {
  readonly name: string;
  readonly groupLabel: string | null;
  readonly eventType: { id: string; name: string; slug: string } | null;
  /** Precio del paquete: el correo lo muestra a nivel paquete, no por cita. */
  readonly pricePen: number;
  /** serviceIds de los PackageItem: esas citas se listan como "Incluido en el paquete". */
  readonly includedServiceIds: readonly string[];
  readonly trialAddonServiceId: string | null;
}

/** Construye InfoPaquete desde una fila de paquete (catálogo o Prisma con items). */
export function infoPaqueteDesde(
  pkg:
    | {
        name: string;
        groupLabel: string | null;
        eventType: InfoPaquete['eventType'];
        pricePen: unknown;
        trialAddonServiceId?: string | null;
        items?: ReadonlyArray<{ serviceId: string | null }> | null;
      }
    | null
    | undefined,
): InfoPaquete | null {
  if (!pkg) return null;
  return {
    name: pkg.name,
    groupLabel: pkg.groupLabel,
    eventType: pkg.eventType,
    pricePen: Number(pkg.pricePen) || 0,
    includedServiceIds: (pkg.items || [])
      .map((it) => it.serviceId)
      .filter((id): id is string => !!id),
    trialAddonServiceId: pkg.trialAddonServiceId ?? null,
  };
}

export interface Notificador {
  /** Acuse al cliente: "Solicitud recibida" (stepper paso 1). */
  citaSolicitada(cita: CitaPersistida, contacto: Contacto): void;

  /** Acuse consolidado de una reserva en lote (paquete o varios servicios). */
  reservaSolicitada(
    citas: CitaPersistida[],
    contacto: Contacto,
    paquete: InfoPaquete | null,
    atHomeExtraPen: number | null,
  ): void;

  /** Aviso al salón de nueva reserva para revisar/confirmar. */
  nuevaReservaAlSalon(cita: CitaPersistida): void;

  /** Aviso al cliente de cancelación. */
  citaCancelada(cita: CitaPersistida, contacto: Contacto, motivo: string): void;

  // ── Gestión admin ───────────────────────────────────────────

  /** Confirmación individual al cliente (el salón confirmó su cita). */
  citaConfirmada(cita: CitaPersistida, contacto: Contacto): void;

  /** La cita entró en proceso (en cabina). */
  citaEnProceso(cita: CitaPersistida, contacto: Contacto): void;

  /** La cita se completó. */
  citaCompletada(cita: CitaPersistida, contacto: Contacto): void;

  /** El cliente no asistió. */
  citaNoAsistio(cita: CitaPersistida, contacto: Contacto): void;

  /** Reprogramación: incluye la fecha/hora anterior para el "de X a Y". */
  citaReprogramada(
    cita: CitaPersistida,
    contacto: Contacto,
    anterior: { fecha: Date | string; hora: string },
  ): void;

  /** Confirmación consolidada de un grupo de paquete (un solo correo). */
  reservaConfirmada(
    citas: CitaPersistida[],
    contacto: Contacto,
    paquete: InfoPaquete | null,
    atHomeExtraPen: number | null,
  ): void;

  /** Rechazo consolidado de un grupo de paquete (un solo correo). */
  reservaRechazada(
    citas: CitaPersistida[],
    contacto: Contacto,
    paquete: InfoPaquete | null,
    atHomeExtraPen: number | null,
  ): void;

  /** Recibo de adelanto (alta admin de paquete con adelanto pagado). */
  reciboAdelanto(
    pago: { id: string } & Record<string, unknown>,
    citas: CitaPersistida[],
    contacto: Contacto,
    paquete: InfoPaquete | null,
  ): void;
}
