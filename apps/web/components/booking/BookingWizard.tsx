'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { useLoading } from '@/lib/loading';
import {
  Check, Clock, ChevronLeft, ChevronDown, CalendarDays, Scissors, User,
  LogIn, UserPlus, ShoppingBag, Sparkles,
  MapPin, Phone, Mail, CalendarCheck, ChevronRight, Trash2, Crown, Plus, Timer, X, Info,
} from 'lucide-react';
import BookingCalendar from '@/components/ui/BookingCalendar';
import DateTimePicker from '@/components/ui/datetime';
import TimeList from '@/components/ui/datetime/TimeList';
import ServiceOptionsForm from '@/components/booking/ServiceOptionsForm';
import BookingTicket, { type TicketDateGroup, type TicketItem } from '@/components/booking/BookingTicket';

// Modales pesados cargados bajo demanda (solo al abrirlos) → aligeran el bundle inicial de /reservar.
const CatalogPreviewModal = dynamic(
  () => import('@/components/catalog/CatalogPreviewModal').then((m) => m.CatalogPreviewModal),
  { ssr: false },
);
const AddServiceModal = dynamic(() => import('@/components/booking/AddServiceModal'), { ssr: false });
import Turnstile from '@/components/ui/Turnstile';
import { fmtRange12 } from '@/lib/time';
import BookingSummary from '@/components/booking/BookingSummary';
import { toBlob as htmlToBlob } from 'html-to-image';
import {
  calculatePrice as calculatePriceInline,
  type Selections, type ModifierGroup, type ServiceForPricing,
} from '@/lib/pricing';

// ── Types ──────────────────────────────────────────────────
type Service   = { id: string; name: string; duration: number; pricePen: number; description?: string; categoryId?: string | null; category?: { id: string; name: string; icon?: string } | null; [key: string]: unknown };
type Staff     = { id: string; name: string; role?: string; [key: string]: unknown };
type Category  = { id: string; name: string; icon?: string | null; slug?: string };
type Slot      = { start: string; end: string };
type GuestInfo = { name: string; phone: string; email: string };
type Step      = 1 | 2 | 3 | 4;
type AuthUser  = { id: string; email?: string; name?: string; token: string };

type Assignment = {
  service: Service;
  staff: Staff | null;
  onDuty: boolean;
};

// ── Helpers ─────────────────────────────────────────────────
function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total  = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Calcula precio + duración efectivos de un servicio considerando sus
// modificadores dinámicos. Si no hay modifierGroups o no hay selección,
// devuelve los valores base del servicio.
function effectivePricing(
  service: Service,
  modSel?: Selections,
): { pricePen: number; duration: number } {
  const base = { pricePen: Number(service.pricePen) || 0, duration: service.duration || 0 };
  const groups = (service as Service & { modifierGroups?: ModifierGroup[] }).modifierGroups;
  if (!groups || groups.length === 0 || !modSel || Object.keys(modSel).length === 0) return base;
  const priced = calculatePriceInline(service as unknown as ServiceForPricing, modSel);
  return { pricePen: priced.totalPrice, duration: priced.totalDuration };
}

// Indica si un servicio tiene modifierGroups que requieren selección
// (single_select / image_cards / multi_select sin opción elegida).
// Toggle, quantity y text_input no bloquean: quantity siempre tiene default,
// toggle siempre tiene un estado válido (on/off), text_input solo bloquea si required.
function hasIncompleteModifiers(service: Service, modSel?: Selections): boolean {
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

function totalPrice(services: Service[], modSels?: Record<string, Selections>) {
  return services.reduce((acc, s) => acc + effectivePricing(s, modSels?.[s.id]).pricePen, 0);
}

// Total considerando paquete (precio fijo) + extras (servicios no incluidos en el paquete).
// El trial-addon se excluye porque su sobrecargo se suma aparte por el llamador.
function totalWithPackage(
  services: Service[],
  pkg: { id: string; pricePen: number; bookableServices: Array<{ serviceId: string }>; trialAddon?: { serviceId: string } | null } | null,
  modSels?: Record<string, Selections>,
) {
  if (!pkg) return totalPrice(services, modSels);
  const skipIds = new Set<string>([
    ...pkg.bookableServices.map(b => b.serviceId),
    ...(pkg.trialAddon?.serviceId ? [pkg.trialAddon.serviceId] : []),
  ]);
  const extras = services.filter(s => !skipIds.has(s.id));
  return Number(pkg.pricePen) + totalPrice(extras, modSels);
}

function fmtDate(iso: string) {
  if (!iso) return '';
  const [, m, d] = iso.split('-').map(Number);
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d} ${months[m - 1]}. ${iso.slice(0, 4)}`;
}

// Genera una imagen PNG del ticket como Blob (vía html-to-image).
// El backgroundColor coincide con el fondo del ticket (negro) para que no haya
// flash blanco en los bordes redondeados al renderizar.
async function generateTicketBlob(node: HTMLDivElement | null): Promise<Blob | null> {
  if (!node) return null;
  try {
    return await htmlToBlob(node, { pixelRatio: 2, cacheBust: true, backgroundColor: '#0F0F0F' });
  } catch (err) {
    console.error('generateTicketBlob error:', err);
    return null;
  }
}

// Convierte un Blob a base64 con data-URL prefix (requerido por nuestro upload).
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Intenta share nativo con archivo (mobile). Si funciona, WhatsApp recibe
// la imagen como archivo adjunto real. Devuelve true si se compartió o el
// usuario canceló, false si el navegador no lo soporta.
async function tryNativeShareWithFile(blob: Blob, text: string): Promise<boolean> {
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

function atHomeExtra(district: string) {
  const DIST_KM: Record<string, number> = {
    'Surco':2,'La Molina':6,'San Borja':6,'Miraflores':7,'San Isidro':8,'Barranco':9,
    'Chorrillos':10,'Ate':8,'Santa Anita':12,'La Victoria':12,'Lince':12,'Jesús María':13,
    'Magdalena':13,'Pueblo Libre':14,'San Miguel':15,'El Agustino':13,'Lima Cercado':14,
    'Rímac':15,'Breña':15,'Villa María del Triunfo':16,'Villa El Salvador':18,
    'Los Olivos':22,'San Martín de Porres':20,'Independencia':21,'Comas':26,
    'San Juan de Lurigancho':20,'Otro':20,
  };
  const km = DIST_KM[district] ?? 20;
  return Math.round((20 + Math.max(0, km - 5) * 3) * 100) / 100;
}

function computeDisplayEnd(
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

async function computeAvailableSlots(
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
      const g   = staffGroups.get(key);
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
        api.appointments.availability(staffId, serviceId, date, totalDur, forPackage)
      )
    );
    staffResults.forEach(slots => slotStartSets.push(slots.map(s => s.start)));
  } catch {
    return [];
  }

  if (staffGroups.size === 0 && turnoServices.length > 0) {
    const totalDur = turnoServices.reduce((sum, t) => sum + t.dur, 0);
    const serviceId = turnoServices[0].serviceId;
    try {
      const slots = await api.appointments.availability(null, serviceId, date, totalDur, forPackage);
      slotStartSets.push(slots.map(s => s.start));
    } catch {
      return [];
    }
  }

  if (slotStartSets.length === 0) return [];

  const intersection = slotStartSets[0].filter(start =>
    slotStartSets.every(set => set.includes(start))
  );

  const allGroupDurs = [
    ...Array.from(staffGroups.values()).map(g => g.totalDur),
    ...turnoServices.map(t => t.dur),
  ];
  const displayDur = allGroupDurs.length > 0 ? Math.max(...allGroupDurs) : 60;

  return intersection.map(start => ({ start, end: addMinutes(start, displayDur) }));
}

const STEPS = [
  { label: 'Servicios', icon: Scissors },
  { label: 'Estilista', icon: User },
  { label: 'Horario',   icon: CalendarDays },
  { label: 'Confirmar', icon: Check },
];

const LIMA_DISTRICTS = [
  'Miraflores','San Isidro','Barranco','Surco','La Molina','San Borja',
  'Chorrillos','Ate','Santa Anita','La Victoria','Lince','Jesús María',
  'Magdalena','Pueblo Libre','San Miguel','El Agustino','Lima Cercado',
  'Rímac','Breña','Villa María del Triunfo','Villa El Salvador',
  'Los Olivos','San Martín de Porres','Independencia','Comas',
  'San Juan de Lurigancho','Otro',
];

const BOOKING_TIMER_SEC = 10 * 60; // fallback: 10 minutes

// ── Spinner ────────────────────────────────────────────────
function Spinner({ small }: { small?: boolean }) {
  const sz = small ? 'w-4 h-4 border' : 'w-8 h-8 border-2';
  return (
    <svg className={`${sz} animate-spin rounded-full`}
      style={{ borderColor: 'rgba(255,79,162,0.2)', borderTopColor: '#FF4FA2' }}
      viewBox="0 0 24 24" />
  );
}

// ── Step progress bar ──────────────────────────────────────
function StepBar({ step, onGoTo }: { step: Step; onGoTo: (n: Step) => void }) {
  return (
    <div className="px-5 pt-6 pb-2">
      <div className="flex items-start justify-between relative">
        {/* Background track */}
        <div className="absolute left-4 right-4 h-0.5 pointer-events-none"
          style={{ top: '16px', background: 'rgba(255,255,255,0.08)', zIndex: 0 }}>
          <div className="h-full transition-all duration-500 rounded-full"
            style={{ width: `${((step - 1) / 3) * 100}%`, background: 'linear-gradient(90deg, #FF4FA2, #D4AF37)' }} />
        </div>
        {STEPS.map(({ label, icon: Icon }, i) => {
          const n = (i + 1) as Step;
          const done   = step > n;
          const active = step === n;
          return (
            <div key={label} className="flex flex-col items-center gap-2" style={{ zIndex: 10, position: 'relative' }}>
              <button type="button" onClick={() => done && onGoTo(n)} disabled={!done}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                style={done ? {
                  background: 'linear-gradient(135deg, #FF4FA2, #e6368a)',
                  boxShadow: '0 4px 12px rgba(255,79,162,0.4)',
                  cursor: 'pointer',
                } : active ? {
                  background: '#111',
                  border: '2px solid #FF4FA2',
                  color: '#FF4FA2',
                } : {
                  background: '#111',
                  border: '2px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.3)',
                }}>
                {done ? <Check className="w-4 h-4 text-white" strokeWidth={2.5} /> : <Icon className="w-3.5 h-3.5" />}
              </button>
              <span className="text-[10px] font-semibold hidden sm:block"
                style={{ color: active ? '#FF4FA2' : done ? 'rgba(255,79,162,0.7)' : 'rgba(255,255,255,0.25)' }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs mt-3 sm:hidden" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Paso {step} de 4 — {STEPS[step - 1].label}
      </p>
    </div>
  );
}

// ── Package banner (shown when wizard is opened from a package CTA) ──
function PackageBanner({ pkg, onClear }: { pkg: PackageBookable; onClear: () => void }) {
  const accent = pkg.eventType?.accentColor || '#E8C040';
  return (
    <div className="mx-5 mt-4 rounded-2xl p-4 flex items-center gap-3"
      style={{ background: 'rgba(255,255,255,0.06)', border: `1.5px solid ${accent}66` }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${accent}22`, color: accent }}>
        <Crown className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: accent }}>
          {pkg.eventType?.name || 'Paquete'} preseleccionado
        </p>
        <p className="font-bold text-sm text-white truncate">
          {pkg.name}
          {pkg.groupLabel && <span className="ml-1 text-xs font-normal" style={{ color: 'rgba(255,255,255,0.6)' }}>· {pkg.groupLabel}</span>}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-display font-bold text-lg" style={{ color: accent }}>
          S/{pkg.pricePen}
        </p>
        <button onClick={onClear} className="text-[10px] underline hover:no-underline" style={{ color: 'rgba(255,255,255,0.5)' }}>
          quitar
        </button>
      </div>
    </div>
  );
}

