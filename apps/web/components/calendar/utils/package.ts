// Helpers de paquetes (novia/quinceañera) para el calendario admin.

import type { Appointment } from '../types';

/** Icono del tipo de evento del paquete: usa `eventType.icon` (BD) o un fallback por slug. */
export function eventTypeIcon(eventType?: { slug?: string | null; icon?: string | null } | null): string {
  if (eventType?.icon) return eventType.icon;
  const slug = (eventType?.slug || '').toLowerCase();
  if (slug.includes('novia') || slug.includes('boda')) return '👰';
  if (slug.includes('quince')) return '👑';
  return '📦';
}

/** ¿La cita es el servicio adicional (prueba) del paquete? Se gestiona aparte
 *  del grupo (otra fecha/horario) y muestra su propio precio. */
export function isPackageAddon(apt: Pick<Appointment, 'package' | 'service'>): boolean {
  return Boolean(apt.package?.trialAddonServiceId && apt.service?.id === apt.package.trialAddonServiceId);
}
