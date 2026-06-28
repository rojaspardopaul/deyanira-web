// Helpers puros del wizard de reservas (precio/duración efectivos, slots,
// disponibilidad, ticket). Extraídos de BookingWizard.tsx (feature-first).

import { api } from '@/lib/api';
import { toBlob as htmlToBlob } from 'html-to-image';
import {
  calculatePrice as calculatePriceInline,
  type Selections,
  type ModifierGroup,
  type ServiceForPricing,
} from '@/lib/pricing';
import type { Service, Assignment, Slot } from '../types/booking.types';

export function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Calcula precio + duración efectivos de un servicio considerando sus modificadores
// dinámicos. Sin modifierGroups/selección, devuelve los valores base.
export function effectivePricing(service: Service, modSel?: Selections): { pricePen: number; duration: number } {
  const base = { pricePen: Number(service.pricePen) || 0, duration: service.duration || 0 };
  const groups = (service as Service & { modifierGroups?: ModifierGroup[] }).modifierGroups;
  if (!groups || groups.length === 0 || !modSel || Object.keys(modSel).length === 0) return base;
  const priced = calculatePriceInline(service as unknown as ServiceForPricing, modSel);
  return { pricePen: priced.totalPrice, duration: priced.totalDuration };
}

// ¿El servicio tiene modifierGroups que requieren selección y faltan?
export function hasIncompleteModifiers(service: Service, modSel?: Selections): boolean {
  const groups = (service as Service & { modifierGroups?: ModifierGroup[] }).modifierGroups;
  if (!groups || groups.length === 0) return false;
  for (const g of groups) {
    const s = modSel?.[g.id];
    if (g.fieldType === 'single_select' || g.fieldType === 'image_cards') {
      if (!s || !s.optionIds || s.optionIds.length === 0) return true;
    }
    if (g.fieldType === 'multi_select' && g.required) {
      if (!s || !s.optionIds || s.optionIds.length === 0) return true;
    }
    if (g.required && (g.fieldType === 'text_input' || g.fieldType === 'textarea')) {
      if (!s || !s.value || String(s.value).trim() === '') return true;
    }
  }
  return false;
}

export function totalPrice(services: Service[], modSels?: Record<string, Selections>) {
  return services.reduce((acc, s) => acc + effectivePricing(s, modSels?.[s.id]).pricePen, 0);
}

// Total con paquete (precio fijo) + extras (servicios no incluidos). El trial-addon
// se excluye porque su sobrecargo se suma aparte por el llamador.
export function totalWithPackage(
  services: Service[],
  pkg: { id: string; pricePen: number; bookableServices: Array<{ serviceId: string }>; trialAddon?: { serviceId: string } | null } | null,
  modSels?: Record<string, Selections>,
) {
  if (!pkg) return totalPrice(services, modSels);
  const skipIds = new Set<string>([
    ...pkg.bookableServices.map((b) => b.serviceId),
    ...(pkg.trialAddon?.serviceId ? [pkg.trialAddon.serviceId] : []),
  ]);
  const extras = services.filter((s) => !skipIds.has(s.id));
  return Number(pkg.pricePen) + totalPrice(extras, modSels);
}

