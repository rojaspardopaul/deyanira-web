'use client';

import { toYMD, aptDateStr, clientName } from '../utils/date';
import { timeToMin, minToHHMM, hourToAMPM } from '../utils/time';
import { computeOverlapLayout } from '../utils/layout';
import { AptBlock } from '../blocks/AptBlock';
import { GhostBlock } from '../blocks/GhostBlock';
import { MONTH_NAMES, DAY_NAMES_FULL, HOUR_START, HOUR_END, HOUR_HEIGHT } from '../constants';
import type { Appointment, AptStatus, DragState, ResizeState, StaffMember } from '../types';

type ResourceViewProps = {
  date: string;
  staffList: StaffMember[];
  appointments: Appointment[];
  hiddenStatuses: AptStatus[];
  today: string;
  selectedApt: Appointment | null;
  onSlotClick: (date: string, time: string, staffId?: string) => void;
  onAptClick: (apt: Appointment) => void;
  dragState?: DragState | null;
  resizeState?: ResizeState | null;
  onDragStart?: (apt: Appointment, e: React.PointerEvent, offsetY: number) => void;
  onResizeStart?: (apt: Appointment, e: React.PointerEvent) => void;
  enableDrag?: boolean;
  enableResize?: boolean;
};

export function ResourceView({
  date, staffList, appointments, hiddenStatuses, today,
  selectedApt, onSlotClick, onAptClick,
  dragState, resizeState, onDragStart, onResizeStart,
  enableDrag = false, enableResize = false,
}: ResourceViewProps) {
  const liveEnd = (apt: Appointment): Appointment =>
    (resizeState?.isDragging && resizeState.aptId === apt.id)
      ? { ...apt, endTime: resizeState.snappedEnd }
      : apt;
  const hours       = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const totalHeight = (HOUR_END - HOUR_START) * HOUR_HEIGHT;
  const isToday     = date === today;

  const d      = new Date(date + 'T12:00:00');
  const dow    = d.getDay();
  const dayIdx = dow === 0 ? 6 : dow - 1;

  const filtered = appointments.filter(a =>
    aptDateStr(a) === date && !hiddenStatuses.includes(a.status)
  );

  const now    = new Date();
  const nowTop = (now.getHours() + now.getMinutes() / 60 - HOUR_START) * HOUR_HEIGHT;

  // Group appointments by staffId (or "unassigned" bucket)
  const UNASSIGNED = '__unassigned__';
  const staffIds   = [...staffList.map(s => s.id), UNASSIGNED];
  const byStaff    = new Map<string, Appointment[]>();
  for (const sid of staffIds) byStaff.set(sid, []);
  for (const apt of filtered) {
    const key = apt.staff?.id || UNASSIGNED;
    if (byStaff.has(key)) byStaff.get(key)!.push(apt);
    else byStaff.get(UNASSIGNED)!.push(apt);
  }

  // Only show columns that have staff + unassigned if it has appointments
  const visibleStaff = staffList.filter(s => true); // show all staff always
  const unassigned   = byStaff.get(UNASSIGNED) || [];

  return (
    <div className="flex-1 overflow-auto bg-white">
      <div style={{ minWidth: `${52 + (visibleStaff.length + (unassigned.length > 0 ? 1 : 0)) * 140}px` }}>

        {/* Date header */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 flex">
          <div className="w-12 shrink-0 px-1 py-2 flex flex-col justify-end">
            <p className={`text-[10px] font-bold uppercase tracking-wide ${isToday ? 'text-gold-600' : 'text-gray-400'}`}>
              {DAY_NAMES_FULL[dayIdx].slice(0, 2)}
            </p>
            <p className={`text-base font-bold leading-none ${isToday ? 'text-gold-600' : 'text-gray-800'}`}>
              {d.getDate()} {MONTH_NAMES[d.getMonth()].slice(0, 3)}
            </p>
          </div>

          {/* Staff column headers */}
          {visibleStaff.map(staff => (
            <div key={staff.id} className="flex-none w-[140px] border-l border-gray-100 px-2 py-2 text-center">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-1">
                <span className="text-xs font-bold text-gold-700">{staff.name.slice(0, 2).toUpperCase()}</span>
              </div>
              <p className="text-xs font-semibold text-gray-700 truncate">{staff.name}</p>
              <p className="text-[10px] text-gray-400">{(byStaff.get(staff.id) || []).length} cita{(byStaff.get(staff.id) || []).length !== 1 ? 's' : ''}</p>
            </div>
          ))}
          {unassigned.length > 0 && (
            <div className="flex-none w-[140px] border-l border-gray-100 px-2 py-2 text-center">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-1">
                <span className="text-xs font-bold text-purple-600">?</span>
              </div>
              <p className="text-xs font-semibold text-purple-600 truncate">Sin asignar</p>
              <p className="text-[10px] text-gray-400">{unassigned.length} cita{unassigned.length !== 1 ? 's' : ''}</p>
            </div>
          )}
        </div>

        {/* Time grid — data-cal-grid for drag detection */}
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

          {/* Staff columns — each gets data-cal-date AND data-cal-staff for drag detection */}
          {visibleStaff.map(staff => {
            const staffApts = byStaff.get(staff.id) || [];
            const layout    = computeOverlapLayout(staffApts);
            const showGhost = dragState?.isDragging
              && dragState.targetDate === date
              && dragState.targetStaffId === staff.id;

            return (
              <div
                key={staff.id}
                data-cal-date={date}
                data-cal-staff={staff.id}
                className="flex-none w-[140px] relative border-l border-gray-100"
                style={{ height: totalHeight }}
                onClick={e => {
                  if (dragState?.isDragging) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const totalMins   = (y / totalHeight) * (HOUR_END - HOUR_START) * 60;
                  const roundedMins = Math.round(totalMins / 15) * 15;
                  const absMin      = HOUR_START * 60 + roundedMins;
                  onSlotClick(date, minToHHMM(Math.min(absMin, (HOUR_END - 1) * 60)), staff.id);
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

                {staffApts.map(apt => (
                  <AptBlock
                    key={apt.id}
                    apt={liveEnd(apt)}
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

          {/* Unassigned column */}
          {unassigned.length > 0 && (
            (() => {
              const layout    = computeOverlapLayout(unassigned);
              const showGhost = dragState?.isDragging
                && dragState.targetDate === date
                && !dragState.targetStaffId;
              return (
                <div
                  data-cal-date={date}
                  className="flex-none w-[140px] relative border-l border-purple-100 bg-purple-50/30"
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
                  {unassigned.map(apt => (
                    <AptBlock
                      key={apt.id}
                      apt={liveEnd(apt)}
                      layout={layout.get(apt.id) || { col: 0, totalCols: 1 }}
                      isSelected={selectedApt?.id === apt.id}
                      onClick={onAptClick}
                      draggable={false}
                      resizable={false}
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
            })()
          )}
        </div>
      </div>
    </div>
  );
}

// keep unused import
void clientName;
