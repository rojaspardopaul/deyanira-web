'use client';

import { useEffect, useMemo, useRef } from 'react';
import { to12h, from12h, minutesToTime } from './utils';
import { getTokens, PINK_GRADIENT } from './theme';
import type { DateTimeTheme } from './types';

// Time picker tipo "rueda" estilo Infragistics: columnas Hora | Min (| a.m./p.m.)
// con banda central de selección por columna y bordes difuminados. La
// disponibilidad se decide con `candidates`: cada 'HH:mm' candidato puede estar
// deshabilitado (gris, no seleccionable). Valor de E/S siempre 'HH:mm' 24h.

const ITEM = 34;      // alto de cada ítem (px)
const VISIBLE = 5;    // ítems visibles (impar → hay centro)
const PAD = (VISIBLE - 1) / 2;
const COL_W = 52;     // ancho de columna numérica (px)

type Candidate = { value: string; disabled: boolean };

type Props = {
  value: string | null;
  onChange: (hhmm: string) => void;
  candidates: Candidate[];
  hourFormat?: '12h' | '24h';
  theme?: DateTimeTheme;
};

type Entry = { value: string; disabled: boolean; h24: number; min: number; hour12: number; mer: 'am' | 'pm' };

function pad2(n: number) { return String(n).padStart(2, '0'); }