export function fmtDate(iso: string) {
  if (!iso) return '';
  const [, m, d] = iso.split('-').map(Number);
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${months[m - 1]}. ${iso.slice(0, 4)}`;
}

// Genera una imagen PNG del ticket como Blob (vía html-to-image). El backgroundColor
// coincide con el fondo del ticket (negro) para evitar flash blanco en los bordes.
export async function generateTicketBlob(node: HTMLDivElement | null): Promise<Blob | null> {
  if (!node) return null;
  try {
    return await htmlToBlob(node, { pixelRatio: 2, cacheBust: true, backgroundColor: '#0F0F0F' });
  } catch (err) {
    console.error('generateTicketBlob error:', err);
    return null;
  }
}

// Convierte un Blob a base64 con data-URL prefix (requerido por nuestro upload).
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Share nativo con archivo (mobile). Devuelve true si se compartió o se canceló,
// false si el navegador no lo soporta.
export async function tryNativeShareWithFile(blob: Blob, text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return false;
  const file = new File([blob], 'reserva-deyanira.png', { type: 'image/png' });
  if (!navigator.canShare({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], text });
    return true;
  } catch (err) {
    if ((err as Error).name === 'AbortError') return true;
    return false;
  }
}

// Recargo por servicio a domicilio. La SEDE del salón es Cieneguilla, así que las
// distancias son km aproximados DESDE Cieneguilla. Fórmula: base + (km - kmBase) * tarifa/km.
// Debe mantenerse IDÉNTICA a la del backend (apps/api .../ConfiguracionDomicilioPrisma.ts)
// para que el estimado mostrado coincida con el recargo realmente cobrado.
const AT_HOME_DIST_KM: Record<string, number> = {
  Cieneguilla: 0, Pachacámac: 12, 'La Molina': 14, Chaclacayo: 16, Ate: 18, Lurín: 18,
  Lurigancho: 20, 'Santa Anita': 20, Surco: 22, 'San Borja': 22, 'San Luis': 22, 'El Agustino': 22,
  'San Juan de Lurigancho': 24, 'La Victoria': 26, Surquillo: 26, 'Lima Cercado': 27, Lince: 27,
  Breña: 28, 'Jesús María': 28, 'Villa María del Triunfo': 28, Rímac: 29, Miraflores: 30,
  'San Isidro': 30, 'Pueblo Libre': 31, Barranco: 32, Magdalena: 32, Chorrillos: 33,
  'Villa El Salvador': 33, 'San Miguel': 34, 'San Martín de Porres': 36, Independencia: 37,
  'Los Olivos': 38, Comas: 42, Carabayllo: 46, 'Puente Piedra': 48, Otro: 30,
};

// Tarifa de domicilio configurable desde el admin (Settings). El default es el
// mismo fallback del backend (120/15/4) por si los settings aún no cargaron. El
// wizard llama setAtHomeRates() al recibir la config pública para que el estimado
// mostrado coincida con el recargo que realmente cobra el backend.
let atHomeRates = { basePen: 120, baseKm: 15, ratePen: 4 };
export function setAtHomeRates(r: { basePen?: unknown; baseKm?: unknown; ratePen?: unknown }) {
  const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  atHomeRates = {
    basePen: num(r.basePen, atHomeRates.basePen),
    baseKm: num(r.baseKm, atHomeRates.baseKm),
    ratePen: num(r.ratePen, atHomeRates.ratePen),
  };
}

export function atHomeExtra(district: string) {
  const km = AT_HOME_DIST_KM[district] ?? 30;
  const { basePen, baseKm, ratePen } = atHomeRates;
  return Math.round((basePen + Math.max(0, km - baseKm) * ratePen) * 100) / 100;
}

export function computeDisplayEnd(
  assignments: Assignment[],
  startTime: string,
  modSels?: Record<string, Selections>,
): string {
  const groupDur = new Map<string, number>();
  for (const asgn of assignments) {
    const key = asgn.onDuty ? `turno-${asgn.service.id}` : asgn.staff!.id;
    const dur = effectivePricing(asgn.service, modSels?.[asgn.service.id]).duration;
    groupDur.set(key, (groupDur.get(key) || 0) + dur);
  }
  const maxDur = groupDur.size > 0 ? Math.max(...Array.from(groupDur.values())) : 60;
  return addMinutes(startTime, maxDur);
}

export async function computeAvailableSlots(
  assignments: Assignment[],
  date: string,
  forPackage = false,
  modSels?: Record<string, Selections>,
): Promise<Slot[]> {
  if (!date || assignments.length === 0) return [];

  const staffGroups = new Map<string, { serviceId: string; totalDur: number }>();
  const turnoServices: Array<{ serviceId: string; dur: number }> = [];

  for (const asgn of assignments) {
    const effDur = effectivePricing(asgn.service, modSels?.[asgn.service.id]).duration;
    if (asgn.onDuty || !asgn.staff) {
      turnoServices.push({ serviceId: asgn.service.id, dur: effDur });
    } else {
      const key = asgn.staff.id;
      const g = staffGroups.get(key);
      if (g) {
        g.totalDur += effDur;
      } else {
        staffGroups.set(key, { serviceId: asgn.service.id, totalDur: effDur || 60 });
      }
    }
  }

  const slotStartSets: string[][] = [];

  try {
    const staffResults = await Promise.all(
      Array.from(staffGroups.entries()).map(([staffId, { serviceId, totalDur }]) =>
        api.appointments.availability(staffId, serviceId, date, totalDur, forPackage),
      ),
    );
    staffResults.forEach((slots) => slotStartSets.push(slots.map((s) => s.start)));
  } catch {
    return [];
  }

  if (staffGroups.size === 0 && turnoServices.length > 0) {
    const totalDur = turnoServices.reduce((sum, t) => sum + t.dur, 0);
    const serviceId = turnoServices[0].serviceId;
    try {
      const slots = await api.appointments.availability(null, serviceId, date, totalDur, forPackage);
      slotStartSets.push(slots.map((s) => s.start));
    } catch {
      return [];
    }
  }

  if (slotStartSets.length === 0) return [];

  const intersection = slotStartSets[0].filter((start) => slotStartSets.every((set) => set.includes(start)));

  const allGroupDurs = [
    ...Array.from(staffGroups.values()).map((g) => g.totalDur),
    ...turnoServices.map((t) => t.dur),
  ];
  const displayDur = allGroupDurs.length > 0 ? Math.max(...allGroupDurs) : 60;

  return intersection.map((start) => ({ start, end: addMinutes(start, displayDur) }));
}
