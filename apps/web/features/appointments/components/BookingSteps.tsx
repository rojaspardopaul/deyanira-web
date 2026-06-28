'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import {
  Check, Clock, ChevronLeft, ChevronDown, CalendarDays, Scissors, User,
  ShoppingBag, Sparkles,
  MapPin, Phone, Mail, CalendarCheck, ChevronRight, Trash2, Crown, Plus, Timer, X, Info, Car,
} from 'lucide-react';
import BookingCalendar from '@/components/ui/BookingCalendar';
import DateTimePicker from '@/components/ui/datetime';
import TimeList from '@/components/ui/datetime/TimeList';
import Select from '@/components/ui/Select';
import ServiceOptionsForm from '@/components/booking/ServiceOptionsForm';
import CatalogOptionsButton from '@/components/catalog/CatalogOptionsButton';

// Modales pesados cargados bajo demanda (solo al abrirlos) → aligeran el bundle inicial de /reservar.
const CatalogPreviewModal = dynamic(
  () => import('@/components/catalog/CatalogPreviewModal').then((m) => m.CatalogPreviewModal),
  { ssr: false },
);
const AddServiceModal = dynamic(() => import('@/components/booking/AddServiceModal'), { ssr: false });
import { fmtRange12 } from '@/lib/time';
import { LIMA_DISTRICTS } from '@/lib/districts';
import {
  type Selections, type ModifierGroup, type ServiceForPricing,
} from '@/lib/pricing';
import type {
  Service, Staff, Category, Slot, GuestInfo, Step, Assignment,
} from '@/features/appointments/types/booking.types';
import {
  effectivePricing, hasIncompleteModifiers, totalWithPackage,
  fmtDate, atHomeExtra, computeDisplayEnd, computeAvailableSlots,
} from '@/features/appointments/utils/booking';

// ── Types ──────────────────────────────────────────────────
// Tipos en @/features/appointments/types/booking.types (importados arriba).

// ── Helpers ─────────────────────────────────────────────────
// Helpers en @/features/appointments/utils/booking (importados arriba).



export const STEPS = [
  { label: 'Servicios', icon: Scissors },
  { label: 'Estilista', icon: User },
  { label: 'Horario',   icon: CalendarDays },
  { label: 'Confirmar', icon: Check },
];

// LIMA_DISTRICTS vive en @/lib/districts (fuente única) — importado arriba y
// re-exportado aquí por compatibilidad con quien ya lo importaba de este módulo.
export { LIMA_DISTRICTS } from '@/lib/districts';

export const BOOKING_TIMER_SEC = 10 * 60; // fallback: 10 minutes

// ── Spinner ────────────────────────────────────────────────
export function Spinner({ small }: { small?: boolean }) {
  const sz = small ? 'w-4 h-4 border' : 'w-8 h-8 border-2';
  return (
    <svg className={`${sz} animate-spin rounded-full`}
      style={{ borderColor: 'rgba(255,79,162,0.2)', borderTopColor: '#FF4FA2' }}
      viewBox="0 0 24 24" />
  );
}