// ── Card del paquete (precio fijo) ─────────────────────────
// Un solo card con: detalles + "Quitar" + lista "Incluye" (con ícono "i"
// informativo para servicios con catálogo) + toggle del servicio especial
// (trial) en una sola fila. Los paquetes NO tienen modificadores dinámicos.
function PackageCard({
  pkg, trialEnabled, setTrialEnabled, onClear, onOpenCatalog,
}: {
  pkg: PackageBookable;
  trialEnabled: boolean;
  setTrialEnabled: (v: boolean) => void;
  onClear: () => void;
  onOpenCatalog: (slug: string) => void;
}) {
  const accent = pkg.eventType?.accentColor || '#E8C040';
  const [trialExpanded, setTrialExpanded] = useState(false);

  // Items incluidos (usamos `items` para no duplicar por quantity)
  const items = (pkg.items && pkg.items.length > 0 ? pkg.items : pkg.bookableServices.map(bs => ({
    id: bs.serviceId, label: bs.label, quantity: bs.totalOccurrences || 1,
    catalogSlug: null as string | null,
  })));

  return (
    <div className="rounded-3xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${accent}55` }}>

      {/* Header: marca + nombre + precio + Quitar */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accent}22`, color: accent }}>
            <Crown className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-bold mb-0.5" style={{ color: accent }}>
              Paquete {pkg.eventType?.name || ''}
            </p>
            <p className="font-bold text-base text-white leading-tight">{pkg.name}</p>
            {pkg.groupLabel && (
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{pkg.groupLabel}</p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Precio fijo
          </p>
          <p className="font-display font-bold text-2xl" style={{ color: accent }}>
            S/{pkg.pricePen}
          </p>
          <button onClick={onClear}
            className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1 transition-opacity hover:opacity-70"
            style={{ color: '#f87171' }}>
            <Trash2 className="w-3 h-3" /> Quitar
          </button>
        </div>
      </div>

      {/* Incluye — los servicios con catálogo llevan un ícono "i" informativo al costado */}
      <div className="px-4 pb-3 pt-1" style={{ borderTop: `1px solid ${accent}22` }}>
        <p className="text-[10px] uppercase tracking-wider font-bold mb-2 mt-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Incluye
        </p>
        <ul className="space-y-1.5">
          {items.map((it, i) => {
            const catSlug = (it as { catalogSlug?: string | null }).catalogSlug || null;
            return (
              <li key={it.id + '-' + i} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <Check className="w-3.5 h-3.5 shrink-0" style={{ color: accent }} />
                <span>
                  {it.label}
                  {it.quantity > 1 ? (
                    <span className="ml-1 text-xs font-semibold opacity-70">×{it.quantity}</span>
                  ) : null}
                </span>
                {catSlug && (
                  <button type="button" onClick={() => onOpenCatalog(catSlug)}
                    title="Ver opciones del catálogo"
                    aria-label={`Ver opciones de ${it.label}`}
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all hover:scale-110"
                    style={{ background: `${accent}22`, color: accent }}>
                    <Info className="w-3 h-3" />
                  </button>
                )}
              </li>
            );
          })}
          {trialEnabled && pkg.trialAddon && (
            <li className="flex items-center gap-2 text-sm pt-1.5 mt-1" style={{ color: '#FF4FA2', borderTop: '1px dashed rgba(255,255,255,0.15)' }}>
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>
                {pkg.trialAddon.name}
                <span className="ml-1 text-xs font-semibold opacity-80">+S/{pkg.trialAddon.extraPricePen}</span>
              </span>
            </li>
          )}
        </ul>
      </div>

      {/* Servicio especial (trial) — toggle en una sola fila */}
      {pkg.trialAddon && (
        <div className="px-4 pb-4 pt-1">
          <div className="rounded-2xl overflow-hidden"
            style={{ background: trialEnabled ? 'rgba(255,79,162,0.1)' : 'rgba(255,255,255,0.04)',
                     border: `1.5px solid ${trialEnabled ? 'rgba(255,79,162,0.5)' : 'rgba(255,255,255,0.1)'}` }}>
            <div className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: trialEnabled ? 'rgba(255,79,162,0.18)' : 'rgba(255,255,255,0.06)',
                         color: trialEnabled ? '#FF4FA2' : 'rgba(255,255,255,0.5)' }}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-white leading-tight">{pkg.trialAddon.name}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  +S/{pkg.trialAddon.extraPricePen}
                  {pkg.trialAddon.daysBeforeMain ? ` · ${pkg.trialAddon.daysBeforeMain} día${pkg.trialAddon.daysBeforeMain > 1 ? 's' : ''} antes` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setTrialEnabled(!trialEnabled)} aria-pressed={trialEnabled}
                className="relative w-12 h-7 rounded-full transition-colors shrink-0"
                style={{ background: trialEnabled ? '#FF4FA2' : 'rgba(255,255,255,0.15)' }}>
                <span className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform"
                  style={{ transform: trialEnabled ? 'translateX(20px)' : 'translateX(0)' }} />
              </button>
            </div>
            {(pkg.trialAddon.longDescriptionMd || pkg.trialAddon.imageUrl) && (
              <>
                <button type="button" onClick={() => setTrialExpanded(v => !v)}
                  className="w-full px-3 py-2 flex items-center justify-between text-[11px] font-semibold transition-colors"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                  <span>{trialExpanded ? 'Ocultar info' : '¿En qué consiste?'}</span>
                  <ChevronDown className="w-3.5 h-3.5 transition-transform"
                    style={{ transform: trialExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>
                {trialExpanded && (
                  <div className="px-3 pb-3 pt-1 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {pkg.trialAddon.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pkg.trialAddon.imageUrl} alt={pkg.trialAddon.name}
                        className="w-full rounded-lg mb-2" style={{ maxHeight: 160, objectFit: 'cover' }} />
                    )}
                    {pkg.trialAddon.longDescriptionMd && (
                      <div className="whitespace-pre-line">{pkg.trialAddon.longDescriptionMd}</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] px-4 pb-4 italic" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Los servicios del paquete no se pueden editar.
      </p>
    </div>
  );
}

// ── Summary bar (sticky bottom of step 1) ──────────────────
function ServicesSummaryBar({ services, onNext, packageInfo, trialEnabled, modifierSelections }: {
  services: Service[];
  onNext: () => void;
  packageInfo: PackageBookable | null;
  trialEnabled?: boolean;
  modifierSelections?: Record<string, Selections>;
}) {
  if (services.length === 0 && !packageInfo) return null;
  // Duración: usa effectivePricing (base + impacto de modificadores)
  const totalMin = services.reduce(
    (a, s) => a + effectivePricing(s, modifierSelections?.[s.id]).duration,
    0,
  );
  const trialExtra = (trialEnabled && packageInfo?.trialAddon) ? packageInfo.trialAddon.extraPricePen : 0;
  const price = totalWithPackage(services, packageInfo, modifierSelections) + trialExtra;

  // Validación: bloquea Continuar si algún servicio (no del paquete) tiene
  // modifierGroups sin completar.
  const pkgIds = new Set(packageInfo?.bookableServices.map(b => b.serviceId) || []);
  const incompleteServices = services.filter(
    s => !pkgIds.has(s.id) && hasIncompleteModifiers(s, modifierSelections?.[s.id]),
  );
  const isBlocked = incompleteServices.length > 0;

  // Breakdown
  const extras = services.filter(s => !pkgIds.has(s.id));

  return (
    <div className="sticky bottom-0 left-0 right-0 pt-2 pb-3">
      {isBlocked && (
        <div className="rounded-xl px-3 py-2 mb-2 text-xs font-medium flex items-start gap-1.5"
          style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)', color: '#FBBF24' }}>
          <span>⚠️</span>
          <span>
            Para continuar, personaliza:{' '}
            <strong>{incompleteServices.map((s) => s.name).join(', ')}</strong>
          </span>
        </div>
      )}
      <div className="rounded-2xl p-4 flex items-center justify-between gap-3"
        style={{ background: 'rgba(22,22,22,0.92)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,79,162,0.3)' }}>
        <div className="min-w-0">
          {packageInfo ? (
            <>
              <p className="text-xs font-semibold truncate" style={{ color: '#FF4FA2' }}>
                {packageInfo.name}{extras.length > 0 ? ` + ${extras.length} extra${extras.length > 1 ? 's' : ''}` : ''}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {totalMin} min · <span className="font-bold text-white whitespace-nowrap">S/ {price.toFixed(2)}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold" style={{ color: '#FF4FA2' }}>
                {services.length} servicio{services.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {totalMin} min · <span className="font-bold text-white whitespace-nowrap">S/ {price.toFixed(2)}</span>
              </p>
            </>
          )}
        </div>
        <button
          onClick={onNext}
          disabled={isBlocked}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-full font-bold text-sm text-white transition-all active:scale-95 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: isBlocked ? 'rgba(255,79,162,0.4)' : 'linear-gradient(135deg, #FF4FA2, #e6368a)',
            boxShadow: isBlocked ? 'none' : '0 4px 16px rgba(255,79,162,0.4)',
          }}>
          Continuar <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Timer display ──────────────────────────────────────────
function TimerBadge({ seconds }: { seconds: number }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isUrgent = seconds <= 120;
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{
        background: isUrgent ? 'rgba(239,68,68,0.15)' : 'rgba(212,175,55,0.12)',
        border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.4)' : 'rgba(212,175,55,0.35)'}`,
        color: isUrgent ? '#f87171' : '#D4AF37',
      }}>
      <Timer className="w-3.5 h-3.5" />
      {mins}:{String(secs).padStart(2, '0')}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// WIZARD PRINCIPAL
// ══════════════════════════════════════════════════════════
type PackageBookable = {
  id: string;
  name: string;
  pricePen: number;
  comparePricePen?: number | null;
  groupLabel: string | null;
  eventType: { name: string; slug: string; accentColor: string };
  items?: Array<{
    id: string;
    label: string;
    quantity: number;
    serviceId: string | null;
    duration?: number;
    parallelGroup?: string | null;
    daysBeforeMain?: number | null;
    longDescriptionMd?: string | null;
    recommendationMd?: string | null;
    scheduleInfoMd?: string | null;
    catalogSlug?: string | null;
  }>;
  bookableServices: Array<{
    serviceId: string;
    name: string;
    duration: number;
    label: string;
    occurrence?: number;
    totalOccurrences?: number;
    // Heredado del Service vinculado
    parallelGroup?: string | null;
    daysBeforeMain?: number | null;
    longDescriptionMd?: string | null;
    recommendationMd?: string | null;
    scheduleInfoMd?: string | null;
  }>;
  trialAddon?: {
    serviceId: string;
    name: string;
    duration: number;
    extraPricePen: number;
    daysBeforeMain?: number | null;
    longDescriptionMd?: string | null;
    imageUrl?: string | null;
  } | null;
};

