'use client';

import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  toYMD, parseYMD, getWeekStart, addDays, todayYMD, compareYMD, isDateDisabled,
  MONTHS_SHORT_ES, DOW_ES,
} from './utils';
import { getTokens, PINK, PINK_GRADIENT } from './theme';
import type { DateTimeTheme } from './types';

// Tira horizontal de 7 días (tipo app nativa), pensada para mobile y wizard.

type Props = {
  value?: string | null;
  onSelect: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  disabledDates?: string[];
  theme?: DateTimeTheme;
};

export default function WeekStrip({ value, onSelect, minDate, maxDate, disabledDates, theme = 'light' }: Props) {
  const t = getTokens(theme);
  const today = todayYMD();
  const min = minDate ?? today;

  const seedIso = value || (compareYMD(min, today) > 0 ? min : today);
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(parseYMD(seedIso)));

  useEffect(() => {
    if (!value) return;
    setWeekStart(getWeekStart(parseYMD(value)));
  }, [value]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const label = (() => {
    const a = days[0], b = days[6];
    if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${MONTHS_SHORT_ES[a.getMonth()]}`;
    return `${a.getDate()} ${MONTHS_SHORT_ES[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT_ES[b.getMonth()]}`;
  })();

  const canPrev = compareYMD(toYMD(days[6]), min) > 0;

  return (
    <div className="rounded-2xl p-3 select-none w-full" style={t.surface}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <button type="button" onClick={() => setWeekStart(w => addDays(w, -7))} disabled={!canPrev}
          aria-label="Semana anterior"
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed"
          style={t.navBtn}>
          <ChevronLeft className="w-4 h-4" style={{ color: t.navIcon }} />
        </button>
        <span className="font-semibold text-sm capitalize" style={{ color: t.monthLabel }}>{label}</span>
        <button type="button" onClick={() => setWeekStart(w => addDays(w, 7))} aria-label="Semana siguiente"
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={t.navBtn}>
          <ChevronRight className="w-4 h-4" style={{ color: t.navIcon }} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5" role="row">
        {days.map(d => {
          const iso = toYMD(d);
          const selected = iso === value;
          const isToday = iso === today;
          const disabled = isDateDisabled(iso, { minDate: min, maxDate, disabledDates });
          return (
            <button key={iso} type="button" role="gridcell" disabled={disabled}
              aria-selected={selected}
              aria-label={d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
              onClick={() => onSelect(iso)}
              className="flex flex-col items-center justify-center py-2.5 rounded-2xl transition-all duration-150 active:scale-95"
              style={selected ? {
                background: PINK_GRADIENT, boxShadow: '0 6px 16px rgba(255,79,162,0.4)',
              } : disabled ? {
                background: 'transparent', cursor: 'not-allowed',
              } : {
                background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                border: isToday ? '1.5px solid rgba(255,79,162,0.5)' : '1.5px solid transparent',
              }}>
              <span className="text-[10px] font-bold uppercase mb-0.5"
                style={{ color: selected ? 'rgba(255,255,255,0.85)' : disabled ? t.dowLabel : t.dowLabel }}>
                {DOW_ES[(d.getDay() + 6) % 7]}
              </span>
              <span className="text-base font-bold"
                style={{ color: selected ? '#fff' : disabled ? t.disabledCell.color as string : isToday ? PINK : t.monthLabel }}>
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