// ── Step progress bar ──────────────────────────────────────
export function StepBar({ step, onGoTo }: { step: Step; onGoTo: (n: Step) => void }) {
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
export function PackageBanner({ pkg, onClear }: { pkg: PackageBookable; onClear: () => void }) {
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
export function PackageCard({
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
export function ServicesSummaryBar({ services, onNext, packageInfo, trialEnabled, modifierSelections }: {
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
export function TimerBadge({ seconds }: { seconds: number }) {
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
export type PackageBookable = {
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

export function CategoryChips({ categories, active, onChange }: {
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
export function ServiceStep({
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
            return (
              <ServiceCard
                key={s.id}
                service={s}
                active={active}
                onToggle={onToggle}
                catalogSlug={s.catalogSlug || null}
              />
            );
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
                catalogSlug={(fullSvc.catalogSlug ?? s.catalogSlug) || null}
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
export function ServiceModifierBlock({
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
export function ServiceCard({ service: s, active, onToggle, showRemove, effectivePrice, effectiveDuration, referential, catalogSlug }: {
  service: Service; active: boolean; onToggle: (s: Service) => void; showRemove?: boolean;
  // Precio/duración efectivos (con modificadores). Si no se pasan, usa los base.
  effectivePrice?: number; effectiveDuration?: number; referential?: boolean;
  // Si el servicio tiene catálogo asociado, muestra el ícono "Ver opciones" junto al nombre.
  catalogSlug?: string | null;
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
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm text-white leading-tight">{s.name}</p>
            {catalogSlug && <CatalogOptionsButton slug={catalogSlug} tone="dark" />}
          </div>
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
export function StylistCard({
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
export function StaffAssignmentStep({
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
export function SlotStep({
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
  const [advanceSlots, setAdvanceSlots]     = useState<Record<number, Slot[]>>({});
  const [advanceLoading, setAdvanceLoading] = useState<Record<number, boolean>>({});
  const today    = new Date().toISOString().split('T')[0];
  const totalAmt = totalWithPackage(assignments.map(a => a.service), packageInfo, modifierSelections) +
                   (trialEnabled && packageInfo?.trialAddon ? packageInfo.trialAddon.extraPricePen : 0);
  const totalMin = assignments.reduce(
    (acc, a) => acc + effectivePricing(a.service, modifierSelections?.[a.service.id]).duration,
    0,
  );

  // Detectar grupos de anticipación (servicios con daysBeforeMain > 0). Cada grupo
  // guarda sus `items` (serviceId + duración) para calcular su disponibilidad real.
  const advanceGroups = useMemo(() => {
    type Grupo = { label: string; services: string[]; items: Array<{ serviceId: string; duration: number }> };
    const map = new Map<number, Grupo>();
    const add = (dbm: number, name: string, serviceId: string, duration: number) => {
      const g = map.get(dbm) || { label: '', services: [], items: [] };
      if (!g.services.includes(name)) g.services.push(name);
      if (!g.items.some(x => x.serviceId === serviceId)) g.items.push({ serviceId, duration });
      g.label = `Mínimo ${dbm} día${dbm > 1 ? 's' : ''} antes`;
      map.set(dbm, g);
    };
    if (packageInfo) {
      for (const bs of packageInfo.bookableServices) {
        const dbm = bs.daysBeforeMain ?? 0;
        if (dbm > 0) add(dbm, bs.name, bs.serviceId, bs.duration);
      }
      const ta = packageInfo.trialAddon;
      if (trialEnabled && ta && (ta.daysBeforeMain || 0) > 0) {
        add(ta.daysBeforeMain!, ta.name, ta.serviceId, ta.duration);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]); // mayor anticipación primero
  }, [packageInfo, trialEnabled]);

  // Fecha máxima permitida por cada grupo: selectedDate - dbm
  function maxDateForGroup(dbm: number) {
    if (!date) return today;
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - dbm);
    return d.toISOString().slice(0, 10);
  }

  // Validación: cada fecha anticipada debe tener fecha Y hora (disponible) fijadas
  const allAdvanceFilled = advanceGroups.every(([dbm]) => !!advanceDates[dbm]?.date && !!advanceDates[dbm]?.startTime);

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

  // Disponibilidad REAL por fecha adicional: mismos slots del backend que el día
  // central. Se calcula con los servicios del grupo como "de turno" (staff null).
  async function loadAdvanceSlots(dbm: number, d: string, items: Array<{ serviceId: string; duration: number }>) {
    setAdvanceLoading(prev => ({ ...prev, [dbm]: true }));
    try {
      const pseudo: Assignment[] = items.map(it => ({
        service: { id: it.serviceId, name: '', duration: it.duration, pricePen: 0 } as Service,
        staff: null,
        onDuty: true,
      }));
      const data = await computeAvailableSlots(pseudo, d, true, modifierSelections);
      setAdvanceSlots(prev => ({ ...prev, [dbm]: data }));
    } catch {
      setAdvanceSlots(prev => ({ ...prev, [dbm]: [] }));
    } finally {
      setAdvanceLoading(prev => ({ ...prev, [dbm]: false }));
    }
  }

  // Carga inicial / al volver atrás: si una fecha adicional ya está fijada pero aún
  // no tiene slots calculados, los pide (el cambio de fecha los recarga aparte).
  useEffect(() => {
    for (const [dbm, g] of advanceGroups) {
      const d = advanceDates[dbm]?.date;
      if (d && advanceSlots[dbm] === undefined && !advanceLoading[dbm]) {
        loadAdvanceSlots(dbm, d, g.items);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceGroups, advanceDates]);

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
              const cur = advanceDates[dbm] || { date: '', startTime: undefined };
              return (
                <div key={dbm} className="rounded-xl p-3 sm:p-4 mb-3 last:mb-0" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-baseline justify-between mb-3 gap-2">
                    <p className="text-sm font-semibold text-white">{g.services.join(' + ')}</p>
                    <span className="text-[10px] uppercase tracking-wider font-bold shrink-0" style={{ color: '#D4AF37' }}>{g.label}</span>
                  </div>
                  {/* Mismo estilo que el selector principal: calendario INLINE (mes completo,
                      sin popover que se corte) y, debajo, la hora — apilados y responsivos. */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>Elige el día</p>
                      <DateTimePicker
                        mode="date"
                        variant="inline"
                        theme="dark"
                        minDate={today}
                        maxDate={maxD || undefined}
                        disabled={!slot}
                        value={cur.date || null}
                        onChange={(d) => { updateAdvanceDate(dbm, { date: d, startTime: undefined }); loadAdvanceSlots(dbm, d, g.items); }}
                      />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold mb-2" style={{ color: cur.date ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)' }}>Elige la hora</p>
                      {cur.date ? (
                        <div className="flex justify-center">
                          <TimeList
                            slots={advanceSlots[dbm] ?? []}
                            slotsLoading={advanceLoading[dbm]}
                            value={cur.startTime ?? null}
                            theme="dark"
                            onSelect={(start) => updateAdvanceDate(dbm, { startTime: start })}
                          />
                        </div>
                      ) : (
                        <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Primero elige el día.</p>
                      )}
                    </div>
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
export function ConfirmStep({
  assignments, date, slot,
  guestInfo, setGuestInfo,
  atHome, setAtHome, atHomeAddress, setAtHomeAddress,
  atHomeDistrict, setAtHomeDistrict,
  atHomeEnabled,
  clientPickup, setClientPickup, pickupDistricts,
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
  clientPickup: boolean; setClientPickup: (v: boolean) => void; pickupDistricts: string[];
  loading: boolean; error: string; timerLeft: number | null; onBack: () => void; onConfirm: () => void;
  packageInfo: PackageBookable | null;
  trialEnabled: boolean;
  modifierSelections?: Record<string, Selections>;
}) {
  const field = (k: keyof GuestInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setGuestInfo({ ...guestInfo, [k]: e.target.value });

  const services   = assignments.map(a => a.service);
  // "Recojo": el cliente lleva/devuelve a la estilista (sin recargo). Solo en distritos habilitados.
  const pickupAllowed = pickupDistricts.includes(atHomeDistrict);
  const pickupActive  = atHome && clientPickup && pickupAllowed;
  const extra      = atHome && !pickupActive ? atHomeExtra(atHomeDistrict) : 0;
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
    // translateZ(0): promueve el step a su propia capa de composición. Evita el
    // "ghost"/caja gris al expandir el bloque de domicilio en navegadores móviles
    // (MIUI/Xiaomi) que no repintan bien tras un reflow.
    <div style={{ transform: 'translateZ(0)' }}>
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
                  {pickupActive ? `🚗 Recojo a la estilista (${atHomeDistrict})` : `🏠 Movilidad (${atHomeDistrict})`}
                </span>
                <span className="text-white font-medium">{pickupActive ? 'Sin recargo' : `+S/ ${extra.toFixed(2)}`}</span>
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
            <Select
              theme="dark"
              value={atHomeDistrict}
              onChange={setAtHomeDistrict}
              options={LIMA_DISTRICTS}
              searchable
              ariaLabel="Distrito"
            />
          </div>
          {/* Opción: el cliente recoge a la estilista (sin recargo). Solo en distritos habilitados. */}
          {pickupAllowed && (
            <button
              type="button"
              onClick={() => setClientPickup(!clientPickup)}
              aria-pressed={clientPickup}
              className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl transition-all duration-200"
              style={clientPickup
                ? { background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.5)' }
                : { background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.09)' }}
            >
              <div className="flex items-center gap-3 text-left">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: clientPickup ? 'rgba(34,197,94,0.20)' : 'rgba(255,255,255,0.06)' }}>
                  <Car className="w-5 h-5" style={{ color: clientPickup ? '#4ade80' : 'rgba(255,255,255,0.6)' }} />
                </span>
                <div>
                  <p className="font-semibold text-sm text-white">
                    Yo recojo a la estilista <span style={{ color: '#4ade80' }}>(sin recargo)</span>
                  </p>
                  <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Pasas por ella al salón y la devuelves al mismo punto al terminar. No se cobra movilidad.
                  </p>
                </div>
              </div>
              <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={clientPickup ? { background: '#22c55e', border: '2px solid #22c55e' } : { border: '2px solid rgba(255,255,255,0.25)' }}>
                {clientPickup && <Check className="w-3 h-3 text-white" />}
              </span>
            </button>
          )}
          {pickupActive ? (
            <div className="rounded-xl p-3 text-xs"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: 'rgba(134,239,172,0.95)' }}>
              <Car className="w-3.5 h-3.5 inline mr-1.5" />
              <span className="font-bold">Sin recargo de movilidad.</span>
              <span className="ml-1 opacity-80">Recoges a la estilista en el salón y la devuelves al mismo punto.</span>
            </div>
          ) : (
            <div className="rounded-xl p-3 text-xs"
              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: 'rgba(147,197,253,0.9)' }}>
              <MapPin className="w-3.5 h-3.5 inline mr-1.5" />
              Recargo estimado: <span className="font-bold">S/ {atHomeExtra(atHomeDistrict).toFixed(2)}</span>
              <span className="ml-1 opacity-70">— el costo final se confirma al reservar.</span>
            </div>
          )}
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
