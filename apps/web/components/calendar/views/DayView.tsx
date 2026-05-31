'use client';

import { aptDateStr, isPastDate, toYMD, addDays } from '../utils/date';
import { timeToMin, minToHHMM, hourToAMPM } from '../utils/time';
import { computeOverlapLayout } from '../utils/layout';
import { AptBlock } from '../blocks/AptBlock';
import { GhostBlock } from '../blocks/GhostBlock';
import { HOUR_START, HOUR_END, HOUR_HEIGHT, DAY_NAMES_SUN } from '../constants';
import type { Appointment, AptStatus, DragState, ResizeState } from '../types';

type DayViewProps = {
  date: string;
  appointments: Appointment[];
  hiddenStatuses: AptStatus[];
  today: string;
  selectedApt: Appointment | null;
  selectedTime: string | null;
  weekStart: Date;
  onSlotClick: (date: string, time: string) => void;
  onAptClick: (apt: Appointment) => void;
  onDayClick?: (date: string) => void;
  dragState?: DragState | null;
  resizeState?: ResizeState | null;
  onDragStart?: (apt: Appointment, e: React.PointerEvent, offsetY: number) => void;
  onResizeStart?: (apt: Appointment, e: React.PointerEvent) => void;
  enableDrag?: boolean;
  enableResize?: boolean;
  closedDaysOfWeek?: Set<number>;
};

export function DayView({
  date, appointments, hiddenStatuses, today,
  selectedApt, selectedTime,
  weekStart, onSlotClick, onAptClick, onDayClick,
  dragState, resizeState, onDragStart, onResizeStart,
  enableDrag = false, enableResize = false,
  closedDaysOfWeek,
}: DayViewProps) {
  const hours       = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const totalHeight = (HOUR_END - HOUR_START) * HOUR_HEIGHT;
  const filtered    = appointments.filter(a => aptDateStr(a) === date && !hiddenStatuses.includes(a.status));
  const layout      = computeOverlapLayout(filtered);

  const isToday = date === today;
  const isPast  = isPastDate(date);

  const now    = new Date();
  const nowTop = (now.getHours() + now.getMinutes() / 60 - HOUR_START) * HOUR_HEIGHT;
  const selectionTop = selectedTime ? (timeToMin(selectedTime) / 60 - HOUR_START) * HOUR_HEIGHT : null;

  const showGhost = dragState?.isDragging && dragState.targetDate === date;

  // Week strip: 7 days starting from weekStart
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex-1 overflow-auto bg-white">
      {/* Week strip — Bryntum-style horizontal day navigator */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 flex">
        {weekDays.map(d => {
          const ds       = toYMD(d);
          const isSel    = ds === date;
          const isTod    = ds === today;
          const dow      = d.getDay(); // 0=Sun
          const abbr     = DAY_NAMES_SUN[dow];
          const isClosed = closedDaysOfWeek?.has(dow);
          return (
            <button
              key={ds}
              onClick={() => onDayClick?.(ds)}
              className={`flex-1 py-2 flex flex-col items-center gap-0.5 transition-colors
                ${isSel ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
            >
              <span className={`text-[9px] font-bold uppercase tracking-wide
                ${isClosed ? 'text-red-300' : isTod ? 'text-gold-500' : 'text-gray-400'}`}>
                {abbr}
              </span>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                ${isSel
                  ? 'bg-gold-400 text-gray-900'
                  : isTod
                  ? 'text-gold-600 ring-1 ring-gold-400'
                  : isClosed
                  ? 'text-red-400'
                  : 'text-gray-700'
                }`}>
                {d.getDate()}
              </span>
              {/* appointment dot */}
              {appointments.some(a => aptDateStr(a) === ds && !hiddenStatuses.includes(a.status)) && !isSel && (
                <span className="w-1 h-1 rounded-full bg-gold-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Appointment count sub-header */}
      <div className={`px-4 py-1 border-b border-gray-100 flex items-center gap-2
        ${isToday ? 'bg-amber-50/40' : ''}`}>
        <span className="text-[10px] text-gray-400 font-medium">
          {filtered.length} cita{filtered.length !== 1 ? 's' : ''}
          {isPast && <span className="ml-1 text-gray-300">· día pasado</span>}
        </span>
      </div>

      {/* Time grid — marked for drag detection */}
      <div className="flex" style={{ height: totalHeight }} data-cal-grid="1">
        {/* Hour gutter */}
        <div className="w-12 shrink-0 relative">
          {hours.map(h => (
            <div
              key={h}
              className="absolute w-full flex items-start justify-end pr-1.5"
              style={{ top: (h - HOUR_START) * HOUR_HEIGHT - 7, height: HOUR_HEIGHT }}
            >
              <span className="text-[9px] text-gray-500 font-medium">{hourToAMPM(h)}</span>
            </div>
          ))}
        </div>

        {/* Single day column */}
        <div
          data-cal-date={date}
          className={`flex-1 relative border-l border-gray-100 ${isToday ? 'bg-amber-50/20' : ''} ${isPast ? 'bg-gray-50/40' : ''}`}
          style={{ height: totalHeight }}
          onClick={e => {
            if (dragState?.isDragging) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const totalMins   = (y / totalHeight) * (HOUR_END - HOUR_START) * 60;
            const roundedMins = Math.round(totalMins / 15) * 15;
            const absMin      = HOUR_START * 60 + roundedMins;
            onSlotClick(date, minToHHMM(Math.min(absMin, (HOUR_END - 1) * 60)));
          }}
        >
          {hours.map(h => (
            <div key={h} className="absolute w-full border-t border-gray-200" style={{ top: (h - HOUR_START) * HOUR_HEIGHT }} />
          ))}
          {hours.map(h => (
            <div key={`h${h}`} className="absolute w-full border-t border-gray-100" style={{ top: (h - HOUR_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
          ))}

          {isToday && nowTop > 0 && nowTop < totalHeight && (
            <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none" style={{ top: nowTop }}>
              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
              <div className="flex-1 border-t-2 border-red-500" />
            </div>
          )}
          {selectionTop !== null && (
            <div className="absolute left-0 right-0 z-10 flex items-center pointer-events-none" style={{ top: selectionTop }}>
              <div className="w-2 h-2 rounded-full bg-gold-500 -ml-1" />
              <div className="flex-1 border-t-2 border-gold-500 border-dashed" />
            </div>
          )}

          {filtered.map(apt => {
            const liveApt = (resizeState?.isDragging && resizeState.aptId === apt.id)
              ? { ...apt, endTime: resizeState.snappedEnd }
              : apt;
            return (
              <AptBlock
                key={apt.id}
                apt={liveApt}
                layout={layout.get(apt.id) || { col: 0, totalCols: 1 }}
                isSelected={selectedApt?.id === apt.id}
                onClick={onAptClick}
                draggable={enableDrag}
                onDragStart={onDragStart}
                resizable={enableResize}
                onResizeStart={onResizeStart}
              />
            );
          })}

          {showGhost && dragState && (
            <GhostBlock
              status={appointments.find(a => a.id === dragState.aptId)?.status || 'confirmed'}
              startTime={dragState.snappedStart}
              endTime={dragState.snappedEnd}
            />
          )}
        </div>
      </div>
    </div>
  );
}
