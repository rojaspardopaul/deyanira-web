'use client';

import React from 'react';
import { STATUS } from '../status';
import { timeToMin } from '../utils/time';
import { clientName } from '../utils/date';
import { HOUR_START, HOUR_HEIGHT } from '../constants';
import type { Appointment, LayoutInfo } from '../types';

type AptBlockProps = {
  apt: Appointment;
  layout: LayoutInfo;
  isSelected: boolean;
  onClick: (a: Appointment) => void;
  /** When true, show a grab cursor and emit onDragStart */
  draggable?: boolean;
  onDragStart?: (apt: Appointment, e: React.PointerEvent, offsetY: number) => void;
  /** When true, show the resize handle at the bottom */
  resizable?: boolean;
  onResizeStart?: (apt: Appointment, e: React.PointerEvent) => void;
};

export function AptBlock({
  apt, layout, isSelected, onClick,
  draggable = false, onDragStart,
  resizable = false, onResizeStart,
}: AptBlockProps) {
  const cfg = STATUS[apt.status];
  const startMin = timeToMin(apt.startTime);
  const endMin   = timeToMin(apt.endTime);
  const top    = (startMin / 60 - HOUR_START) * HOUR_HEIGHT;
  const height = Math.max(20, (endMin - startMin) / 60 * HOUR_HEIGHT);
  const compact = height < 36;

  const widthPct = 100 / layout.totalCols;
  const leftPct  = layout.col * widthPct;

  function handlePointerDown(e: React.PointerEvent) {
    if (!draggable || !onDragStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    onDragStart(apt, e, offsetY);
  }

  return (
    <div
      className={`absolute rounded border-l-4 ${cfg.border} ${cfg.bgLight} overflow-hidden transition-shadow
        ${isSelected ? 'ring-2 ring-gold-400 ring-offset-1 z-30 shadow-md' : 'hover:z-20 hover:shadow-sm'}
        ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      style={{
        top, height,
        left: `calc(${leftPct}% + 1px)`,
        width: `calc(${widthPct}% - 3px)`,
      }}
      onPointerDown={draggable ? handlePointerDown : undefined}
      onClick={(e) => { e.stopPropagation(); onClick(apt); }}
    >
      <div className="px-1 py-0.5 h-full flex flex-col justify-start">
        <p className={`text-[10px] font-bold ${cfg.text} truncate leading-tight`}>
          {apt.startTime} {clientName(apt)}
        </p>
        {!compact && (
          <p className="text-[9px] text-gray-500 truncate leading-tight">{apt.service.name}</p>
        )}
        {!compact && apt.staff && (
          <p className="text-[9px] text-gray-400 truncate">{apt.staff.name}</p>
        )}
        {!compact && !apt.staff && apt.onDutyStaff && (
          <p className="text-[9px] text-purple-500 truncate">Sin asignar</p>
        )}
      </div>

      {/* Resize handle — bottom 8px strip */}
      {resizable && !compact && onResizeStart && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          onPointerDown={(e) => { e.stopPropagation(); onResizeStart(apt, e); }}
        >
          <div className="w-6 h-0.5 rounded-full bg-current opacity-40" />
        </div>
      )}
    </div>
  );
}