// ── Columna de rueda reutilizable (con banda central propia) ──
function WheelCol({
  items, selectedKey, onPick, ariaLabel, theme,
}: {
  items: { key: number; label: string; disabled: boolean }[];
  selectedKey: number;
  onPick: (key: number) => void;
  ariaLabel: string;
  theme: DateTimeTheme;
}) {
  const t = getTokens(theme);
  const ref = useRef<HTMLDivElement>(null);
  const idx = items.findIndex(i => i.key === selectedKey);
  const selColor = theme === 'dark' ? '#ffffff' : '#c01d6f';

  // Centrar el seleccionado
  useEffect(() => {
    if (idx < 0 || !ref.current) return;
    ref.current.scrollTo({ top: idx * ITEM, behavior: 'smooth' });
  }, [idx]);

  function move(dir: 1 | -1) {
    if (items.length === 0) return;
    let i = idx;
    for (let step = 0; step < items.length; step++) {
      i += dir;
      if (i < 0 || i >= items.length) return;
      if (!items[i].disabled) { onPick(items[i].key); return; }
    }
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Home') { e.preventDefault(); const f = items.find(i => !i.disabled); if (f) onPick(f.key); }
    else if (e.key === 'End') { e.preventDefault(); const l = [...items].reverse().find(i => !i.disabled); if (l) onPick(l.key); }
  }

  return (
    <div className="relative" style={{ width: COL_W }}>
      {/* Banda central de selección (solo esta columna) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 rounded-lg"
        style={{
          top: ITEM * PAD,
          height: ITEM,
          background: t.wheelBand,
          borderTop: `1px solid ${t.wheelBandBorder}`,
          borderBottom: `1px solid ${t.wheelBandBorder}`,
        }}
      />
      <div
        ref={ref}
        role="listbox"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative overflow-y-auto no-scrollbar focus:outline-none rounded-lg"
        style={{
          height: ITEM * VISIBLE,
          scrollSnapType: 'y mandatory',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)',
          maskImage: 'linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)',
        }}
      >
        <div style={{ height: ITEM * PAD }} />
        {items.map(it => {
          const selected = it.key === selectedKey;
          return (
            <button
              key={it.key}
              type="button"
              role="option"
              aria-selected={selected}
              aria-disabled={it.disabled}
              disabled={it.disabled}
              onClick={() => !it.disabled && onPick(it.key)}
              className="w-full flex items-center justify-center transition-colors disabled:cursor-not-allowed"
              style={{
                height: ITEM,
                scrollSnapAlign: 'center',
                fontSize: selected ? 17 : 15,
                color: it.disabled ? t.wheelDisabled : selected ? selColor : t.wheelText,
                fontWeight: selected ? 800 : 600,
                opacity: it.disabled ? 1 : selected ? 1 : 0.85,
              }}
            >
              {it.label}
            </button>
          );
        })}
        <div style={{ height: ITEM * PAD }} />
      </div>
    </div>
  );
}

export default function TimeWheel({ value, onChange, candidates, hourFormat = '12h', theme = 'light' }: Props) {
  const t = getTokens(theme);
  const is12 = hourFormat === '12h';

  const entries = useMemo<Entry[]>(() => candidates.map(c => {
    const [h, m] = c.value.split(':').map(Number);
    const { hour12, meridiem } = to12h(c.value);
    return { value: c.value, disabled: c.disabled, h24: h, min: m, hour12, mer: meridiem };
  }), [candidates]);

  const enabledMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const e of entries) map.set(e.value, !e.disabled);
    return map;
  }, [entries]);

  // Valor mostrado (draft): el value externo si es válido, si no el primer habilitado.
  const draft = useMemo(() => {
    if (value && enabledMap.has(value)) return value;
    const firstEnabled = entries.find(e => !e.disabled);
    return value || firstEnabled?.value || entries[0]?.value || '00:00';
  }, [value, entries, enabledMap]);

  const sel = to12h(draft);
  const selH24 = parseInt(draft.slice(0, 2), 10);
  const selMin = parseInt(draft.slice(3, 5), 10);
  const selMer = sel.meridiem;

  const meridiemPresent = useMemo(() => ({
    am: entries.some(e => e.mer === 'am'),
    pm: entries.some(e => e.mer === 'pm'),
  }), [entries]);

  // ── Columna de horas ──
  const hourItems = useMemo(() => {
    const rel = is12 ? entries.filter(e => e.mer === selMer) : entries;
    const byHour = new Map<number, Entry[]>();
    for (const e of rel) {
      if (!byHour.has(e.h24)) byHour.set(e.h24, []);
      byHour.get(e.h24)!.push(e);
    }
    return Array.from(byHour.keys()).sort((a, b) => a - b).map(h24 => ({
      key: h24,
      label: is12 ? String(h24 % 12 === 0 ? 12 : h24 % 12) : pad2(h24),
      disabled: !byHour.get(h24)!.some(e => !e.disabled),
    }));
  }, [entries, is12, selMer]);

  // ── Columna de minutos (unión de minutos presentes; gris si no aplica) ──
  const minuteItems = useMemo(() => {
    const mins = Array.from(new Set(entries.map(e => e.min))).sort((a, b) => a - b);
    return mins.map(min => ({
      key: min,
      label: pad2(min),
      disabled: !enabledMap.get(`${pad2(selH24)}:${pad2(min)}`),
    }));
  }, [entries, enabledMap, selH24]);

  // ── Helpers de selección ──
  function firstEnabledMinute(h24: number): number | null {
    const ms = Array.from(new Set(entries.map(e => e.min))).sort((a, b) => a - b);
    for (const m of ms) if (enabledMap.get(`${pad2(h24)}:${pad2(m)}`)) return m;
    return null;
  }
  function emit(h24: number, min: number) {
    onChange(minutesToTime(h24 * 60 + min));
  }
  function pickHour(h24: number) {
    if (enabledMap.get(`${pad2(h24)}:${pad2(selMin)}`)) { emit(h24, selMin); return; }
    const m = firstEnabledMinute(h24);
    if (m != null) emit(h24, m);
  }
  function pickMinute(min: number) { emit(selH24, min); }
  function pickMeridiem(mer: 'am' | 'pm') {
    if (mer === selMer) return;
    const h24 = from12h(sel.hour12, selMin, mer);
    let target = parseInt(h24.slice(0, 2), 10);
    if (!entries.some(e => e.h24 === target && !e.disabled)) {
      const firstHour = entries
        .filter(e => e.mer === mer && !e.disabled)
        .sort((a, b) => a.h24 - b.h24)[0];
      if (!firstHour) return;
      target = firstHour.h24;
    }
    const m = enabledMap.get(`${pad2(target)}:${pad2(selMin)}`) ? selMin : firstEnabledMinute(target);
    if (m != null) emit(target, m);
  }

  if (candidates.length === 0) return null;

  return (
    <div className="select-none flex items-start justify-center gap-1.5">
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-bold uppercase mb-1" style={{ color: t.wheelColLabel }}>Hora</span>
        <WheelCol items={hourItems} selectedKey={selH24} onPick={pickHour} ariaLabel="Hora" theme={theme} />
      </div>
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-bold uppercase mb-1 opacity-0">:</span>
        <span className="font-bold text-lg" style={{ color: t.wheelColLabel, height: ITEM * VISIBLE, display: 'flex', alignItems: 'center' }}>:</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-bold uppercase mb-1" style={{ color: t.wheelColLabel }}>Min</span>
        <WheelCol items={minuteItems} selectedKey={selMin} onPick={pickMinute} ariaLabel="Minutos" theme={theme} />
      </div>

      {is12 && (
        <div className="flex flex-col items-center" role="radiogroup" aria-label="a.m. o p.m.">
          <span className="text-[10px] font-bold uppercase mb-1 opacity-0">m</span>
          <div className="flex flex-col gap-1.5 justify-center" style={{ height: ITEM * VISIBLE }}>
            {(['am', 'pm'] as const).map(mer => {
              const active = selMer === mer;
              const disabled = !meridiemPresent[mer];
              return (
                <button
                  key={mer}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-disabled={disabled}
                  disabled={disabled}
                  onClick={() => pickMeridiem(mer)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:cursor-not-allowed"
                  style={active
                    ? { background: PINK_GRADIENT, color: '#fff' }
                    : { background: t.optionBg, color: disabled ? t.wheelDisabled : t.wheelText }}
                >
                  {mer === 'am' ? 'a.m.' : 'p.m.'}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
