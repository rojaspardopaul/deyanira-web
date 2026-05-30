'use client';

import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  ymd, parseYMD, todayYMD, compareYMD, isDateDisabled,
  MONTHS_ES, DOW_ES,
} from './utils';
import { getTokens } from './theme';
import type { DateTimeTheme } from './types';

// Grilla mensual con navegación. Soporta selección simple (date) y rango.
// En modo rango pinta la banda entre start y end.

type Props = {
  /** Fecha seleccionada (modo simple). */
  value?: string | null;
  /** Rango seleccionado (modo rango). */
  rangeStart?: string | null;
  rangeEnd?: string | null;
  /** Fecha en hover para previsualizar el rango antes del segundo clic. */
  hoverDate?: string | null;
  onHoverDate?: (d: string | null) => void;
  onSelect: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  disabledDates?: string[];
  theme?: DateTimeTheme;
};

export default function MonthGrid({
  value, rangeStart, rangeEnd, hoverDate, onHoverDate, onSelect,
  minDate, maxDate, disabledDates, theme = 'light',
}: Props) {
  const t = getTokens(theme);
  const today = todayYMD();

  const seed = value || rangeStart || (minDate && compareYMD(minDate, today) > 0 ? minDate : today);
  const seedDate = parseYMD(seed);
  const [year, setYear] = useState(seedDate.getFullYear());
  const [month, setMonth] = useState(seedDate.getMonth());

  // Re-centrar cuando cambia el valor desde afuera
  useEffect(() => {
    if (!value) return;
    const d = parseYMD(value);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }, [value]);

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const offset = (firstDay + 6) % 7; // lunes primero
    const lastDay = new Date(year, month + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < offset; i++) arr.push(null);
    for (let d = 1; d <= lastDay; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month]);

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
  }

  // Rango efectivo para resaltar (con preview de hover)
  const effEnd = rangeStart && !rangeEnd && hoverDate ? hoverDate : rangeEnd;
  const [lo, hi] = rangeStart && effEnd
    ? (compareYMD(rangeStart, effEnd) <= 0 ? [rangeStart, effEnd] : [effEnd, rangeStart])
    : [null, null];

  return (
    <div className="rounded-2xl p-3 select-none w-full" style={t.surface} role="group" aria-label="Calendario">
      {/* Navegación de mes */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prev} aria-label="Mes anterior"
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={t.navBtn}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.navHover; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = (t.navBtn.background as string); }}>
          <ChevronLeft className="w-4 h-4" style={{ color: t.navIcon }} />
        </button>
        <span className="font-semibold text-sm capitalize" style={{ color: t.monthLabel }} aria-live="polite">
          {MONTHS_ES[month]} {year}
        </span>
        <button type="button" onClick={next} aria-label="Mes siguiente"
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={t.navBtn}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.navHover; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = (t.navBtn.background as string); }}>
          <ChevronRight className="w-4 h-4" style={{ color: t.navIcon }} />
        </button>
      </div>

      {/* Encabezados de día */}
      <div className="grid grid-cols-7 mb-1" role="row">
        {DOW_ES.map(d => (
          <div key={d} className="text-center text-[10px] font-bold py-1" style={{ color: t.dowLabel }}>{d}</div>
        ))}
      </div>

      {/* Celdas */}
      <div className="grid grid-cols-7 gap-y-1" role="grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={`x${i}`} />;
          const iso = ymd(year, month, d);
          const disabled = isDateDisabled(iso, { minDate, maxDate, disabledDates });
          const selected = iso === value || iso === rangeStart || iso === rangeEnd;
          const inRange = lo && hi && compareYMD(iso, lo) >= 0 && compareYMD(iso, hi) <= 0;
          const isToday = iso === today;

          const style = selected ? t.selectedCell
            : disabled ? t.disabledCell
            : inRange ? { ...t.defaultCell, background: t.cellHover, borderRadius: 0 }
            : isToday ? t.todayCell
            : t.defaultCell;

          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              aria-label={parseYMD(iso).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onSelect(iso)}
              onMouseEnter={e => {
                onHoverDate?.(iso);
                if (!disabled && !selected && !inRange) (e.currentTarget as HTMLElement).style.background = t.cellHover;
              }}
              onMouseLeave={e => {
                if (!disabled && !selected && !inRange) (e.currentTarget as HTMLElement).style.background = '';
              }}
              className="h-9 w-full rounded-full text-sm font-medium transition-all duration-150"
              style={style}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
