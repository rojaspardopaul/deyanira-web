'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import {
  generateTimeOptions, timeToMinutes, minutesToTime, inDisabledRanges, formatTimeLabel,
} from './utils';
import { getTokens } from './theme';
import TimeWheel from './TimeWheel';
import TimeField from './TimeField';
import type { DateTimeTheme, Slot } from './types';

// Control de hora estilo librería: campo segmentado editable [Hora][Min][a.m./p.m.]
// + icono de reloj que despliega la RUEDA. Valida la disponibilidad ya calculada
// y muestra un mensaje claro de qué se puede elegir.
//   • Modo slots: solo las horas de inicio del backend son válidas.
//   • Modo libre: cualquier hora en [minTime..maxTime] y fuera de disabledTimeRanges.

type Props = {
  value?: string | null;
  onSelect: (start: string, end?: string) => void;
  slots?: Slot[];
  slotsLoading?: boolean;
  minuteStep?: number;
  minTime?: string;
  maxTime?: string;
  hourFormat?: '12h' | '24h';
  disabledTimeRanges?: { start: string; end: string }[];
  theme?: DateTimeTheme;
  emptyLabel?: string;
  autoSelectEarliest?: boolean;
};

export default function TimeList({
  value, onSelect, slots, slotsLoading,
  minuteStep = 5, minTime, maxTime, hourFormat = '12h',
  disabledTimeRanges, theme = 'light',
  emptyLabel = 'No hay horarios disponibles para esta fecha',
  autoSelectEarliest,
}: Props) {
  const t = getTokens(theme);
  const [showWheel, setShowWheel] = useState(false);
  const [error, setError] = useState('');

  const slotEnd = useMemo(() => {
    const m = new Map<string, string>();
    slots?.forEach(s => m.set(s.start, s.end));
    return m;
  }, [slots]);

  const lo = minTime ?? '00:00';
  const hi = maxTime ?? '23:59';

  // Predicado de validez para la entrada manual.
  const allowed = useMemo(() => {
    if (slots) {
      const set = new Set(slots.map(s => s.start));
      return (hhmm: string) => set.has(hhmm);
    }
    return (hhmm: string) => {
      const mm = timeToMinutes(hhmm);
      return mm >= timeToMinutes(lo) && mm <= timeToMinutes(hi) && !inDisabledRanges(hhmm, disabledTimeRanges);
    };
  }, [slots, lo, hi, disabledTimeRanges]);

  // Limpiar error cuando el valor cambia desde la rueda/exterior.
  useEffect(() => { setError(''); }, [value]);

  const candidates = useMemo<{ value: string; disabled: boolean }[]>(() => {
    let grid: { value: string; disabled: boolean }[];
    if (slots) {
      if (slots.length === 0) return [];
      const starts = slots.map(s => timeToMinutes(s.start));
      const min = Math.min(...starts);
      const max = Math.max(...starts);
      const sorted = [...starts].sort((a, b) => a - b);
      let step = minuteStep || 30;
      for (let i = 1; i < sorted.length; i++) step = Math.min(step, sorted[i] - sorted[i - 1] || step);
      if (step <= 0) step = 30;
      const available = new Set(slots.map(s => s.start));
      grid = [];
      for (let mm = min; mm <= max; mm += step) {
        const v = minutesToTime(mm);
        grid.push({ value: v, disabled: !available.has(v) });
      }
    } else {
      grid = generateTimeOptions('00:00', '23:59', minuteStep).map(v => ({ value: v, disabled: !allowed(v) }));
    }
    if (value && allowed(value) && !grid.some(g => g.value === value)) {
      grid = [...grid, { value, disabled: false }].sort((a, b) => timeToMinutes(a.value) - timeToMinutes(b.value));
    }
    return grid;
  }, [slots, minuteStep, value, allowed]);

  // Default inteligente: si no hay valor, pre-selecciona el PRIMER horario
  // disponible (el más temprano que no esté ocupado/deshabilitado, tomado de
  // `candidates` ya ordenado). Evita el "12:00" no viable. En modo slots va activo
  // por defecto; en modo libre solo si el llamador lo pide explícitamente.
  const autoSelect = autoSelectEarliest ?? (slots != null);
  const yaAutoSeleccionado = useRef(false);
  useEffect(() => {
    if (!autoSelect) return;
    if (value) { yaAutoSeleccionado.current = false; return; }
    if (slotsLoading || yaAutoSeleccionado.current) return;
    const primero = candidates.find(c => !c.disabled);
    if (primero) {
      yaAutoSeleccionado.current = true;
      onSelect(primero.value, slotEnd.get(primero.value));
    }
  }, [autoSelect, value, slotsLoading, candidates, onSelect, slotEnd]);

  function handleManual(hhmm: string) {
    if (!allowed(hhmm)) { setError(`${formatTimeLabel(hhmm, hourFormat)} no está disponible.`); return; }
    setError('');
    onSelect(hhmm, slotEnd.get(hhmm));
  }

  const availabilityHint = useMemo(() => {
    if (slots && slots.length > 0) {
      const list = slots.map(s => formatTimeLabel(s.start, hourFormat));
      return `Disponibles: ${list.slice(0, 6).join(' · ')}${list.length > 6 ? ` … (+${list.length - 6})` : ''}`;
    }
    if (!slots) return `Disponible de ${formatTimeLabel(lo, hourFormat)} a ${formatTimeLabel(hi, hourFormat)}`;
    return '';
  }, [slots, lo, hi, hourFormat]);

  if (slotsLoading) {
    return <p className="text-xs py-2" style={{ color: t.optionText, opacity: 0.6 }}>Cargando horarios disponibles…</p>;
  }
  if (slots && candidates.length === 0) {
    return <p className="text-xs py-2 text-red-500">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {/* Campo segmentado + icono de reloj para abrir la rueda */}
      <div className="flex items-end gap-2 w-full">
        <div className="flex-1 min-w-0">
          <TimeField
            value={value ?? null}
            onCommit={handleManual}
            hourFormat={hourFormat}
            theme={theme}
            invalid={!!error}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowWheel(s => !s)}
          aria-label={showWheel ? 'Ocultar selector' : 'Abrir selector de hora'}
          aria-expanded={showWheel}
          className={`flex items-center justify-center w-10 h-10 shrink-0 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500
            ${theme === 'dark' ? 'bg-white/10 text-white border border-white/15' : 'border border-gray-200 text-gray-600'}`}
          style={showWheel ? { background: t.wheelBand, borderColor: t.wheelBandBorder } : undefined}
        >
          <Clock className="w-4 h-4" />
        </button>
      </div>

      {/* Mensaje de disponibilidad / error */}
      {error
        ? <p className="text-[11px] text-red-500 text-center" role="alert">{error}{availabilityHint ? ` ${availabilityHint}.` : ''}</p>
        : <p className="text-[11px] text-center" style={{ color: t.wheelColLabel }}>{availabilityHint}</p>}

      {/* Rueda (se muestra al pulsar el reloj) */}
      {showWheel && (
        <div className="pt-1">
          <TimeWheel
            value={value ?? null}
            onChange={(hhmm) => onSelect(hhmm, slotEnd.get(hhmm))}
            candidates={candidates}
            hourFormat={hourFormat}
            theme={theme}
          />
        </div>
      )}
    </div>
  );
}
