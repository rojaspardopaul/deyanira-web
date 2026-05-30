'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { toYMD, addDays } from '../utils/date';
import { MONTH_NAMES } from '../constants';

type MiniCalendarProps = {
  value: string;             // YYYY-MM-DD — selected date
  today: string;             // YYYY-MM-DD — today
  markedDates?: Set<string>; // dates that have appointments (show dot)
  closedDaysOfWeek?: Set<number>; // 0=Sun…6=Sat days the salon is closed
  onSelect: (date: string) => void;
};

export function MiniCalendar({ value, today, markedDates, closedDaysOfWeek, onSelect }: MiniCalendarProps) {
  const [displayYear, setDisplayYear]   = useState(() => parseInt(value.slice(0, 4), 10));
  const [displayMonth, setDisplayMonth] = useState(() => parseInt(value.slice(5, 7), 10) - 1);

  // Sync when controlled value changes month/year externally
  useEffect(() => {
    const y = parseInt(value.slice(0, 4), 10);
    const m = parseInt(value.slice(5, 7), 10) - 1;
    setDisplayYear(y);
    setDisplayMonth(m);
  }, [value]);

  function prevYear()  { setDisplayYear(y => y - 1); }
  function nextYear()  { setDisplayYear(y => y + 1); }
  function prevMonth() {
    if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear(y => y - 1); }
    else setDisplayMonth(m => m - 1);
  }
  function nextMonth() {
    if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear(y => y + 1); }
    else setDisplayMonth(m => m + 1);
  }

  // Build calendar grid
  const firstDay = new Date(displayYear, displayMonth, 1);
  // Start week on Sunday (getDay() 0=Sun)
  const startOffset = firstDay.getDay(); // 0–6
  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();

  // Build array of cells: null for empty leading cells, then day numbers
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  function cellDate(day: number): string {
    return `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return (
    <div className="px-2 py-2 select-none">
      {/* Month/year nav */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-0.5">
          <button onClick={prevYear}  className="p-0.5 rounded hover:bg-gray-100 text-gray-500"><ChevronsLeft  className="w-3.5 h-3.5" /></button>
          <button onClick={prevMonth} className="p-0.5 rounded hover:bg-gray-100 text-gray-500"><ChevronLeft   className="w-3.5 h-3.5" /></button>
        </div>
        <span className="text-xs font-bold text-gray-700 capitalize">
          {MONTH_NAMES[displayMonth]} {displayYear}
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={nextMonth} className="p-0.5 rounded hover:bg-gray-100 text-gray-500"><ChevronRight  className="w-3.5 h-3.5" /></button>
          <button onClick={nextYear}  className="p-0.5 rounded hover:bg-gray-100 text-gray-500"><ChevronsRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Day headers: Su Mo Tu We Th Fr Sa */}
      <div className="grid grid-cols-7 mb-0.5">
        {['Do','Lu','Ma','Mi','Ju','Vi','Sá'].map(d => (
          <div key={d} className="text-center text-[9px] font-bold text-gray-400 uppercase py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const ds         = cellDate(day);
          const isSelected = ds === value;
          const isToday    = ds === today;
          const hasApts    = markedDates?.has(ds);
          // Day of week: compute from the cell date
          const dow        = new Date(ds + 'T12:00:00').getDay();
          const isClosed   = !isSelected && closedDaysOfWeek?.has(dow);

          return (
            <button
              key={ds}
              onClick={() => onSelect(ds)}
              className={`relative flex flex-col items-center justify-center w-full aspect-square rounded-full text-[11px] font-medium transition-colors
                ${isSelected
                  ? 'bg-gold-400 text-gray-900 font-bold'
                  : isToday
                  ? 'text-gold-600 font-bold ring-1 ring-gold-400'
                  : isClosed
                  ? 'text-red-400 hover:bg-red-50'
                  : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              {day}
              {hasApts && !isSelected && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isClosed ? 'bg-red-300' : 'bg-gold-400'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
