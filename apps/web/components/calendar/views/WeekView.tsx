'use client';

import { toYMD, addDays, aptDateStr, isPastDate } from '../utils/date';
import { timeToMin, minToHHMM, snapToGrid, clamp, hourToAMPM } from '../utils/time';
import { computeOverlapLayout } from '../utils/layout';
import { AptBlock } from '../blocks/AptBlock';
import { GhostBlock } from '../blocks/GhostBlock';
import { DAY_NAMES_SHORT, HOUR_START, HOUR_END, HOUR_HEIGHT } from '../constants';
import type { Appointment, AptStatus, DragState } from '../types';

type PartialBlock = { date: string; start: string; end: string };

type WeekViewProps = {
  weekStart: Date;
  appointments: Appointment[];
  hiddenStatuses: AptStatus[];
  today: string;
  selectedApt: Appointment | null;
  selectedDate: string;
  selectedTime: string | null;
  onSlotClick: (date: string, time: string) => void;
  onAptClick: (apt: Appointment) => void;
  onDayHeaderClick?: (date: string) => void;
  dragState?: DragState | null;
  onDragStart?: (apt: Appointment, e: React.PointerEvent, offsetY: number) => void;
  onResizeStart?: (apt: Appointment, e: React.PointerEvent) => void;
  enableDrag?: boolean;
  enableResize?: boolean;
  closedDaysOfWeek?: Set<number>;
  blockedDates?: Set<string>;
  partialBlocks?: PartialBlock[];
};

