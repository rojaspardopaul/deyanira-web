'use client';

import { STATUS } from '../status';
import { timeToMin } from '../utils/time';
import { HOUR_START, HOUR_HEIGHT } from '../constants';
import type { AptStatus } from '../types';

type GhostBlockProps = {
  status: AptStatus;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  /** Left offset as a percentage of the column container width */
  leftPct?: number;
  /** Width as a percentage of the column container width */
  widthPct?: number;
};

/**
 * Translucent overlay rendered during a drag-to-reschedule operation.
 * It has pointer-events: none so it never interferes with drop target detection.
 */
export function GhostBlock({ status, startTime, endTime, leftPct = 0, widthPct = 100 }: GhostBlockProps) {
  const cfg = STATUS[status];
  const startMin = timeToMin(startTime);
  const endMin   = timeToMin(endTime);
  const top    = (startMin / 60 - HOUR_START) * HOUR_HEIGHT;
  const height = Math.max(20, (endMin - startMin) / 60 * HOUR_HEIGHT);

  return (
    <div
      className={`absolute rounded border-l-4 ${cfg.border} ${cfg.bgFull} pointer-events-none z-40`}
      style={{
        top,
        height,
        left: `${leftPct}%`,
        width: `calc(${widthPct}% - 4px)`,
        opacity: 0.35,
      }}
    >
      <div className="px-1 py-0.5">
        <p className="text-[10px] font-bold text-white truncate leading-tight">{startTime}</p>
      </div>
    </div>
  );
}