export default function BookingWizard({
  initialServiceId,
  initialCategorySlug,
  initialPackageId,
  initialTrialEnabled,
}: {
  initialServiceId?: string;
  initialCategorySlug?: string;
  initialPackageId?: string;
  initialTrialEnabled?: boolean;
}) {
  const { show: showLoader, hide: hideLoader, wrap } = useLoading();
  const [authUser, setAuthUser]       = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const router = useRouter();
  const [step, setStep]                         = useState<Step>(1);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [assignments, setAssignments]           = useState<Assignment[]>([]);
  const [selectedDate, setSelectedDate]         = useState('');
  const [selectedSlot, setSelectedSlot]         = useState<Slot | null>(null);
  const [guestInfo, setGuestInfo]               = useState<GuestInfo>({ name: '', phone: '', email: '' });
  const [atHome, setAtHome]                     = useState(false);
  const [atHomeAddress, setAtHomeAddress]       = useState('');
  const [atHomeDistrict, setAtHomeDistrict]     = useState('Miraflores');
  const [atHomeEnabled, setAtHomeEnabled]       = useState(false);
  const [loading, setLoading]                   = useState(false);
  const [confirmed, setConfirmed]               = useState<Record<string, unknown> | null>(null);
  const [error, setError]                       = useState('');
  // Anti-bot: token Turnstile + honeypot (campo señuelo que un humano nunca rellena)
  const [turnstileToken, setTurnstileToken]     = useState('');
  const [honeypot, setHoneypot]                 = useState('');

  // Paquete preseleccionado (cuando se llega desde /servicios/[evento])
  const [packageInfo, setPackageInfo] = useState<PackageBookable | null>(null);
  // Toggle "Con prueba de maquillaje" del paquete (puede venir activado por ?trial=1)
  const [trialEnabled, setTrialEnabled] = useState(!!initialTrialEnabled);
  // Fechas adicionales para servicios con anticipación obligatoria.
  // Key: número de días antes (1, 15…), Value: fecha YYYY-MM-DD y hora.
  const [advanceDates, setAdvanceDates] = useState<Record<number, { date: string; startTime?: string }>>({});
  // Selecciones de modificadores dinámicos por servicio.
  // Key: serviceId, Value: { [groupId]: { optionIds?, value?, quantity? } }
  const [modifierSelections, setModifierSelections] = useState<Record<string, Selections>>({});

  // Compartir reserva como imagen por WhatsApp
  const ticketRef = useRef<HTMLDivElement | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [whatsappError, setWhatsappError] = useState('');
  // Datos del salón para el ticket (nombre, logo, contacto)
  const [salonInfo, setSalonInfo] = useState<{
    name?: string; logoUrl?: string; logoDarkUrl?: string;
    whatsapp?: string; phone?: string; instagram?: string;
  }>({});
  // Logo pre-cargado como data:URL para que html-to-image no falle por CORS
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');

  // Lista de service IDs a preseleccionar (sólo los del paquete; +trial si activado)
  const initialServiceIds = packageInfo
    ? Array.from(new Set([
        ...packageInfo.bookableServices.map((s) => s.serviceId),
        ...(trialEnabled && packageInfo.trialAddon ? [packageInfo.trialAddon.serviceId] : []),
      ]))
    : undefined;

  // Timer duration from settings (fallback: 10 min)
  const [bookingTimerSec, setBookingTimerSec] = useState(BOOKING_TIMER_SEC);
  // Tracks which assignment combo we last loaded slots for (avoids resetting date/slot on back-forward)
  const [lastSlotKey, setLastSlotKey] = useState('');

  // Booking timer
  const [timerLeft, setTimerLeft]   = useState<number | null>(null);
  const timerRef                     = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll-to-top on step change
  const wizardTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.settings.public()
      .then((s) => {
        const sett = s as Record<string, unknown>;
        if (sett.atHomeEnabled) setAtHomeEnabled(true);
        if (sett.bookingTimerSeconds && Number(sett.bookingTimerSeconds) > 0) {
          setBookingTimerSec(Number(sett.bookingTimerSeconds));
        }
        setSalonInfo({
          name: sett.salonName as string | undefined,
          logoUrl: sett.logoUrl as string | undefined,
          logoDarkUrl: sett.logoDarkUrl as string | undefined,
          whatsapp: sett.whatsapp as string | undefined,
          phone: sett.phone as string | undefined,
          instagram: sett.instagramUrl as string | undefined,
        });
      })
      .catch(() => {});
  }, []);

  // Pre-fetch del logo a data:URL para que html-to-image no falle por CORS al
  // capturar imágenes cross-origin. Si Cloudinary no envía el header CORS,
  // toBlob() lanza "tainted canvas" y rompe la generación de la imagen.
  //
  // Prioridad de logo:
  //   1. salonInfo.logoDarkUrl (subido desde /admin/configuracion)
  //   2. salonInfo.logoUrl (subido desde /admin/configuracion)
  //   3. /logo-dark.png (fallback estático en public/)
  useEffect(() => {
    const url = salonInfo.logoDarkUrl || salonInfo.logoUrl || '/logo-dark.png';
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) return;
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = () => {
          if (!cancelled && typeof reader.result === 'string') {
            setLogoDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        // Si falla, el ticket usará el fallback "D"
        console.warn('No se pudo pre-cargar el logo para el ticket:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [salonInfo.logoDarkUrl, salonInfo.logoUrl]);

  // Fetch del paquete cuando llegamos con ?package=<id>
  useEffect(() => {
    if (!initialPackageId) return;
    api.eventTypes
      .package(initialPackageId)
      .then((p) => setPackageInfo(p as PackageBookable))
      .catch(() => {});
  }, [initialPackageId]);

  // Trial addon: sincroniza `selectedServices` con el toggle del trial.
  // El servicio "Prueba de maquillaje" puede estar inactivo (no aparece en el catálogo público),
  // así que lo inyectamos como Service sintético desde packageInfo.trialAddon.
  useEffect(() => {
    if (!packageInfo?.trialAddon) return;
    const ta = packageInfo.trialAddon;
    setSelectedServices(prev => {
      const has = prev.some(s => s.id === ta.serviceId);
      if (trialEnabled && !has) {
        return [...prev, {
          id: ta.serviceId,
          name: ta.name,
          duration: ta.duration,
          pricePen: 0, // el extra se factura por separado vía addonPricePen
        } as Service];
      }
      if (!trialEnabled && has) {
        // Limpiar también su asignación
        setAssignments(pa => pa.filter(a => a.service.id !== ta.serviceId));
        return prev.filter(s => s.id !== ta.serviceId);
      }
      return prev;
    });
  }, [trialEnabled, packageInfo]);

  useEffect(() => {
    showLoader();
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const meta  = session.user.user_metadata;
        const token = session.access_token;
        setAuthUser({
          id: session.user.id,
          email: session.user.email,
          name: meta?.name || meta?.full_name || '',
          token,
        });
        setGuestInfo(prev => ({
          name:  prev.name  || meta?.name || meta?.full_name || '',
          phone: prev.phone || '',
          email: prev.email || session.user.email || '',
        }));
        api.customers.me(token).then(profile => {
          setGuestInfo(prev => ({
            name:  prev.name  || profile.name  || '',
            phone: prev.phone || profile.phone || '',
            email: prev.email,
          }));
        }).catch(() => {});
      }
      setAuthChecked(true);
      hideLoader();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to top of wizard on step change
  useEffect(() => {
    if (wizardTopRef.current) {
      wizardTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [step]);

  // Scroll to top when confirmation screen appears
  useEffect(() => {
    if (confirmed) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [confirmed]);

  // Booking timer: start when entering step 4, clear otherwise
  useEffect(() => {
    if (step === 4 && selectedSlot) {
      setTimerLeft(bookingTimerSec);
      timerRef.current = setInterval(() => {
        setTimerLeft(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (step !== 4) setTimerLeft(null);
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Timer expired → go back to slot selection
  useEffect(() => {
    if (timerLeft === 0) {
      setSelectedSlot(null);
      setStep(3);
      setError('El tiempo para completar la reserva expiró. Por favor selecciona otro horario.');
    }
  }, [timerLeft]);

  const toggleService = useCallback((s: Service) => {
    setSelectedServices(prev => {
      const idx = prev.findIndex(x => x.id === s.id);
      if (idx >= 0) {
        setAssignments(pa => pa.filter(a => a.service.id !== s.id));
        return prev.filter((_, i) => i !== idx);
      }
      return [...prev, s];
    });
  }, []);

  function handleAssign(service: Service, staff: Staff | null, onDuty: boolean) {
    setAssignments(prev => [
      ...prev.filter(a => a.service.id !== service.id),
      { service, staff, onDuty },
    ]);
  }

  function goToStep(n: Step) { if (n < step) setStep(n); }

  function clearPackage() {
    setPackageInfo(null);
    setSelectedServices([]);
    setAssignments([]);
    setTrialEnabled(false);
  }

  async function handleConfirm() {
    if (assignments.length === 0 || !selectedDate || !selectedSlot || !authUser) return;
    setLoading(true); setError('');
    showLoader();
    try {
      // Construimos los items para el endpoint batch.
      // Para cada servicio, calculamos su fecha de acuerdo a daysBeforeMain.
      type BatchItem = {
        serviceId: string;
        staffId?: string | null;
        onDuty: boolean;
        date?: string;
        startTime?: string;
        addonPricePen?: number;
      };
      const items: BatchItem[] = [];

      // Helper para obtener fecha del item: si daysBeforeMain > 0, usa advanceDates[N]; sino selectedDate
      const dateFor = (daysBeforeMain?: number | null) => {
        if (!daysBeforeMain || daysBeforeMain <= 0) return undefined;
        return advanceDates[daysBeforeMain]?.date;
      };
      const startFor = (daysBeforeMain?: number | null) => {
        if (!daysBeforeMain || daysBeforeMain <= 0) return undefined;
        return advanceDates[daysBeforeMain]?.startTime;
      };

      if (packageInfo) {
        for (const bs of packageInfo.bookableServices) {
          const asgn = assignments.find(a => a.service.id === bs.serviceId);
          items.push({
            serviceId: bs.serviceId,
            staffId: asgn?.onDuty ? null : asgn?.staff?.id || null,
            onDuty: !!asgn?.onDuty || !asgn?.staff,
            date: dateFor(bs.daysBeforeMain ?? null),
            startTime: startFor(bs.daysBeforeMain ?? null),
          });
        }
        // Trial addon (si está activado): se añade como item con su serviceId
        if (trialEnabled && packageInfo.trialAddon) {
          const ta = packageInfo.trialAddon;
          const asgn = assignments.find(a => a.service.id === ta.serviceId);
          items.push({
            serviceId: ta.serviceId,
            staffId: asgn?.onDuty ? null : asgn?.staff?.id || null,
            onDuty: !!asgn?.onDuty || !asgn?.staff,
            date: dateFor(ta.daysBeforeMain ?? null),
            startTime: startFor(ta.daysBeforeMain ?? null),
            addonPricePen: ta.extraPricePen,
          });
        }
      }

      // Extras: servicios en assignments que no formen parte del paquete ni del trial
      const skipIds = new Set([
        ...(packageInfo?.bookableServices.map(b => b.serviceId) || []),
        ...(trialEnabled && packageInfo?.trialAddon ? [packageInfo.trialAddon.serviceId] : []),
      ]);
      for (const asgn of assignments) {
        if (skipIds.has(asgn.service.id)) continue;
        const sel = modifierSelections[asgn.service.id];
        items.push({
          serviceId: asgn.service.id,
          staffId: asgn.onDuty ? null : asgn.staff?.id || null,
          onDuty: asgn.onDuty || !asgn.staff,
          ...(sel && Object.keys(sel).length > 0 ? { modifierSelections: sel } : {}),
        } as typeof items[number] & { modifierSelections?: Selections });
      }

      const result = await api.appointments.batch({
        packageId: packageInfo?.id || null,
        items,
        date: selectedDate,
        startTime: selectedSlot.start,
        guestName: guestInfo.name,
        guestPhone: guestInfo.phone,
        guestEmail: guestInfo.email || authUser.email,
        atHome,
        atHomeAddress: atHome ? atHomeAddress : undefined,
        atHomeDistrict: atHome ? atHomeDistrict : undefined,
        turnstileToken: turnstileToken || undefined,
        website: honeypot || undefined,
      }, authUser.token);

      api.customers.updateMe(
        { name: guestInfo.name, phone: guestInfo.phone },
        authUser.token,
      ).catch(() => {});

      // Si la reserva (paquete) requiere adelanto, vamos al paso de pago.
      const r = result as { appointments?: Array<{ id: string }>; requiresDeposit?: boolean; bookingPaymentId?: string | null };
      if (r?.requiresDeposit && r?.bookingPaymentId) {
        router.push(`/reservar/pago?bp=${r.bookingPaymentId}`);
        return;
      }

      // Guardamos la respuesta completa para tener el ID de la primera cita
      // (usado en el ticket de WhatsApp).
      const firstAppt = r?.appointments?.[0];
      setConfirmed({ ok: true, id: firstAppt?.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reservar. Intenta de nuevo.');
    } finally {
      setLoading(false);
      hideLoader();
    }
  }

  function handleReset() {
    setConfirmed(null); setStep(1);
    setSelectedServices([]); setAssignments([]);
    setSelectedDate(''); setSelectedSlot(null);
    setAtHome(false); setAtHomeAddress('');
    setTimerLeft(null);
  }

  if (!authChecked) return null;

  if (!authUser) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'linear-gradient(135deg, rgba(255,79,162,0.15), rgba(212,175,55,0.1))', border: '1px solid rgba(255,79,162,0.2)' }}>
          <LogIn className="w-7 h-7" style={{ color: '#FF4FA2' }} />
        </div>
        <h2 className="font-display font-bold italic text-2xl text-white mb-2">Inicia sesión para reservar</h2>
        <p className="text-sm mb-8 max-w-xs mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Necesitas una cuenta para reservar citas. Es gratis y te toma menos de un minuto.
        </p>
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <Link href="/login?redirect=/reservar"
            className="flex items-center justify-center gap-2 w-full py-3.5 font-bold rounded-full text-sm text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)', boxShadow: '0 4px 20px rgba(255,79,162,0.4)' }}>
            <LogIn className="w-4 h-4" /> Iniciar sesión
          </Link>
          <Link href="/registro?redirect=/reservar"
            className="flex items-center justify-center gap-2 w-full py-3.5 font-bold rounded-full text-sm transition-all border"
            style={{ color: '#FF4FA2', borderColor: 'rgba(255,79,162,0.35)', background: 'rgba(255,79,162,0.06)' }}>
            <UserPlus className="w-4 h-4" /> Crear cuenta gratis
          </Link>
        </div>
        <p className="text-xs mt-6" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Al crear una cuenta podrás ver el historial de tus citas.
        </p>
      </div>
    );
  }

  // ── Confirmation screen ─────────────────────────────────
  if (confirmed) {
    const trialExtra = (trialEnabled && packageInfo?.trialAddon) ? packageInfo.trialAddon.extraPricePen : 0;
    const totalAmt = totalWithPackage(selectedServices, packageInfo, modifierSelections) + trialExtra + (atHome ? atHomeExtra(atHomeDistrict) : 0);
    const endTime  = selectedSlot ? computeDisplayEnd(assignments, selectedSlot.start, modifierSelections) : '';
    const hasOnDuty = assignments.some(a => a.onDuty);

    // Agrupa los servicios por fecha. Cada assignment va al grupo central o a un grupo
    // anticipado según su daysBeforeMain efectivo. El trial usa packageInfo.trialAddon.daysBeforeMain.
    type DateItem = { name: string; staff: string; price: number; isAddon?: boolean; options?: Array<{ label: string; delta?: number }> };
    type DateGroup = { date: string; startTime: string; endTime?: string; items: DateItem[] };
    const skipPkgIds = new Set(packageInfo?.bookableServices.map(b => b.serviceId) || []);
    const trialId = packageInfo?.trialAddon?.serviceId;
    const trialDbm = packageInfo?.trialAddon?.daysBeforeMain || 0;

    const groupsByDate = new Map<string, DateGroup>();
    const ensureGroup = (date: string, startTime: string, endTime?: string) => {
      if (!groupsByDate.has(date)) {
        groupsByDate.set(date, { date, startTime, endTime, items: [] });
      }
      return groupsByDate.get(date)!;
    };

    for (const a of assignments) {
      const isTrial = a.service.id === trialId;
      const isPkgService = skipPkgIds.has(a.service.id);
      const sDbm = isTrial ? trialDbm : ((a.service as Record<string, unknown>).daysBeforeMain as number | null | undefined) || 0;

      // ¿Va al grupo central o a un grupo anticipado?
      const goesToAdvance = sDbm > 0 && !!advanceDates[sDbm]?.date;
      const date = goesToAdvance ? advanceDates[sDbm].date : selectedDate;
      const startTime = goesToAdvance ? (advanceDates[sDbm].startTime || '—') : (selectedSlot?.start || '');
      const groupEndTime = goesToAdvance ? undefined : endTime;

      const group = ensureGroup(date, startTime, groupEndTime);
      const isAddon = isTrial && trialEnabled && !!packageInfo?.trialAddon;
      const eff = effectivePricing(a.service, modifierSelections[a.service.id]);
      const price = isAddon
        ? (packageInfo!.trialAddon!.extraPricePen)
        : (isPkgService ? 0 : eff.pricePen);

      // Modificadores seleccionados (para mostrar en el ticket)
      const sel = modifierSelections[a.service.id];
      const mGroups = (a.service as Service & { modifierGroups?: ModifierGroup[] }).modifierGroups || [];
      const options: Array<{ label: string; delta?: number }> = [];
      if (sel && mGroups.length > 0) {
        for (const g of mGroups) {
          const gSel = sel[g.id];
          if (!gSel) continue;
          for (const optId of (gSel.optionIds || [])) {
            const opt = g.options.find(o => o.id === optId);
            if (opt) {
              const delta =
                opt.modifierType === 'fixed' ? Number(opt.modifierValue) :
                opt.modifierType === 'percent' ? Number(a.service.pricePen) * Number(opt.modifierValue) / 100 :
                opt.modifierType === 'multiplier' ? Number(a.service.pricePen) * (Number(opt.modifierValue) - 1) :
                Number(opt.modifierValue);
              options.push({ label: `${g.name}: ${opt.label}`, delta });
            }
          }
        }
      }
      group.items.push({
        name: a.service.name,
        staff: a.onDuty ? '✦ Estilista de turno' : (a.staff?.name || '—'),
        price,
        isAddon,
        ...(options.length > 0 ? { options } : {}),
      });
    }

    // Ordenar grupos: día central primero, luego por fecha asc
    const dateGroups: DateGroup[] = Array.from(groupsByDate.values()).sort((a, b) => {
      if (a.date === selectedDate) return -1;
      if (b.date === selectedDate) return 1;
      return a.date.localeCompare(b.date);
    });

    // Texto breve que acompaña a la imagen en WhatsApp
    const wsText =
      `✨ Reserva en Deyanira Makeup Beauty\n` +
      `Nombre: ${guestInfo.name}\n` +
      `Total: S/ ${totalAmt.toFixed(2)}\n` +
      (atHome ? `🏠 A domicilio: ${atHomeAddress}, ${atHomeDistrict}\n` : '') +
      `⏳ A la espera de confirmación del salón.`;

    // Datos para el ticket (componente <BookingTicket>)
    const ticketGroups: TicketDateGroup[] = dateGroups.map((g) => ({
      date: g.date,
      startTime: g.startTime,
      endTime: g.endTime,
      items: g.items as TicketItem[],
    }));

    // Props del ticket que se envía como imagen (con logo, colores de marca).
    // Usamos el logo pre-cargado como data:URL para evitar errores CORS.
    const ticketProps = {
      customerName: guestInfo.name,
      customerPhone: guestInfo.phone,
      customerEmail: guestInfo.email || authUser?.email,
      packageName: packageInfo?.name,
      packageLabel: packageInfo?.groupLabel || undefined,
      dateGroups: ticketGroups,
      totalPen: totalAmt,
      atHome: atHome ? { address: atHomeAddress, district: atHomeDistrict } : null,
      bookingId: (confirmed as { id?: string })?.id,
      salonName: salonInfo.name,
      salonPhone: salonInfo.phone,
      salonWhatsapp: salonInfo.whatsapp,
      salonInstagram: salonInfo.instagram,
      logoUrl: logoDataUrl || undefined, // solo si pre-carga fue exitosa
    };

    return (
      <div className="p-4 md:p-6">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'linear-gradient(135deg, rgba(37,211,102,0.2), rgba(37,211,102,0.1))', border: '1px solid rgba(37,211,102,0.3)' }}>
            <CalendarCheck className="w-10 h-10" strokeWidth={2.5} style={{ color: '#25D366' }} />
          </div>
          <h2 className="font-display font-bold italic text-3xl text-white mb-2">¡Solicitud recibida!</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Te enviamos un correo con los detalles. <strong className="text-white">El salón confirmará tu cita</strong> muy pronto.
          </p>
        </div>

        {/* Resumen simple en pantalla — sin logo, solo los datos clave.
            El diseño "premium" con logo se reserva para la imagen de WhatsApp. */}
        <div className="mb-5">
          <BookingSummary
            customerName={guestInfo.name}
            packageName={packageInfo?.name}
            packageLabel={packageInfo?.groupLabel || undefined}
            dateGroups={ticketGroups}
            totalPen={totalAmt}
            atHome={atHome ? { address: atHomeAddress, district: atHomeDistrict } : null}
          />
        </div>

        {hasOnDuty && (
          <div className="rounded-xl p-4 mb-5 text-xs mx-auto" style={{
            background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)',
            color: 'rgba(212,175,55,0.9)', maxWidth: 600,
          }}>
            <p className="font-bold mb-1">✦ Sobre tu estilista de turno</p>
            <p style={{ color: 'rgba(255,255,255,0.6)' }}>
              El salón asignará a la especialista disponible y te confirmará por WhatsApp quién te atenderá.
            </p>
          </div>
        )}

        {/* Ticket renderizado fuera de pantalla — fuente fija 600px para html-to-image */}
        <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }} aria-hidden="true">
          <BookingTicket ref={ticketRef} {...ticketProps} />
        </div>

        <div className="flex flex-col gap-3 max-w-xl mx-auto">
          {whatsappError && (
            <div
              className="rounded-xl px-4 py-3 text-xs flex items-start gap-2"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}
            >
              <span>⚠️</span>
              <span>{whatsappError}</span>
            </div>
          )}
          <button
            onClick={async () => {
              if (whatsappLoading) return;
              setWhatsappLoading(true);
              setWhatsappError('');
              const appointmentId = (confirmed as { id?: string })?.id;
              const salonWa = salonInfo.whatsapp || salonInfo.phone || '';
              const salonWaDigits = salonWa.replace(/\D/g, '');
              try {
                // 1. Generamos la imagen del ticket
                console.log('[WhatsApp] Generando imagen del ticket...');
                const blob = await generateTicketBlob(ticketRef.current);
                if (!blob) {
                  setWhatsappError('No se pudo generar la imagen. Se enviará solo el texto.');
                  const base = salonWaDigits ? `https://wa.me/${salonWaDigits}` : 'https://wa.me/';
                  window.open(`${base}?text=${encodeURIComponent(wsText)}`, '_blank', 'noopener,noreferrer');
                  return;
                }
                console.log('[WhatsApp] Imagen generada, tamaño:', blob.size, 'bytes');

                // 2. Mobile: compartir como archivo adjunto real
                const shared = await tryNativeShareWithFile(blob, wsText);
                if (shared) {
                  console.log('[WhatsApp] Compartido via Web Share API');
                  return;
                }

                // 3. Desktop: subir a Cloudinary → WhatsApp previsualiza la URL
                if (!appointmentId || !authUser?.token) {
                  setWhatsappError('Falta información de la reserva para subir la imagen.');
                  const base = salonWaDigits ? `https://wa.me/${salonWaDigits}` : 'https://wa.me/';
                  window.open(`${base}?text=${encodeURIComponent(wsText)}`, '_blank', 'noopener,noreferrer');
                  return;
                }
                console.log('[WhatsApp] Subiendo imagen a Cloudinary...');
                let imageUrl = '';
                try {
                  const dataUrl = await blobToDataUrl(blob);
                  const { url } = await api.bookings.shareImage(
                    { appointmentId, image: dataUrl },
                    authUser.token,
                  );
                  imageUrl = url;
                  console.log('[WhatsApp] Imagen subida:', imageUrl);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : 'Error desconocido';
                  console.error('[WhatsApp] Upload falló:', err);
                  setWhatsappError(`No se pudo subir la imagen: ${msg}. Reinicia el backend si acabas de actualizar.`);
                  return;
                }

                // 4. Abrimos WhatsApp con texto + URL (WhatsApp previsualiza la imagen)
                const finalText = `${wsText}\n\n🖼️ Detalle visual:\n${imageUrl}`;
                const base = salonWaDigits ? `https://wa.me/${salonWaDigits}` : 'https://wa.me/';
                window.open(`${base}?text=${encodeURIComponent(finalText)}`, '_blank', 'noopener,noreferrer');
              } catch (err) {
                console.error('[WhatsApp] Error inesperado:', err);
                setWhatsappError('Ocurrió un error inesperado. Intenta de nuevo.');
              } finally {
                setWhatsappLoading(false);
              }
            }}
            disabled={whatsappLoading}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full font-semibold text-xs transition-all active:scale-95 disabled:opacity-60"
            style={{ background: 'transparent', color: '#25D366', border: '1px solid rgba(37,211,102,0.5)' }}>
            <Phone className="w-3.5 h-3.5" />
            {whatsappLoading ? 'Preparando imagen...' : 'Compartir comprobante por WhatsApp (opcional)'}
          </button>
          <a href="/mi-cuenta/citas"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-full font-bold text-sm text-white transition-all active:scale-95 order-first"
            style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)', boxShadow: '0 4px 20px rgba(255,79,162,0.4)' }}>
            <CalendarCheck className="w-4 h-4" /> Ver mis citas
          </a>
          <button onClick={handleReset}
            className="w-full py-3 text-sm font-medium"
            style={{ color: 'rgba(255,255,255,0.4)' }}>
            Hacer otra reserva
          </button>
        </div>

      </div>
    );
  }

  return (
    <div ref={wizardTopRef} className="flex flex-col scroll-mt-20">
      <StepBar step={step} onGoTo={goToStep} />
      {/* En el paso 1 el resumen del paquete vive dentro del PackageCard;
          en pasos posteriores mostramos el banner compacto como recordatorio. */}
      {packageInfo && step > 1 && (
        <PackageBanner pkg={packageInfo} onClear={clearPackage} />
      )}
      <div className="px-5 pt-4 pb-2">
        {step === 1 && (
          <ServiceStep
            selected={selectedServices}
            onToggle={toggleService}
            onNext={() => setStep(2)}
            initialServiceId={initialServiceId}
            initialServiceIds={initialServiceIds}
            initialCategorySlug={initialCategorySlug}
            packageInfo={packageInfo}
            trialEnabled={trialEnabled}
            setTrialEnabled={setTrialEnabled}
            onClearPackage={clearPackage}
            modifierSelections={modifierSelections}
            onModifierSelectionsChange={(serviceId, sel) =>
              setModifierSelections((prev) => ({ ...prev, [serviceId]: sel }))
            }
          />
        )}
        {step === 2 && selectedServices.length > 0 && (
          <StaffAssignmentStep
            selectedServices={selectedServices}
            assignments={assignments}
            onAssign={handleAssign}
            packageInfo={packageInfo}
            modifierSelections={modifierSelections}
            onNext={() => {
              // Only reset date/slot if the assignment combo changed (different stylist/service)
              const newKey = assignments.map(a => `${a.service.id}:${a.onDuty ? 'duty' : a.staff?.id}`).sort().join('|');
              if (newKey !== lastSlotKey) {
                setSelectedDate('');
                setSelectedSlot(null);
                setLastSlotKey(newKey);
              }
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && assignments.length > 0 && (
          <SlotStep
            assignments={assignments}
            date={selectedDate}
            slot={selectedSlot}
            onDateChange={setSelectedDate}
            onSlotSelect={setSelectedSlot}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
            timerExpiredError={error}
            onClearError={() => setError('')}
            packageInfo={packageInfo}
            trialEnabled={trialEnabled}
            advanceDates={advanceDates}
            setAdvanceDates={setAdvanceDates}
            modifierSelections={modifierSelections}
          />
        )}
        {step === 4 && (
          <>
          {/* Honeypot anti-bot: oculto a humanos, los bots lo rellenan */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
          />
          <Turnstile onToken={setTurnstileToken} theme="dark" className="mb-3 flex justify-center" />
          <ConfirmStep
            assignments={assignments}
            packageInfo={packageInfo}
            trialEnabled={trialEnabled}
            date={selectedDate}
            slot={selectedSlot}
            guestInfo={guestInfo}
            setGuestInfo={setGuestInfo}
            atHome={atHome}
            setAtHome={setAtHome}
            atHomeAddress={atHomeAddress}
            setAtHomeAddress={setAtHomeAddress}
            atHomeDistrict={atHomeDistrict}
            setAtHomeDistrict={setAtHomeDistrict}
            atHomeEnabled={atHomeEnabled}
            loading={loading}
            error={error}
            timerLeft={timerLeft}
            onBack={() => setStep(3)}
            onConfirm={handleConfirm}
            modifierSelections={modifierSelections}
          />
          </>
        )}
      </div>
    </div>
  );
}

// ── Category filter chips ──────────────────────────────────
function CategoryChips({ categories, active, onChange }: {
  categories: Category[];
  active: string | null;
  onChange: (id: string | null) => void;
}) {
  if (categories.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
      <button
        onClick={() => onChange(null)}
        className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
        style={active === null ? {
          background: 'linear-gradient(135deg, #FF4FA2, #e6368a)',
          color: '#fff',
          boxShadow: '0 2px 10px rgba(255,79,162,0.35)',
        } : {
          background: 'rgba(255,255,255,0.07)',
          border: '1.5px solid rgba(255,255,255,0.15)',
          color: 'rgba(255,255,255,0.6)',
        }}>
        Todos
      </button>
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
          style={active === cat.id ? {
            background: 'linear-gradient(135deg, #FF4FA2, #e6368a)',
            color: '#fff',
            boxShadow: '0 2px 10px rgba(255,79,162,0.35)',
          } : {
            background: 'rgba(255,255,255,0.07)',
            border: '1.5px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.6)',
          }}>
          {cat.icon && <span className="mr-1">{cat.icon}</span>}
          {cat.name}
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// STEP 1 — Selección múltiple de servicios
// ══════════════════════════════════════════════════════════
function ServiceStep({
  selected, onToggle, onNext, initialServiceId, initialServiceIds, initialCategorySlug,
  packageInfo, trialEnabled, setTrialEnabled, onClearPackage,
  modifierSelections, onModifierSelectionsChange,
}: {
  selected: Service[];
  onToggle: (s: Service) => void;
  onNext: () => void;
  initialServiceId?: string;
  initialServiceIds?: string[];
  initialCategorySlug?: string;
  packageInfo: PackageBookable | null;
  trialEnabled: boolean;
  setTrialEnabled: (v: boolean) => void;
  onClearPackage: () => void;
  modifierSelections: Record<string, Selections>;
  onModifierSelectionsChange: (serviceId: string, sel: Selections) => void;
}) {
  const [services, setServices]     = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat]   = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [showAll, setShowAll]       = useState(!initialServiceId && !(initialServiceIds && initialServiceIds.length));
  const [catalogSlug, setCatalogSlug] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const initialized                  = useRef(false);

  // Servicios bloqueados por el paquete (no editables — vienen incluidos)
  const lockedServiceIds = new Set(packageInfo?.bookableServices.map(b => b.serviceId) || []);

  useEffect(() => {
    Promise.all([
      api.services.list('withModifiers=1') as Promise<unknown[]>,
      api.services.categories() as Promise<unknown[]>,
    ])
      .then(([svcs, cats]) => {
        const list = svcs as Service[];
        const catList = cats as Category[];
        setServices(list);
        setCategories(catList);
        if (initialServiceId && !initialized.current && !initialServiceIds?.length) {
          initialized.current = true;
          const svc = list.find(s => s.id === initialServiceId);
          if (svc && !selected.some(x => x.id === svc.id)) onToggle(svc);
        } else if (initialCategorySlug && !initialized.current && !initialServiceIds?.length) {
          initialized.current = true;
          const cat = catList.find(c => c.slug === initialCategorySlug);
          if (cat) setActiveCat(cat.id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preselección desde paquete (puede llegar después de mount si la API tarda)
  useEffect(() => {
    if (!initialServiceIds || initialServiceIds.length === 0) return;
    if (services.length === 0) return;
    if (initialized.current) return;
    initialized.current = true;
    setShowAll(false);
    for (const sid of initialServiceIds) {
      const svc = services.find(s => s.id === sid);
      if (svc && !selected.some(x => x.id === svc.id)) onToggle(svc);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services.length, initialServiceIds?.join(',')]);

  if (loading) return (
    <div className="space-y-3 py-2">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-2xl skeleton-dark" />)}
    </div>
  );

  // Catálogo filtrado: oculta servicios que ya vienen en el paquete
  const filteredByCategory = activeCat
    ? services.filter(s => (s.categoryId === activeCat || s.category?.id === activeCat) && !lockedServiceIds.has(s.id))
    : services.filter(s => !lockedServiceIds.has(s.id));
  const hasSelected = selected.length > 0;

  // ── Modo PAQUETE (atómico — no se permiten extras) ─────────
  if (packageInfo) {
    return (
      <div className="pb-32">
        <h3 className="font-display font-bold italic text-2xl text-white mb-1">Tu paquete está listo</h3>
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Revisa lo que incluye y continúa para agendar.
        </p>

        {/* Card único del paquete: detalles + Quitar + toggle + opciones */}
        <PackageCard
          pkg={packageInfo}
          trialEnabled={trialEnabled}
          setTrialEnabled={setTrialEnabled}
          onClear={onClearPackage}
          onOpenCatalog={(slug) => setCatalogSlug(slug)}
        />

        <ServicesSummaryBar
          services={selected}
          onNext={onNext}
          packageInfo={packageInfo}
          trialEnabled={trialEnabled}
        />

        {catalogSlug && (
          <CatalogPreviewModal
            slug={catalogSlug}
            accent={packageInfo.eventType?.accentColor || '#E8C040'}
            onClose={() => setCatalogSlug(null)}
          />
        )}
      </div>
    );
  }

  // ── Modo CATÁLOGO (sin paquete) ───────────────────────────
  if (!hasSelected && showAll) {
    return (
      <div className="pb-32">
        <h3 className="font-display font-bold italic text-2xl text-white mb-1">¿Qué servicios deseas?</h3>
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Puedes seleccionar varios servicios en una sola reserva
        </p>
        <CategoryChips categories={categories} active={activeCat} onChange={setActiveCat} />
        <div className="space-y-3">
          {filteredByCategory.map(s => {
            const active = selected.some(x => x.id === s.id);
            return <ServiceCard key={s.id} service={s} active={active} onToggle={onToggle} />;
          })}
          {filteredByCategory.length === 0 && (
            <div className="text-center py-16">
              <Scissors className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No hay servicios en esta categoría.</p>
            </div>
          )}
        </div>
        <ServicesSummaryBar
          services={selected.map((s) => ({ ...s, ...(services.find((x) => x.id === s.id) || {}) }))}
          onNext={onNext}
          packageInfo={null}
          modifierSelections={modifierSelections}
        />
      </div>
    );
  }

  // When a service is pre-selected (or user selected from full list), show compact flow
  return (
    <div className="pb-32">
      <h3 className="font-display font-bold italic text-2xl text-white mb-1">¿Qué servicios deseas?</h3>
      <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Seleccionado{selected.length > 1 ? 's' : ''} · añade más si lo deseas
      </p>

      {/* Selected services */}
      <div className="space-y-3 mb-4">
        {selected.map(s => {
          const fullSvc = services.find((x) => x.id === s.id) || s;
          const groups = (fullSvc.modifierGroups as ModifierGroup[] | undefined) || [];
          const hasMods = groups.length > 0;
          const eff = effectivePricing(fullSvc, modifierSelections[s.id]);
          return (
            <div key={s.id} className="space-y-2">
              <ServiceCard
                service={s}
                active
                onToggle={onToggle}
                showRemove
                effectivePrice={eff.pricePen}
                effectiveDuration={eff.duration}
                referential={hasMods}
              />
              {hasMods && (
                <ServiceModifierBlock
                  service={fullSvc}
                  value={modifierSelections[s.id] || {}}
                  onChange={(sel) => onModifierSelectionsChange(s.id, sel)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Botón que abre el popup de agregar servicios */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl transition-all duration-200 active:scale-[0.99]"
        style={{ border: '1.5px dashed rgba(255,79,162,0.4)', background: 'rgba(255,79,162,0.04)' }}
      >
        <Plus className="w-4 h-4" style={{ color: 'rgba(255,79,162,0.9)' }} />
        <span className="font-semibold text-sm" style={{ color: 'rgba(255,79,162,0.9)' }}>
          Agregar otro servicio
        </span>
      </button>

      {showAddModal && (
        <AddServiceModal
          services={services}
          categories={categories}
          selectedIds={new Set(selected.map((s) => s.id))}
          onAdd={(svcs) => svcs.forEach((svc) => onToggle(svc))}
          onClose={() => setShowAddModal(false)}
        />
      )}

      <ServicesSummaryBar
        services={selected.map((s) => ({ ...s, ...(services.find((x) => x.id === s.id) || {}) }))}
        onNext={onNext}
        packageInfo={null}
        modifierSelections={modifierSelections}
      />
    </div>
  );
}

// ── Bloque de modificadores dinámicos para un servicio seleccionado ──
function ServiceModifierBlock({
  service, value, onChange,
}: {
  service: Service;
  value: Selections;
  onChange: (sel: Selections) => void;
}) {
  // Cuenta cuántas opciones están seleccionadas (mostrar en el badge)
  const count = Object.values(value).reduce((acc, v) => {
    if (!v) return acc;
    if (v.optionIds && v.optionIds.length) return acc + v.optionIds.length;
    if (v.value != null && v.value !== '' && v.value !== false) return acc + 1;
    return acc;
  }, 0);

  // Abierto por defecto: el cliente ve de inmediato qué opciones personalizar.
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,79,162,0.3)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between gap-2 transition-colors"
        style={{ background: open ? 'rgba(255,79,162,0.06)' : 'transparent' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 shrink-0" style={{ color: '#FF4FA2' }} />
          <span className="text-xs sm:text-sm font-semibold text-left" style={{ color: 'rgba(255,255,255,0.9)' }}>
            Personaliza: <span style={{ color: '#FF4FA2' }}>{service.name}</span>
            {count > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: 'rgba(255,79,162,0.2)', color: '#FF4FA2' }}>
                {count}
              </span>
            )}
          </span>
        </div>
        <ChevronDown
          className="w-4 h-4 shrink-0 transition-transform duration-300"
          style={{ color: 'rgba(255,255,255,0.5)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && (
        <div className="px-4 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <ServiceOptionsForm
            service={service as unknown as ServiceForPricing & { name?: string }}
            value={value}
            onChange={onChange}
            showStickyPrice={false}
          />
          {/* Precio referencial — se actualiza al elegir opciones */}
          {(() => {
            const eff = effectivePricing(service, value);
            const base = Number(service.pricePen) || 0;
            const changed = eff.pricePen !== base;
            return (
              <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Precio referencial<span style={{ color: '#FF4FA2' }}>*</span>
                  </span>
                  <div className="flex items-baseline gap-2">
                    {changed && (
                      <span className="text-xs line-through" style={{ color: 'rgba(255,255,255,0.4)' }}>S/ {base.toFixed(2)}</span>
                    )}
                    <span className="text-lg font-bold" style={{ color: '#FF4FA2' }}>
                      S/ {eff.pricePen.toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] mt-1 leading-snug" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  * Referencial. El monto puede variar según las opciones que elijas; se confirma con el salón al reservar.
                </p>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Reusable service card ──────────────────────────────────
function ServiceCard({ service: s, active, onToggle, showRemove, effectivePrice, effectiveDuration, referential }: {
  service: Service; active: boolean; onToggle: (s: Service) => void; showRemove?: boolean;
  // Precio/duración efectivos (con modificadores). Si no se pasan, usa los base.
  effectivePrice?: number; effectiveDuration?: number; referential?: boolean;
}) {
  const price = effectivePrice ?? Number(s.pricePen);
  const dur   = effectiveDuration ?? s.duration;
  return (
    <button onClick={() => onToggle(s)}
      className="w-full text-left rounded-2xl p-4 transition-all duration-200 active:scale-[0.98]"
      style={active ? {
        background: 'rgba(255,79,162,0.1)',
        border: '2px solid rgba(255,79,162,0.5)',
        boxShadow: '0 4px 20px rgba(255,79,162,0.1)',
      } : {
        background: 'rgba(255,255,255,0.04)',
        border: '2px solid rgba(255,255,255,0.08)',
      }}>
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200"
          style={active ? {
            background: showRemove ? 'rgba(239,68,68,0.2)' : 'linear-gradient(135deg, #FF4FA2, #e6368a)',
            boxShadow: showRemove ? 'none' : '0 2px 8px rgba(255,79,162,0.4)',
          } : {
            background: 'rgba(255,255,255,0.06)',
            border: '1.5px solid rgba(255,255,255,0.15)',
          }}>
          {active
            ? (showRemove
              ? <Trash2 className="w-3.5 h-3.5 text-red-400" strokeWidth={2} />
              : <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />)
            : null}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-white leading-tight">{s.name}</p>
          {s.description && (
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {s.description}
            </p>
          )}
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{dur} min</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-bold text-base"
            style={{ color: active ? '#FF4FA2' : 'rgba(255,255,255,0.7)' }}>
            S/ {price.toFixed(0)}
          </span>
          {referential && (
            <p className="text-[9px] leading-none mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              referencial
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Card de estilista (fila horizontal deslizable) ────────
function StylistCard({
  selected, name, subtitle, photoUrl, onDuty, onClick,
}: {
  selected: boolean;
  name: string;
  subtitle?: string;
  photoUrl?: string;
  onDuty?: boolean;
  onClick: () => void;
}) {
  const accent = onDuty ? '#D4AF37' : '#FF4FA2';
  const accentBg = onDuty ? 'rgba(212,175,55,0.12)' : 'rgba(255,79,162,0.1)';
  const accentBorder = onDuty ? 'rgba(212,175,55,0.5)' : 'rgba(255,79,162,0.5)';
  return (
    <button onClick={onClick}
      className="relative shrink-0 w-28 rounded-2xl p-3 flex flex-col items-center text-center transition-all duration-200 active:scale-95"
      style={selected ? {
        background: accentBg,
        border: `2px solid ${accentBorder}`,
      } : {
        background: 'rgba(255,255,255,0.04)',
        border: '2px solid rgba(255,255,255,0.08)',
      }}>
      {/* Check flotante cuando está seleccionado */}
      {selected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: accent }}>
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </div>
      )}
      {/* Avatar */}
      <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center mb-2 shrink-0"
        style={{
          background: onDuty
            ? (selected ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.06)')
            : 'linear-gradient(135deg, #FF4FA2, #e6368a)',
          border: `2px solid ${selected ? accentBorder : 'rgba(255,255,255,0.1)'}`,
        }}>
        {onDuty ? (
          <Crown className="w-6 h-6" style={{ color: selected ? '#D4AF37' : 'rgba(255,255,255,0.4)' }} />
        ) : photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl font-bold text-white">{name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <p className="font-semibold text-xs leading-tight line-clamp-2"
        style={{ color: selected ? (onDuty ? '#D4AF37' : '#fff') : 'rgba(255,255,255,0.85)' }}>
        {name}
      </p>
      {subtitle && (
        <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {subtitle}
        </p>
      )}
    </button>
  );
}

// ══════════════════════════════════════════════════════════
// STEP 2 — Asignación de estilista por servicio
// ══════════════════════════════════════════════════════════
function StaffAssignmentStep({
  selectedServices, assignments, onAssign, onNext, onBack, packageInfo, modifierSelections,
}: {
  selectedServices: Service[];
  assignments: Assignment[];
  onAssign: (service: Service, staff: Staff | null, onDuty: boolean) => void;
  onNext: () => void;
  onBack: () => void;
  packageInfo: PackageBookable | null;
  modifierSelections?: Record<string, Selections>;
}) {
  const [staffByService, setStaffByService] = useState<Map<string, Staff[]>>(new Map());
  const [loadingMap, setLoadingMap]         = useState<Record<string, boolean>>({});

  const serviceIds = selectedServices.map(s => s.id).join(',');
  useEffect(() => {
    selectedServices.forEach(service => {
      const sid = service.id;
      setLoadingMap(prev => ({ ...prev, [sid]: true }));
      api.staff.byService(sid)
        .then(data => {
          setStaffByService(prev => new Map(prev).set(sid, data as unknown as Staff[]));
          if (!assignments.find(a => a.service.id === sid)) {
            onAssign(service, null, true);
          }
        })
        .catch(() => {
          setStaffByService(prev => new Map(prev).set(sid, []));
          if (!assignments.find(a => a.service.id === sid)) {
            onAssign(service, null, true);
          }
        })
        .finally(() => setLoadingMap(prev => ({ ...prev, [sid]: false })));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceIds]);

  const getAsgn     = (sid: string) => assignments.find(a => a.service.id === sid);
  const allAssigned = selectedServices.every(s => !!getAsgn(s.id));
  // Usa effectivePricing para incluir el impacto de los modificadores
  const totalAmt    = totalWithPackage(selectedServices, packageInfo, modifierSelections);
  const totalMin    = selectedServices.reduce(
    (a, s) => a + effectivePricing(s, modifierSelections?.[s.id]).duration,
    0,
  );

  return (
    <div>
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-medium mb-5 transition-colors"
        style={{ color: 'rgba(255,255,255,0.4)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FF4FA2'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}>
        <ChevronLeft className="w-4 h-4" /> Cambiar servicios
      </button>

      <div className="rounded-xl px-4 py-3 mb-6 flex items-center justify-between"
        style={{ background: 'rgba(255,79,162,0.08)', border: '1px solid rgba(255,79,162,0.2)' }}>
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 shrink-0" style={{ color: '#FF4FA2' }} />
          <span className="text-xs font-medium text-white">
            {selectedServices.length} servicio{selectedServices.length > 1 ? 's' : ''} · {totalMin} min
          </span>
        </div>
        <span className="text-sm font-bold" style={{ color: '#D4AF37' }}>S/ {totalAmt.toFixed(2)}</span>
      </div>

      <h3 className="font-display font-bold italic text-2xl text-white mb-1">Elige tu estilista</h3>
      <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Asigna una especialista para cada servicio
      </p>

      <div className="space-y-8">
        {selectedServices.map(service => {
          const sid    = service.id;
          const asgn   = getAsgn(sid);
          const staff  = staffByService.get(sid) || [];
          const isLoad = loadingMap[sid];

          const eff = effectivePricing(service, modifierSelections?.[service.id]);
          const hasModImpact = eff.duration !== (service.duration || 0) || eff.pricePen !== (Number(service.pricePen) || 0);

          return (
            <div key={sid}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1.5 h-4 rounded-full shrink-0" style={{ background: 'linear-gradient(180deg, #FF4FA2, #e6368a)' }} />
                  <span className="font-bold text-sm text-white truncate">{service.name}</span>
                  {hasModImpact && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: 'rgba(255,79,162,0.18)', color: '#FF4FA2', border: '1px solid rgba(255,79,162,0.3)' }}>
                      ✨ Personalizado
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Clock className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.35)' }} />
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{eff.duration} min</span>
                  <span className="text-xs font-bold" style={{ color: hasModImpact ? '#FF4FA2' : 'rgba(255,255,255,0.6)' }}>
                    · S/ {eff.pricePen.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Fila horizontal deslizable de estilistas (estilo app nativa) */}
              {isLoad ? (
                <div className="flex gap-3">
                  {[1, 2, 3].map(i => <div key={i} className="w-28 h-36 rounded-2xl skeleton-dark shrink-0" />)}
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
                  {/* Card: Estilista de turno (siempre primera) */}
                  <StylistCard
                    selected={!!asgn?.onDuty}
                    name="Estilista de turno"
                    subtitle="Quien esté disponible"
                    onClick={() => onAssign(service, null, true)}
                    onDuty
                  />
                  {/* Cards de estilistas específicas */}
                  {staff.map(s => (
                    <StylistCard
                      key={s.id}
                      selected={asgn?.staff?.id === s.id}
                      name={s.name}
                      subtitle={s.role || (s.bio as string | undefined) || ''}
                      photoUrl={s.photoUrl as string | undefined}
                      onClick={() => onAssign(service, s, false)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl p-3.5 text-xs"
        style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', color: 'rgba(212,175,55,0.8)' }}>
        <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
        Si eliges "Estilista de turno", el salón asignará a quien esté disponible y te confirmará por WhatsApp.
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onBack}
          className="flex-1 py-3.5 rounded-full font-semibold text-sm transition-all"
          style={{ border: '1.5px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>
          Atrás
        </button>
        <button onClick={onNext} disabled={!allAssigned}
          className="flex-1 py-3.5 rounded-full font-bold text-sm text-white transition-all active:scale-95 disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)', boxShadow: allAssigned ? '0 4px 16px rgba(255,79,162,0.4)' : 'none' }}>
          Continuar
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// STEP 3 — Fecha y hora
// ══════════════════════════════════════════════════════════
function SlotStep({
  assignments, date, slot,
  onDateChange, onSlotSelect, onNext, onBack,
  timerExpiredError, onClearError,
  packageInfo, trialEnabled, advanceDates, setAdvanceDates,
  modifierSelections,
}: {
  assignments: Assignment[];
  date: string; slot: Slot | null;
  onDateChange: (d: string) => void;
  onSlotSelect: (s: Slot | null) => void;
  onNext: () => void; onBack: () => void;
  timerExpiredError?: string;
  onClearError?: () => void;
  packageInfo: PackageBookable | null;
  trialEnabled: boolean;
  advanceDates: Record<number, { date: string; startTime?: string }>;
  setAdvanceDates: (v: Record<number, { date: string; startTime?: string }>) => void;
  modifierSelections?: Record<string, Selections>;
}) {
  const [slots, setSlots]               = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const today    = new Date().toISOString().split('T')[0];
  const totalAmt = totalWithPackage(assignments.map(a => a.service), packageInfo, modifierSelections) +
                   (trialEnabled && packageInfo?.trialAddon ? packageInfo.trialAddon.extraPricePen : 0);
  const totalMin = assignments.reduce(
    (acc, a) => acc + effectivePricing(a.service, modifierSelections?.[a.service.id]).duration,
    0,
  );

  // Detectar grupos de anticipación (servicios con daysBeforeMain > 0)
  const advanceGroups = (() => {
    const map = new Map<number, { label: string; services: string[] }>();
    if (packageInfo) {
      for (const bs of packageInfo.bookableServices) {
        const dbm = bs.daysBeforeMain ?? 0;
        if (dbm <= 0) continue;
        const g = map.get(dbm) || { label: '', services: [] };
        if (!g.services.includes(bs.name)) g.services.push(bs.name);
        g.label = `Mínimo ${dbm} día${dbm > 1 ? 's' : ''} antes`;
        map.set(dbm, g);
      }
      if (trialEnabled && packageInfo.trialAddon && (packageInfo.trialAddon.daysBeforeMain || 0) > 0) {
        const dbm = packageInfo.trialAddon.daysBeforeMain!;
        const g = map.get(dbm) || { label: '', services: [] };
        if (!g.services.includes(packageInfo.trialAddon.name)) g.services.push(packageInfo.trialAddon.name);
        g.label = `Mínimo ${dbm} día${dbm > 1 ? 's' : ''} antes`;
        map.set(dbm, g);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]); // mayor anticipación primero
  })();

  // Fecha máxima permitida por cada grupo: selectedDate - dbm
  function maxDateForGroup(dbm: number) {
    if (!date) return today;
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - dbm);
    return d.toISOString().slice(0, 10);
  }

  // Validación: todas las fechas anticipadas deben estar fijadas
  const allAdvanceFilled = advanceGroups.every(([dbm]) => !!advanceDates[dbm]?.date);

  async function loadSlots(d: string) {
    onDateChange(d);
    onSlotSelect(null);
    setLoadingSlots(true);
    try {
      const data = await computeAvailableSlots(assignments, d, !!packageInfo, modifierSelections);
      setSlots(data);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  function updateAdvanceDate(dbm: number, patch: { date?: string; startTime?: string }) {
    const next = { ...advanceDates };
    next[dbm] = { ...(next[dbm] || { date: '' }), ...patch };
    setAdvanceDates(next);
  }

  // Mínima fecha central permitida considerando la anticipación máxima requerida.
  // Ej. si hay un servicio con daysBeforeMain=15, la fecha central debe ser ≥ hoy+15.
  const maxAdvanceDays = advanceGroups.reduce((m, [d]) => Math.max(m, d), 0);
  const minCentralDate = (() => {
    if (maxAdvanceDays === 0) return today;
    const d = new Date(today + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + maxAdvanceDays);
    return d.toISOString().slice(0, 10);
  })();
  // ¿La fecha elegida es demasiado pronto para las anticipaciones requeridas?
  const centralTooSoon = !!date && maxAdvanceDays > 0 && date < minCentralDate;
  // Fecha formateada para mostrar al cliente
  const fmtFriendly = (iso: string) => {
    if (!iso) return '';
    const [, mo, dd] = iso.split('-').map(Number);
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return `${dd} de ${months[mo - 1]}`;
  };

  return (
    <div>
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-medium mb-5 transition-colors"
        style={{ color: 'rgba(255,255,255,0.4)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FF4FA2'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}>
        <ChevronLeft className="w-4 h-4" /> Cambiar estilista
      </button>

      {/* Timer expired warning */}
      {timerExpiredError && (
        <div className="mb-4 p-3.5 rounded-xl flex items-center gap-2.5 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
          <Timer className="w-4 h-4 shrink-0" />
          <span>{timerExpiredError}</span>
          {onClearError && (
            <button onClick={onClearError} className="ml-auto shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <div className="rounded-xl px-4 py-3 mb-6 flex items-center justify-between"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 shrink-0" style={{ color: '#FF4FA2' }} />
          <span className="text-xs font-medium text-white">
            {assignments.length} servicio{assignments.length > 1 ? 's' : ''} · {totalMin} min
          </span>
        </div>
        <span className="text-sm font-bold" style={{ color: '#D4AF37' }}>S/ {totalAmt.toFixed(2)}</span>
      </div>

      <h3 className="font-display font-bold italic text-2xl text-white mb-1">Elige fecha y hora</h3>
      <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Cita de aprox. <span className="text-white font-semibold">{totalMin} minutos</span>
      </p>

      {/* PASO 1 — Día central */}
      {advanceGroups.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: '#FF4FA2' }}>1</div>
            <p className="text-xs uppercase tracking-wider font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>
              🌟 Día central
            </p>
          </div>
          {/* Aviso sobre la fecha mínima */}
          {maxAdvanceDays > 0 && (
            <div className="mb-3 rounded-xl p-3 text-xs"
              style={{ background: centralTooSoon ? 'rgba(239,68,68,0.08)' : 'rgba(212,175,55,0.06)',
                       border: `1px solid ${centralTooSoon ? 'rgba(239,68,68,0.3)' : 'rgba(212,175,55,0.25)'}`,
                       color: centralTooSoon ? '#fca5a5' : 'rgba(255,255,255,0.7)' }}>
              {centralTooSoon ? (
                <>
                  <strong>⚠️ Fecha demasiado pronto.</strong> Tu paquete incluye servicios que se hacen <strong>{maxAdvanceDays} día{maxAdvanceDays > 1 ? 's' : ''} antes</strong>. La fecha central más temprana disponible es <strong>{fmtFriendly(minCentralDate)}</strong>.
                </>
              ) : (
                <>
                  <strong>ℹ️ Anticipación requerida:</strong> Tu paquete incluye servicios que se hacen mínimo <strong>{maxAdvanceDays} día{maxAdvanceDays > 1 ? 's' : ''} antes</strong>. Elige una fecha central desde <strong>{fmtFriendly(minCentralDate)}</strong> en adelante.
                </>
              )}
            </div>
          )}
        </>
      )}

      <div className="mb-6">
        <BookingCalendar value={date} onChange={loadSlots} minDate={minCentralDate} />
      </div>

      {loadingSlots && (
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-11 rounded-xl skeleton-dark" />
          ))}
        </div>
      )}
      {!loadingSlots && date && slots.length === 0 && (
        <div className="text-center py-10">
          <CalendarDays className="w-10 h-10 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No hay horarios disponibles este día</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>Prueba con otra fecha</p>
        </div>
      )}
      {!loadingSlots && slots.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {slots.length} horario{slots.length !== 1 ? 's' : ''} disponible{slots.length !== 1 ? 's' : ''}
          </p>
          <div className="flex justify-center">
            <TimeList
              slots={slots}
              value={slot?.start ?? null}
              theme="dark"
              onSelect={(start, end) => onSlotSelect({ start, end: end ?? '' })}
            />
          </div>
        </div>
      )}

      {/* PASO 2 — Fechas anticipadas (después del día central) */}
      {advanceGroups.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: slot ? '#FF4FA2' : 'rgba(255,255,255,0.2)' }}>2</div>
            <p className="text-xs uppercase tracking-wider font-bold" style={{ color: slot ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)' }}>
              ⏰ Fechas adicionales
            </p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.25)', opacity: slot ? 1 : 0.5 }}>
            <p className="text-[11px] mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {slot
                ? 'Estos servicios deben reservarse antes del día central.'
                : 'Primero elige fecha y hora del día central arriba.'}
            </p>
            {advanceGroups.map(([dbm, g]) => {
              const maxD = date ? maxDateForGroup(dbm) : '';
              const cur = advanceDates[dbm] || { date: '', startTime: '10:00' };
              return (
                <div key={dbm} className="rounded-xl p-3 mb-2 last:mb-0" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-sm font-semibold text-white">{g.services.join(' + ')}</p>
                    <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#D4AF37' }}>{g.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <DateTimePicker
                      mode="date"
                      theme="dark"
                      minDate={today}
                      maxDate={maxD || undefined}
                      disabled={!slot}
                      value={cur.date || null}
                      onChange={(d) => updateAdvanceDate(dbm, { date: d })}
                    />
                    <DateTimePicker
                      mode="time"
                      theme="dark"
                      minuteStep={30}
                      disabled={!cur.date}
                      value={cur.startTime || '10:00'}
                      onChange={(time) => updateAdvanceDate(dbm, { startTime: time })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-8">
        <button onClick={onBack}
          className="flex-1 py-3.5 rounded-full font-semibold text-sm transition-all"
          style={{ border: '1.5px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>
          Atrás
        </button>
        <button onClick={onNext} disabled={!slot || !allAdvanceFilled}
          className="flex-1 py-3.5 rounded-full font-bold text-sm text-white transition-all active:scale-95 disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)', boxShadow: slot && allAdvanceFilled ? '0 4px 16px rgba(255,79,162,0.4)' : 'none' }}
          title={!allAdvanceFilled ? 'Completa las fechas anticipadas' : ''}>
          Continuar
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// STEP 4 — Confirmación premium
// ══════════════════════════════════════════════════════════
function ConfirmStep({
  assignments, date, slot,
  guestInfo, setGuestInfo,
  atHome, setAtHome, atHomeAddress, setAtHomeAddress,
  atHomeDistrict, setAtHomeDistrict,
  atHomeEnabled,
  loading, error, timerLeft, onBack, onConfirm,
  packageInfo, trialEnabled,
  modifierSelections,
}: {
  assignments: Assignment[];
  date: string; slot: Slot | null;
  guestInfo: GuestInfo; setGuestInfo: (v: GuestInfo) => void;
  atHome: boolean; setAtHome: (v: boolean) => void;
  atHomeAddress: string; setAtHomeAddress: (v: string) => void;
  atHomeDistrict: string; setAtHomeDistrict: (v: string) => void;
  atHomeEnabled: boolean;
  loading: boolean; error: string; timerLeft: number | null; onBack: () => void; onConfirm: () => void;
  packageInfo: PackageBookable | null;
  trialEnabled: boolean;
  modifierSelections?: Record<string, Selections>;
}) {
  const field = (k: keyof GuestInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setGuestInfo({ ...guestInfo, [k]: e.target.value });

  const services   = assignments.map(a => a.service);
  const extra      = atHome ? atHomeExtra(atHomeDistrict) : 0;
  const trialExtra = (trialEnabled && packageInfo?.trialAddon) ? packageInfo.trialAddon.extraPricePen : 0;
  const subtotal   = totalWithPackage(services, packageInfo, modifierSelections) + trialExtra;
  const total      = subtotal + extra;
  const endTime    = slot?.start ? computeDisplayEnd(assignments, slot.start, modifierSelections) : '';
  const hasOnDuty  = assignments.some(a => a.onDuty);

  const phoneDigits   = guestInfo.phone.replace(/\D/g, '');
  const phoneValid    = phoneDigits.length === 9;
  const phoneTouched  = guestInfo.phone.trim().length > 0;
  const phoneError    = phoneTouched && !phoneValid;

  const emailValid   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestInfo.email.trim());
  const emailTouched = guestInfo.email.trim().length > 0;
  const emailError   = emailTouched && !emailValid;

  const canSubmit = guestInfo.name.trim() && phoneValid && emailValid
    && (!atHome || atHomeAddress.trim()) && !loading;

  return (
    <div>
      {/* Header row: title + timer */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: 'rgba(255,255,255,0.4)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FF4FA2'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}>
          <ChevronLeft className="w-4 h-4" /> Cambiar horario
        </button>
        {timerLeft !== null && timerLeft > 0 && <TimerBadge seconds={timerLeft} />}
      </div>

      <h3 className="font-display font-bold italic text-2xl text-white mb-6">Confirma tu reserva</h3>

      {/* Order summary */}
      <div className="rounded-2xl overflow-hidden mb-5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
        <div className="px-5 py-3.5 flex items-center gap-2.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,79,162,0.06)' }}>
          <Sparkles className="w-4 h-4 shrink-0" style={{ color: '#FF4FA2' }} />
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#FF4FA2' }}>
            Resumen de tu cita
          </p>
        </div>

        <div className="px-5 pt-4 pb-5 space-y-4">
          <div className="space-y-2.5">
            {packageInfo ? (
              <>
                {/* Línea del paquete (precio fijo) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Crown className="w-3.5 h-3.5 shrink-0" style={{ color: '#D4AF37' }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{packageInfo.name}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {packageInfo.bookableServices.length} servicio{packageInfo.bookableServices.length !== 1 ? 's' : ''} incluido{packageInfo.bookableServices.length !== 1 ? 's' : ''}
                        {packageInfo.groupLabel && ` · ${packageInfo.groupLabel}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-white shrink-0 ml-2">
                    S/ {Number(packageInfo.pricePen).toFixed(2)}
                  </span>
                </div>
                {/* Detalle de servicios del paquete con su estilista (sin precio individual) */}
                {assignments
                  .filter(({ service }) => packageInfo.bookableServices.some(b => b.serviceId === service.id))
                  .map(({ service, staff, onDuty }) => (
                    <div key={service.id} className="flex items-center pl-5">
                      <div className="w-1 h-1 rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.3)' }} />
                      <p className="text-[11px] ml-2 truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {service.name}
                        <span className="mx-1.5 opacity-50">·</span>
                        <span style={{ color: onDuty ? '#D4AF37' : 'rgba(255,255,255,0.7)' }}>
                          {onDuty ? 'turno' : staff?.name}
                        </span>
                      </p>
                    </div>
                  ))}
                {/* Trial addon como línea aparte */}
                {trialEnabled && packageInfo.trialAddon && (
                  <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: '#FF4FA2' }} />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{packageInfo.trialAddon.name}</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {(() => {
                            const a = assignments.find(x => x.service.id === packageInfo.trialAddon!.serviceId);
                            return a?.onDuty ? '✦ Estilista de turno' : (a?.staff?.name || '—');
                          })()}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold shrink-0 ml-2" style={{ color: '#FF4FA2' }}>
                      +S/ {trialExtra.toFixed(2)}
                    </span>
                  </div>
                )}
                {/* Extras (servicios no incluidos en el paquete ni en el trial) */}
                {assignments
                  .filter(({ service }) =>
                    !packageInfo.bookableServices.some(b => b.serviceId === service.id) &&
                    service.id !== packageInfo.trialAddon?.serviceId
                  )
                  .map(({ service, staff, onDuty }) => (
                    <div key={service.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Plus className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }} />
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{service.name}</p>
                          <p className="text-xs" style={{ color: onDuty ? '#D4AF37' : 'rgba(255,255,255,0.4)' }}>
                            {onDuty ? '✦ Estilista de turno' : staff?.name}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-white shrink-0 ml-2">
                        S/ {Number(service.pricePen).toFixed(2)}
                      </span>
                    </div>
                  ))}
              </>
            ) : (
              assignments.map(({ service, staff, onDuty }) => {
                const sel = modifierSelections?.[service.id];
                const eff = effectivePricing(service, sel);
                const groups = (service as Service & { modifierGroups?: ModifierGroup[] }).modifierGroups || [];
                const chosen: { label: string; delta: number }[] = [];
                if (sel && groups.length > 0) {
                  for (const g of groups) {
                    const gSel = sel[g.id];
                    if (!gSel) continue;
                    for (const optId of (gSel.optionIds || [])) {
                      const opt = g.options.find(o => o.id === optId);
                      if (opt) {
                        chosen.push({
                          label: `${g.name}: ${opt.label}`,
                          delta: Number(opt.modifierType === 'fixed' ? opt.modifierValue :
                                        opt.modifierType === 'percent' ? Number(service.pricePen) * Number(opt.modifierValue) / 100 :
                                        opt.modifierType === 'multiplier' ? Number(service.pricePen) * (Number(opt.modifierValue) - 1) :
                                        opt.modifierValue),
                        });
                      }
                    }
                  }
                }
                return (
                  <div key={service.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#FF4FA2' }} />
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{service.name}</p>
                          <p className="text-xs" style={{ color: onDuty ? '#D4AF37' : 'rgba(255,255,255,0.4)' }}>
                            {onDuty ? '✦ Estilista de turno' : staff?.name}
                            <span className="ml-2 opacity-60">{eff.duration}min</span>
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-white shrink-0 ml-2">
                        S/ {eff.pricePen.toFixed(2)}
                      </span>
                    </div>
                    {chosen.length > 0 && (
                      <div className="pl-5 space-y-0.5">
                        {chosen.map((c, i) => (
                          <p key={i} className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            <span>↳ {c.label}</span>
                            {c.delta !== 0 && (
                              <span className="ml-1 font-medium" style={{ color: '#FF4FA2' }}>
                                {c.delta > 0 ? '+' : ''}S/ {c.delta.toFixed(2)}
                              </span>
                            )}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div style={{ color: 'rgba(255,255,255,0.4)' }}>
              <CalendarDays className="w-3.5 h-3.5 inline mr-1.5" style={{ color: '#D4AF37' }} />
              {fmtDate(date)}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)' }}>
              <Clock className="w-3.5 h-3.5 inline mr-1.5" style={{ color: '#D4AF37' }} />
              {fmtRange12(slot?.start, endTime)}
            </div>
          </div>

          {atHome && (
            <>
              <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
              <div className="flex justify-between text-sm">
                <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                  🏠 Movilidad ({atHomeDistrict})
                </span>
                <span className="text-white font-medium">+S/ {extra.toFixed(2)}</span>
              </div>
            </>
          )}

          <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

          {(atHome || (packageInfo && trialExtra > 0)) && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>Subtotal</span>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>S/ {subtotal.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="font-bold text-white text-base">Total</span>
            <span className="font-bold text-xl" style={{ color: '#D4AF37' }}>S/ {total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {hasOnDuty && (
        <div className="rounded-xl p-3.5 mb-5 text-xs"
          style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)', color: 'rgba(212,175,55,0.85)' }}>
          <Crown className="w-3.5 h-3.5 inline mr-1.5" />
          <strong>Estilista de turno:</strong>
          <span style={{ color: 'rgba(255,255,255,0.55)' }}>
            {' '}El salón asignará a la estilista disponible. Te confirmaremos por WhatsApp.
          </span>
        </div>
      )}

      {/* At-home toggle */}
      {atHomeEnabled ? (
        <button type="button" onClick={() => setAtHome(!atHome)}
          className="w-full flex items-center justify-between p-4 rounded-2xl mb-5 transition-all duration-200"
          style={atHome ? {
            background: 'rgba(59,130,246,0.1)',
            border: '2px solid rgba(59,130,246,0.4)',
          } : {
            background: 'rgba(255,255,255,0.04)',
            border: '2px solid rgba(255,255,255,0.09)',
          }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏠</span>
            <div className="text-left">
              <p className="font-semibold text-sm text-white">Servicio a domicilio</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Viene a tu dirección en Lima (+S/ {atHomeExtra(atHomeDistrict).toFixed(2)} aprox.)
              </p>
            </div>
          </div>
          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all"
            style={atHome ? { background: '#3b82f6', border: '2px solid #3b82f6' } : { border: '2px solid rgba(255,255,255,0.25)' }}>
            {atHome && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
          </div>
        </button>
      ) : (
        <div className="w-full flex items-center gap-3 p-4 rounded-2xl mb-5 opacity-50 cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.03)', border: '2px solid rgba(255,255,255,0.07)' }}>
          <span className="text-2xl">🏠</span>
          <div className="text-left">
            <p className="font-semibold text-sm text-white">Servicio a domicilio</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,79,162,0.7)' }}>
              No disponible actualmente
            </p>
          </div>
        </div>
      )}

      {atHome && (
        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-white">
              Dirección completa <span style={{ color: '#FF4FA2' }}>*</span>
            </label>
            <input type="text" placeholder="Av. Principal 123, Dpto 4B…"
              value={atHomeAddress} onChange={e => setAtHomeAddress(e.target.value)}
              className="input-dark" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-white">Distrito</label>
            <select value={atHomeDistrict} onChange={e => setAtHomeDistrict(e.target.value)}
              className="select-dark text-sm">
              {LIMA_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="rounded-xl p-3 text-xs"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: 'rgba(147,197,253,0.9)' }}>
            <MapPin className="w-3.5 h-3.5 inline mr-1.5" />
            Recargo estimado: <span className="font-bold">S/ {atHomeExtra(atHomeDistrict).toFixed(2)}</span>
            <span className="ml-1 opacity-70">— el costo final se confirma al reservar.</span>
          </div>
        </div>
      )}

      <h4 className="font-poppins font-bold text-base text-white mb-4">Datos de contacto</h4>
      <div className="space-y-3 mb-6">
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-white">
            Nombre completo <span style={{ color: '#FF4FA2' }}>*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <input type="text" placeholder="¿Cómo te llamas?"
              value={guestInfo.name} onChange={field('name')}
              className="input-dark pl-10" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-white">
            WhatsApp / Teléfono <span style={{ color: '#FF4FA2' }}>*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <input type="tel" placeholder="9XX XXX XXX"
              value={guestInfo.phone} onChange={field('phone')}
              className="input-dark pl-10"
              style={phoneError ? { borderColor: 'rgba(239,68,68,0.6)' } : undefined} />
          </div>
          {phoneError && (
            <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>
              Ingresa un número de celular válido (9 dígitos, ej: 987654321)
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-white">
            Email <span style={{ color: '#FF4FA2' }}>*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <input type="email" placeholder="Para enviarte la confirmación"
              value={guestInfo.email} onChange={field('email')}
              className="input-dark pl-10"
              style={emailError ? { borderColor: 'rgba(239,68,68,0.6)' } : undefined} />
          </div>
          {emailError && (
            <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>
              Ingresa un correo electrónico válido
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-xl flex items-center gap-2.5 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
          <X className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack}
          className="flex-1 py-3.5 rounded-full font-semibold text-sm transition-all"
          style={{ border: '1.5px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>
          Atrás
        </button>
        <button onClick={onConfirm} disabled={!canSubmit}
          className="flex-1 py-3.5 rounded-full font-bold text-sm text-white transition-all duration-200 active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)', boxShadow: canSubmit ? '0 4px 20px rgba(255,79,162,0.45)' : 'none' }}>
          {loading
            ? <><Spinner small /> Reservando…</>
            : <><CalendarCheck className="w-4 h-4" /> Confirmar cita</>}
        </button>
      </div>

      <p className="text-center text-xs mt-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
        Al confirmar aceptas que te contactemos por WhatsApp
      </p>
    </div>
  );
}