export function WeekView({
  weekStart, appointments, hiddenStatuses, today,
  selectedApt, selectedDate, selectedTime,
  onSlotClick, onAptClick, onDayHeaderClick,
  dragState, onDragStart, onResizeStart,
  enableDrag = false, enableResize = false,
  closedDaysOfWeek, blockedDates, partialBlocks = [],
}: WeekViewProps) {
  const hours       = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const days        = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const totalHeight = (HOUR_END - HOUR_START) * HOUR_HEIGHT;
  const filtered    = appointments.filter(a => !hiddenStatuses.includes(a.status));

  const now    = new Date();
  const nowTop = (now.getHours() + now.getMinutes() / 60 - HOUR_START) * HOUR_HEIGHT;

  return (
    <div className="flex-1 overflow-auto bg-white">
      <div className="min-w-[560px]">
        {/* Day headers */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 flex">
          <div className="w-12 shrink-0" />
          {days.map((day, i) => {
            const ds       = toYMD(day);
            const isToday  = ds === today;
            const isSel    = ds === selectedDate;
            const isClosed = closedDaysOfWeek?.has(day.getDay()) || blockedDates?.has(ds);
            return (
              <div
                key={i}
                className={`flex-1 min-w-[64px] text-center py-1.5 border-l border-gray-100 transition-colors
                  ${isClosed
                    ? 'cursor-not-allowed bg-red-50/30'
                    : 'cursor-pointer hover:bg-gray-50'}
                  ${isSel && !isClosed ? 'bg-amber-50' : ''}
                  ${isToday && !isClosed ? 'bg-amber-50/60' : ''}`}
                onClick={() => !isClosed && onDayHeaderClick?.(ds)}
              >
                <p className={`text-[10px] font-semibold uppercase tracking-wide
                  ${isClosed ? 'text-red-300' : isToday ? 'text-gold-600' : 'text-gray-400'}`}>
                  {DAY_NAMES_SHORT[i]}
                </p>
                <p className={`text-base font-bold
                  ${isClosed
                    ? 'text-red-400'
                    : isToday ? 'text-gold-600'
                    : isSel ? 'text-gold-500'
                    : 'text-gray-800'}`}>
                  {day.getDate()}
                </p>
                {isClosed && (
                  <span className="text-[8px] text-red-300 font-medium leading-none">Cerrado</span>
                )}
              </div>
            );
          })}
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

          {/* Day columns — each carries its date for pointer hit-testing */}
          {days.map((day, di) => {
            const ds          = toYMD(day);
            const isToday     = ds === today;
            const isPast      = isPastDate(ds);
            const isClosed    = closedDaysOfWeek?.has(day.getDay()) || blockedDates?.has(ds);
            const dayApts     = filtered.filter(a => aptDateStr(a) === ds);
            const layout      = computeOverlapLayout(dayApts);
            const isSelDay    = ds === selectedDate;
            const selectionTop = isSelDay && selectedTime
              ? (timeToMin(selectedTime) / 60 - HOUR_START) * HOUR_HEIGHT
              : null;
            const showGhost   = dragState?.isDragging && dragState.targetDate === ds;
            const colBlocks   = isClosed ? [] : partialBlocks.filter(b => b.date === ds);

            return (
              <div
                key={di}
                data-cal-date={ds}
                className={`flex-1 min-w-[64px] relative border-l border-gray-100
                  ${isClosed
                    ? 'bg-red-50/20'
                    : isToday ? 'bg-amber-50/20'
                    : isPast  ? 'bg-gray-50/40'
                    : ''}`}
                style={{ height: totalHeight }}
                onClick={e => {
                  if (isClosed || dragState?.isDragging) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const totalMins   = (y / totalHeight) * (HOUR_END - HOUR_START) * 60;
                  const roundedMins = Math.round(totalMins / 15) * 15;
                  const absMin      = HOUR_START * 60 + roundedMins;
                  const clickedTime = minToHHMM(Math.min(absMin, (HOUR_END - 1) * 60));
                  // Block clicks inside partial blocked ranges
                  if (colBlocks.some(b => clickedTime >= b.start && clickedTime < b.end)) return;
                  onSlotClick(ds, clickedTime);
                }}
              >
                {/* Hour grid lines */}
                {hours.map(h => (
                  <div key={h} className="absolute w-full border-t border-gray-200" style={{ top: (h - HOUR_START) * HOUR_HEIGHT }} />
                ))}
                {hours.map(h => (
                  <div key={`h${h}`} className="absolute w-full border-t border-gray-100" style={{ top: (h - HOUR_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
                ))}

                {/* Closed day: diagonal stripe overlay */}
                {isClosed && (
                  <div
                    className="absolute inset-0 pointer-events-none z-[1]"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(239,68,68,0.06) 12px, rgba(239,68,68,0.06) 13px)',
                    }}
                  />
                )}

                {/* Partial block overlays */}
                {colBlocks.map((b, idx) => {
                  const top = (timeToMin(b.start) / 60 - HOUR_START) * HOUR_HEIGHT;
                  const h   = (timeToMin(b.end) - timeToMin(b.start)) / 60 * HOUR_HEIGHT;
                  return (
                    <div
                      key={idx}
                      className="absolute left-0 right-0 bg-gray-100/80 border-l-2 border-gray-300 z-[1] pointer-events-none"
                      style={{ top, height: h }}
                    />
                  );
                })}

                {/* Now indicator */}
                {isToday && nowTop > 0 && nowTop < totalHeight && (
                  <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none" style={{ top: nowTop }}>
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                    <div className="flex-1 border-t-2 border-red-500" />
                  </div>
                )}

                {/* Selection indicator */}
                {selectionTop !== null && (
                  <div className="absolute left-0 right-0 z-10 flex items-center pointer-events-none" style={{ top: selectionTop }}>
                    <div className="w-2 h-2 rounded-full bg-gold-500 -ml-1" />
                    <div className="flex-1 border-t-2 border-gold-500 border-dashed" />
                  </div>
                )}

                {dayApts.map(apt => (
                  <AptBlock
                    key={apt.id}
                    apt={apt}
                    layout={layout.get(apt.id) || { col: 0, totalCols: 1 }}
                    isSelected={selectedApt?.id === apt.id}
                    onClick={onAptClick}
                    draggable={enableDrag}
                    onDragStart={onDragStart}
                    resizable={enableResize}
                    onResizeStart={onResizeStart}
                  />
                ))}

                {showGhost && dragState && (
                  <GhostBlock
                    status={appointments.find(a => a.id === dragState.aptId)?.status || 'confirmed'}
                    startTime={dragState.snappedStart}
                    endTime={dragState.snappedEnd}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// keep unused imports from tree-shaking
void snapToGrid; void clamp;
