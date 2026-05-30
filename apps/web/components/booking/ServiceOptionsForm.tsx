'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, AlertCircle, Plus, Minus } from 'lucide-react';
import {
  calculatePrice, buildDefaultSelections, validateRequired,
  formatPricePen, formatPriceDelta, formatDuration,
  type ModifierGroup, type ModifierOption, type ServiceForPricing, type Selections,
} from '@/lib/pricing';

interface Props {
  service: ServiceForPricing & { name?: string; imageUrl?: string | null };
  value: Selections;
  onChange: (selections: Selections) => void;
  // Cuando true, muestra una pricing card sticky a la derecha (desktop)
  showStickyPrice?: boolean;
  // Mensajes de validación externos (ej. del servidor)
  externalErrors?: Array<{ groupId: string; name: string; error: string }>;
}

export default function ServiceOptionsForm({
  service, value, onChange, showStickyPrice = true, externalErrors = [],
}: Props) {
  const groups = service.modifierGroups || [];

  // Inicializa selecciones por defecto la primera vez que cambia el servicio
  const [hasInit, setHasInit] = useState(false);
  useEffect(() => {
    if (!hasInit && groups.length > 0 && Object.keys(value).length === 0) {
      onChange(buildDefaultSelections(groups));
      setHasInit(true);
    }
    if (hasInit && Object.keys(value).length === 0) {
      onChange(buildDefaultSelections(groups));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id]);

  const priced = useMemo(() => calculatePrice(service, value), [service, value]);
  const localErrors = useMemo(() => validateRequired(service, value), [service, value]);
  const allErrors = [...externalErrors, ...localErrors];

  function setGroup(groupId: string, sel: Selections[string]) {
    onChange({ ...value, [groupId]: sel });
  }

  // Si no hay grupos, no mostramos nada (el wizard avanza directo)
  if (groups.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        <Check className="w-6 h-6 mx-auto mb-2 text-green-500" />
        Este servicio no tiene opciones adicionales.
        <p className="mt-2 text-lg font-semibold text-gray-900">
          {formatPricePen(priced.totalPrice)} · {formatDuration(priced.totalDuration)}
        </p>
      </div>
    );
  }

  return (
    <div className={`grid gap-6 min-w-0 ${showStickyPrice ? 'lg:grid-cols-[1fr,300px]' : ''}`}>
      <div className="space-y-5 min-w-0">
        {groups.map((g) => {
          const error = allErrors.find((e) => e.groupId === g.id);
          return (
            <FieldRenderer
              key={g.id}
              group={g}
              selection={value[g.id]}
              onChange={(s) => setGroup(g.id, s)}
              error={error?.error}
            />
          );
        })}

        {priced.blocked && (
          <div className="rounded-xl p-3 flex items-start gap-2"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#f87171' }} />
            <div className="text-sm" style={{ color: '#fca5a5' }}>
              <p className="font-semibold">No se puede reservar esta combinación</p>
              <ul className="list-disc list-inside text-xs mt-1">
                {priced.blockedReasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          </div>
        )}

        {priced.requiresLeadDays != null && (
          <div className="rounded-xl p-3 text-sm"
            style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', color: '#e7c86b' }}>
            ⏰ Este servicio requiere reservar al menos <strong>{priced.requiresLeadDays} días</strong> antes.
          </div>
        )}
      </div>

      {showStickyPrice && (
        <aside className="lg:sticky lg:top-4 self-start">
          <PricingCard service={service} priced={priced} />
        </aside>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PRICING CARD (sticky)
// ─────────────────────────────────────────────────────────────

function PricingCard({
  service, priced,
}: {
  service: ServiceForPricing & { name?: string };
  priced: ReturnType<typeof calculatePrice>;
}) {
  const hasMods = priced.breakdown.length > 0;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-br from-primary-50 to-primary-100/40 p-4 border-b border-gray-100">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-primary-700 mb-1">
          Tu reserva
        </p>
        {service.name && (
          <p className="text-sm font-semibold text-gray-900 line-clamp-2">{service.name}</p>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Precio base</span>
          <span className="text-gray-900 font-medium">{formatPricePen(priced.basePrice)}</span>
        </div>
        {hasMods && (
          <div className="space-y-1.5 border-t border-gray-100 pt-2">
            {priced.breakdown.map((b, i) => (
              <div key={i} className="flex items-start justify-between text-xs gap-2">
                <span className="text-gray-500 truncate">{b.label}</span>
                <span className="shrink-0 text-right">
                  {b.delta !== 0 && (
                    <span className="text-primary-700 font-medium">{formatPriceDelta(b.delta)}</span>
                  )}
                  {b.durationDelta !== 0 && (
                    <span className="text-amber-700 ml-1">
                      {b.durationDelta > 0 ? '+' : ''}{b.durationDelta}m
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-gray-200 pt-3 space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Total</span>
            <span className="text-2xl font-bold text-gray-900">{formatPricePen(priced.totalPrice)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-gray-500">Duración estimada</span>
            <span className="text-sm font-medium text-gray-700">{formatDuration(priced.totalDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FIELD RENDERER (despacha por tipo)
// ─────────────────────────────────────────────────────────────

function FieldRenderer({
  group, selection, onChange, error,
}: {
  group: ModifierGroup;
  selection: Selections[string] | undefined;
  onChange: (s: Selections[string]) => void;
  error?: string;
}) {
  const sel = selection || {};
  const label = (
    <div className="mb-2">
      <p className="text-sm font-semibold text-white">
        {group.name}
        {group.required && <span className="ml-1" style={{ color: '#FF4FA2' }}>*</span>}
      </p>
      {group.helpText && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{group.helpText}</p>}
    </div>
  );

  const ft = group.fieldType;

  let inner: React.ReactNode = null;
  if (ft === 'single_select') {
    inner = <FieldSingleSelectCards group={group} sel={sel} onChange={onChange} />;
  } else if (ft === 'image_cards') {
    inner = <FieldImageCards group={group} sel={sel} onChange={onChange} />;
  } else if (ft === 'toggle') {
    inner = <FieldToggle group={group} sel={sel} onChange={onChange} />;
  } else if (ft === 'quantity') {
    inner = <FieldQuantity group={group} sel={sel} onChange={onChange} />;
  } else if (ft === 'text_input') {
    inner = <FieldTextInput group={group} sel={sel} onChange={onChange} />;
  } else if (ft === 'multi_select') {
    inner = <FieldMultiSelect group={group} sel={sel} onChange={onChange} />;
  } else {
    inner = <p className="text-xs text-gray-400 italic">Tipo "{ft}" aún no implementado en cliente.</p>;
  }

  return (
    <div className="min-w-0">
      {/* El toggle ya muestra su propio label internamente */}
      {ft !== 'toggle' && label}
      {inner}
      {error && <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#f87171' }}><AlertCircle className="w-3 h-3" /> {error}</p>}
    </div>
  );
}

// ── Cards de selección única ─────────────────────────────────

function FieldSingleSelectCards({
  group, sel, onChange,
}: {
  group: ModifierGroup;
  sel: Selections[string];
  onChange: (s: Selections[string]) => void;
}) {
  const selectedId = (sel.optionIds || [])[0];
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
      {group.options.map((o) => (
        <OptionCard
          key={o.id}
          option={o}
          selected={selectedId === o.id}
          onClick={() => onChange({ optionIds: [o.id] })}
        />
      ))}
    </div>
  );
}

function OptionCard({ option, selected, onClick }: { option: ModifierOption; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative shrink-0 w-[104px] text-left rounded-xl border-2 p-2.5 transition-all duration-200"
      style={selected ? {
        background: 'rgba(255,79,162,0.12)', borderColor: 'rgba(255,79,162,0.6)',
      } : {
        background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)',
      }}
    >
      {selected && (
        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: '#FF4FA2' }}>
          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
        </div>
      )}
      <p className="text-xs font-semibold leading-tight pr-3"
        style={{ color: selected ? '#fff' : 'rgba(255,255,255,0.85)' }}>
        {option.label}
      </p>
      {option.modifierValue !== 0 && (
        <p className="text-[11px] mt-1 font-medium" style={{ color: '#FF4FA2' }}>
          {formatOptionModifier(option)}
        </p>
      )}
      {option.durationDelta !== 0 && (
        <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {option.durationDelta > 0 ? '+' : ''}{option.durationDelta} min
        </p>
      )}
    </button>
  );
}

// ── Cards con imagen ─────────────────────────────────────────

function FieldImageCards({
  group, sel, onChange,
}: {
  group: ModifierGroup;
  sel: Selections[string];
  onChange: (s: Selections[string]) => void;
}) {
  const selectedId = (sel.optionIds || [])[0];
  return (
    <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
      {group.options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange({ optionIds: [o.id] })}
          className="group relative shrink-0 w-[104px] rounded-xl overflow-hidden border-2 transition-all"
          style={selectedId === o.id
            ? { borderColor: 'rgba(255,79,162,0.6)' }
            : { borderColor: 'rgba(255,255,255,0.12)' }}
        >
          <div className="aspect-square relative" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {o.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={o.imageUrl} alt={o.label} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Sin foto</div>
            )}
            {selectedId === o.id && (
              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow"
                style={{ background: '#FF4FA2' }}>
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
            )}
          </div>
          <div className="p-2 text-left" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-[11px] font-semibold leading-tight line-clamp-1" style={{ color: 'rgba(255,255,255,0.9)' }}>{o.label}</p>
            {o.modifierValue !== 0 && (
              <p className="text-[10px] font-medium mt-0.5" style={{ color: '#FF4FA2' }}>{formatOptionModifier(o)}</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Toggle ───────────────────────────────────────────────────

function FieldToggle({
  group, sel, onChange,
}: {
  group: ModifierGroup;
  sel: Selections[string];
  onChange: (s: Selections[string]) => void;
}) {
  const opt = group.options[0];
  if (!opt) return null;
  const active = (sel.optionIds || []).includes(opt.id);
  return (
    <button
      type="button"
      onClick={() => onChange({ optionIds: active ? [] : [opt.id] })}
      className="w-full text-left border-2 rounded-2xl p-3.5 transition-colors flex items-center justify-between gap-3"
      style={active
        ? { borderColor: 'rgba(255,79,162,0.6)', background: 'rgba(255,79,162,0.12)' }
        : { borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{group.name}</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {opt.label}
          {opt.modifierValue !== 0 && (
            <span className="ml-1.5 font-medium" style={{ color: '#FF4FA2' }}>
              {formatOptionModifier(opt)}
            </span>
          )}
        </p>
      </div>
      <div className="w-11 h-6 rounded-full transition-colors shrink-0"
        style={{ background: active ? '#FF4FA2' : 'rgba(255,255,255,0.18)' }}>
        <div className={`w-5 h-5 bg-white rounded-full shadow m-0.5 transition-transform ${active ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </button>
  );
}

// ── Quantity stepper ─────────────────────────────────────────

function FieldQuantity({
  group, sel, onChange,
}: {
  group: ModifierGroup;
  sel: Selections[string];
  onChange: (s: Selections[string]) => void;
}) {
  const min = group.minValue ?? 0;
  const max = group.maxValue ?? 99;
  const step = group.stepValue ?? 1;
  const v = Number(sel.value ?? sel.quantity ?? min);
  return (
    <div className="inline-flex items-center gap-3 rounded-2xl p-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <button
        type="button"
        onClick={() => {
          const nv = Math.max(min, v - step);
          onChange({ value: nv, quantity: nv });
        }}
        disabled={v <= min}
        className="w-10 h-10 rounded-xl border flex items-center justify-center text-white transition-colors disabled:opacity-40"
        style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)' }}
      >
        <Minus className="w-4 h-4" />
      </button>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => {
          const nv = Number(e.target.value);
          onChange({ value: nv, quantity: nv });
        }}
        className="w-16 text-center font-bold text-lg bg-transparent text-white focus:outline-none"
      />
      <button
        type="button"
        onClick={() => {
          const nv = Math.min(max, v + step);
          onChange({ value: nv, quantity: nv });
        }}
        disabled={v >= max}
        className="w-10 h-10 rounded-xl border flex items-center justify-center text-white transition-colors disabled:opacity-40"
        style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)' }}
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Text input ───────────────────────────────────────────────

function FieldTextInput({
  group, sel, onChange,
}: {
  group: ModifierGroup;
  sel: Selections[string];
  onChange: (s: Selections[string]) => void;
}) {
  return (
    <input
      type="text"
      value={String(sel.value || '')}
      onChange={(e) => onChange({ value: e.target.value })}
      className="w-full rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)' }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,79,162,0.5)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
      placeholder="Escribe aquí..."
    />
  );
}

// ── Multi select (chips) — incluido como bonus aunque no era MVP ─

function FieldMultiSelect({
  group, sel, onChange,
}: {
  group: ModifierGroup;
  sel: Selections[string];
  onChange: (s: Selections[string]) => void;
}) {
  const selected = new Set(sel.optionIds || []);
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
      {group.options.map((o) => {
        const isOn = selected.has(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => {
              const next = new Set(selected);
              if (isOn) next.delete(o.id); else next.add(o.id);
              onChange({ optionIds: Array.from(next) });
            }}
            className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors"
            style={isOn
              ? { background: 'rgba(255,79,162,0.15)', color: '#fff', borderColor: 'rgba(255,79,162,0.6)' }
              : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.12)' }}
          >
            {o.label}
            {o.modifierValue !== 0 && <span className="ml-1.5" style={{ color: '#FF4FA2' }}>{formatOptionModifier(o)}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function formatOptionModifier(o: ModifierOption): string {
  const v = Number(o.modifierValue || 0);
  if (v === 0) return '';
  switch (o.modifierType) {
    case 'fixed':        return `${v > 0 ? '+' : ''}S/${v.toFixed(2)}`;
    case 'percent':      return `${v > 0 ? '+' : ''}${v}%`;
    case 'multiplier':   return `×${v}`;
    case 'per_quantity': return `+S/${v.toFixed(2)}/u`;
    default: return '';
  }
}
