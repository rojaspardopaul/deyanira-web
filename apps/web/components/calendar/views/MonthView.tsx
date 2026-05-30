'use client';

import { STATUS } from '../status';
import { toYMD, addDays, aptDateStr, isPastDate, clientName } from '../utils/date';
import { MONTH_NAMES, DAY_NAMES_SHORT } from '../constants';
import type { Appointment, AptStatus } from '../types';

type MonthViewProps = {
  year: number;
  month: number;
  appointments: Appointment[];
  selectedDate: string;
  hiddenStatuses: AptStatus[];
  today: string;
  onDateClick: (date: string) => void;
  onAptClick: (apt: Appointment) => void;
};

export function MonthView({
  year, month, appointments, selectedDate, hiddenStatuses, today, onDateClick, onAptClick,
}: MonthViewProps) {
  const firstDay = new Date(year, month, 1);
  const dow = firstDay.getDay();
  const offset = dow === 0 ? 6 : dow - 1;
  firstDay.setDate(firstDay.getDate() - offset);
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => addDays(firstDay, i));
  const filtered = appointments.filter(a => !hiddenStatuses.includes(a.status));

  return (
    <div className="flex-1 overflow-auto bg-white">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-gray-200 sticky top-0 bg-white z-10">
        {DAY_NAMES_SHORT.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const cellStr = toYMD(cell);
          const isCurrentMonth = cell.getMonth() === month;
          const isToday = cellStr === today;
          const isSelected = cellStr === selectedDate;
          const isPast = isPastDate(cellStr);
          const dayApts = filtered
            .filter(a => aptDateStr(a) === cellStr)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

          return (
            <button
              key={i}
              onClick={() => onDateClick(cellStr)}
              className={`min-h-[90px] text-left p-1 border-b border-r border-gray-100 transition-colors
                ${!isCurrentMonth ? 'opacity-35 bg-gray-50/50' : ''}
                ${isPast && isCurrentMonth ? 'bg-gray-50/40' : ''}
                ${isSelected ? 'bg-amber-50 ring-1 ring-inset ring-gold-400' : isCurrentMonth ? 'hover:bg-gray-50' : ''}
              `}
            >
              <span className={`text-xs font-medium w-6 h-6 inline-flex items-center justify-center rounded-full mb-0.5 transition-colors
                ${isToday ? 'bg-gold-400 text-gray-900 font-bold' : isSelected ? 'bg-gold-500 text-white' : 'text-gray-700'}
              `}>
                {cell.getDate()}
              </span>

              <div className="space-y-px">
                {dayApts.slice(0, 3).map(apt => {
                  const cfg = STATUS[apt.status];
                  return (
                    <div
                      key={apt.id}
                      onClick={e => { e.stopPropagation(); onAptClick(apt); }}
                      className={`text-[10px] ${cfg.bgLight} ${cfg.text} px-1 py-px rounded font-semibold truncate hover:opacity-80 flex items-center gap-1`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0`} />
                      <span className="truncate">{apt.startTime} {clientName(apt)}</span>
                    </div>
                  );
                })}
                {dayApts.length > 3 && (
                  <p className="text-[9px] text-gray-400 pl-1">+{dayApts.length - 3} más</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Unused import guard
void MONTH_NAMES;
