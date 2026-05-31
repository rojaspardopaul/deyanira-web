'use client';

import { useMemo } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { aptDateStr, clientName, toYMD, addDays } from '../utils/date';
import { fmtTime12 } from '../utils/time';
import { STATUS } from '../status';
import { MONTH_NAMES } from '../constants';
import type { Appointment, AptStatus } from '../types';

type AgendaViewProps = {
  appointments: Appointment[];
  hiddenStatuses: AptStatus[];
  staffVisibility: Record<string, boolean>;
  today: string;
  dateFrom: string;
  dateTo: string;
  selectedApt: Appointment | null;
  onAptClick: (apt: Appointment) => void;
};

const DAY_NAMES_ES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

function formatDateHeader(ds: string, today: string): string {
  const d    = new Date(ds + 'T12:00:00');
  const dow  = DAY_NAMES_ES[d.getDay()];
  const day  = d.getDate();
  const mon  = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  if (ds === today) return `Hoy — ${dow} ${day} ${mon} ${year}`;
  return `${dow} ${day} ${mon} ${year}`;
}

export function AgendaView({
  appointments, hiddenStatuses, staffVisibility,
  today, dateFrom, dateTo, selectedApt, onAptClick,
}: AgendaViewProps) {
  // Build list of all dates in range
  const allDates = useMemo(() => {
    const dates: string[] = [];
    let cur = new Date(dateFrom + 'T12:00:00');
    const end = new Date(dateTo + 'T12:00:00');
    while (cur <= end) {
      dates.push(toYMD(cur));
      cur = addDays(cur, 1);
    }
    return dates;
  }, [dateFrom, dateTo]);

  // Filter appointments
  const filtered = useMemo(() =>
    appointments
      .filter(a => {
        if (hiddenStatuses.includes(a.status)) return false;
        if (a.staff && staffVisibility[a.staff.id] === false) return false;
        const ds = aptDateStr(a);
        return ds >= dateFrom && ds <= dateTo;
      })
      .sort((a, b) => {
        const da = aptDateStr(a), db = aptDateStr(b);
        if (da !== db) return da.localeCompare(db);
        return a.startTime.localeCompare(b.startTime);
      }),
    [appointments, hiddenStatuses, staffVisibility, dateFrom, dateTo],
  );

  // Group by date
  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const apt of filtered) {
      const ds = aptDateStr(apt);
      if (!map.has(ds)) map.set(ds, []);
      map.get(ds)!.push(apt);
    }
    return map;
  }, [filtered]);

  const hasAny = filtered.length > 0;

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {!hasAny ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 py-20">
          <Calendar className="w-12 h-12 opacity-30" />
          <p className="text-sm font-medium">Sin citas en este período</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto py-4 px-4">
          {allDates.map(ds => {
            const dayApts = byDate.get(ds);
            if (!dayApts?.length) return null;
            const isToday = ds === today;
            return (
              <div key={ds} className="mb-6">
                {/* Date header */}
                <div className={`sticky top-0 z-10 py-1.5 mb-2 flex items-center gap-2
                  ${isToday ? 'bg-amber-50' : 'bg-white'}`}>
                  <span className={`text-xs font-bold capitalize
                    ${isToday ? 'text-gold-600' : 'text-gray-500'}`}>
                    {formatDateHeader(ds, today)}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] text-gray-400 font-medium">
                    {dayApts.length} cita{dayApts.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Appointment cards */}
                <div className="flex flex-col gap-2">
                  {dayApts.map(apt => {
                    const cfg       = STATUS[apt.status];
                    const isSelected = selectedApt?.id === apt.id;
                    return (
                      <button
                        key={apt.id}
                        onClick={() => onAptClick(apt)}
                        className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-all
                          ${isSelected
                            ? 'border-gold-400 bg-amber-50 shadow-sm'
                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                          }`}
                      >
                        {/* Status dot + time */}
                        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-gray-800">
                              {clientName(apt)}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bgLight} ${cfg.text}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {apt.service.name}
                            {apt.staff && <span className="text-gray-400"> · {apt.staff.name}</span>}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className="text-[10px] text-gray-500 font-medium">
                              {fmtTime12(apt.startTime)} – {fmtTime12(apt.endTime)}
                            </span>
                            {apt.totalPen && (
                              <span className="text-[10px] text-gray-400 ml-auto">
                                S/ {Number(apt.totalPen).toFixed(0)}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
