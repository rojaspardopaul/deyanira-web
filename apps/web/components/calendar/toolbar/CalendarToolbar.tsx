'use client';

import { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Layers,
  CalendarDays, Users, List, LayoutGrid, AlignJustify,
} from 'lucide-react';
import { MONTH_NAMES } from '../constants';
import { addDays, getWeekStart } from '../utils/date';
import type { CalView, StaffMember } from '../types';

type CalendarToolbarProps = {
  view: CalView;
  curDate: string;
  loading: boolean;
  staffList: StaffMember[];
  adminRole: string;
  sidebarOpen: boolean;
  enableResourceView?: boolean;
  onViewChange: (v: CalView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onToggleSidebar: () => void;
  onNewApt: () => void;
};

const VIEWS: [CalView, string, FC<{ className?: string }>][] = [
  ['day',      'Día',    CalendarDays],
  ['week',     'Sem',    Layers],
  ['month',    'Mes',    Calendar],
  ['resource', 'Staff',  Users],
  ['agenda',   'Agenda', List],
];

export function CalendarToolbar({
  view, curDate, loading, adminRole, sidebarOpen,
  enableResourceView = true,
  onViewChange, onPrev, onNext, onToday, onToggleSidebar, onNewApt,
}: CalendarToolbarProps) {
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!viewMenuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setViewMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [viewMenuOpen]);

  const periodLabel = (() => {
    const d = new Date(curDate + 'T12:00:00');
    if (view === 'month') return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    if (view === 'week') {
      const ws = getWeekStart(d);
      const we = addDays(ws, 6);
      if (ws.getMonth() === we.getMonth())
        return `${ws.getDate()}–${we.getDate()} ${MONTH_NAMES[ws.getMonth()]} ${ws.getFullYear()}`;
      return `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()].slice(0,3)} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()].slice(0,3)} ${we.getFullYear()}`;
    }
    if (view === 'agenda') return `Agenda — ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  })();

  const visibleViews = VIEWS.filter(([v]) => v !== 'resource' || enableResourceView);
  const currentViewLabel = VIEWS.find(([v]) => v === view)?.[1] ?? '';

  return (
    <div className="shrink-0 bg-white border-b border-gray-200 px-3 py-2">
      <div className="flex items-center gap-1.5 flex-wrap">

        {/* Sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle filtros"
          className={`p-1.5 rounded-lg transition-colors shrink-0
            ${sidebarOpen ? 'bg-amber-50 text-gold-600' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          <AlignJustify className="w-4 h-4" />
        </button>

        {/* Navigation */}
        <div className="flex items-center gap-0.5">
          <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onToday}
            className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Hoy
          </button>
          <button onClick={onNext} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Period label */}
        <span className="font-bold text-gray-900 text-sm flex-1 text-center capitalize truncate min-w-0">
          {periodLabel}
        </span>
        {loading && <span className="text-xs text-gold-500 font-medium animate-pulse shrink-0">Cargando...</span>}

        {/* View switcher — desktop: button group / mobile: icon dropdown */}
        <div className="relative shrink-0" ref={menuRef}>
          {/* Desktop buttons (hidden on mobile) */}
          <div className="hidden sm:flex items-center bg-gray-100 rounded-xl p-0.5">
            {visibleViews.map(([v, label, Icon]) => (
              <button
                key={v}
                onClick={() => onViewChange(v)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors
                  ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* Mobile: single icon button that opens dropdown */}
          <button
            onClick={() => setViewMenuOpen(v => !v)}
            className={`sm:hidden flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-semibold border transition-colors
              ${viewMenuOpen ? 'bg-gray-100 text-gray-900 border-gray-200' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>{currentViewLabel}</span>
          </button>

          {/* Mobile dropdown */}
          {viewMenuOpen && (
            <div className="sm:hidden absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[150px] py-1">
              {visibleViews.map(([v, label, Icon]) => (
                <button
                  key={v}
                  onClick={() => { onViewChange(v); setViewMenuOpen(false); }}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors
                    ${view === v ? 'text-gold-600 font-semibold bg-amber-50' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* New appointment button */}
        {adminRole !== 'estilista' && (
          <button
            onClick={onNewApt}
            className="flex items-center gap-1 px-3 py-2 bg-gold-400 hover:bg-gold-500 text-gray-900 text-xs font-bold rounded-xl transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nueva cita</span>
            <span className="sm:hidden">Nueva</span>
          </button>
        )}
      </div>
    </div>
  );
}
