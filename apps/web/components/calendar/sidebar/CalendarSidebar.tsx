'use client';

import { X } from 'lucide-react';
import { MiniCalendar } from './MiniCalendar';
import { StaffFilters } from './StaffFilters';
import type { AptStatus, StaffMember } from '../types';

type CalendarSidebarProps = {
  open: boolean;
  curDate: string;
  today: string;
  markedDates: Set<string>;
  staffList: StaffMember[];
  staffVisibility: Record<string, boolean>;
  hiddenStatuses: AptStatus[];
  categoryOptions: { slug: string; name: string }[];
  hiddenCategories: string[];
  closedDaysOfWeek?: Set<number>;
  onDateSelect: (date: string) => void;
  onToggleStaff: (id: string) => void;
  onToggleStatus: (s: AptStatus) => void;
  onToggleCategory: (slug: string) => void;
  onClose: () => void;
};

export function CalendarSidebar({
  open, curDate, today, markedDates,
  staffList, staffVisibility, hiddenStatuses,
  categoryOptions, hiddenCategories,
  closedDaysOfWeek,
  onDateSelect, onToggleStaff, onToggleStatus, onToggleCategory,
  onClose,
}: CalendarSidebarProps) {
  return (
    <>
      {/* Desktop: inline sidebar (width animates open/closed) */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-white border-r border-gray-200 overflow-hidden transition-all duration-200`}
        style={{ width: open ? 220 : 0 }}
      >
        <div className="w-[220px] flex flex-col h-full overflow-hidden">
          <MiniCalendar
            value={curDate}
            today={today}
            markedDates={markedDates}
            closedDaysOfWeek={closedDaysOfWeek}
            onSelect={onDateSelect}
          />
          <div className="mx-3 border-t border-gray-100" />
          <StaffFilters
            staffList={staffList}
            staffVisibility={staffVisibility}
            onToggleStaff={onToggleStaff}
            hiddenStatuses={hiddenStatuses}
            onToggleStatus={onToggleStatus}
            categoryOptions={categoryOptions}
            hiddenCategories={hiddenCategories}
            onToggleCategory={onToggleCategory}
          />
        </div>
      </aside>

      {/* Mobile: fixed drawer from left */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl flex flex-col transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-gray-100 shrink-0">
          <span className="text-sm font-bold text-gray-700">Filtros</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar filtros"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <MiniCalendar
          value={curDate}
          today={today}
          markedDates={markedDates}
          onSelect={date => { onDateSelect(date); onClose(); }}
        />
        <div className="mx-3 border-t border-gray-100" />
        <StaffFilters
          staffList={staffList}
          staffVisibility={staffVisibility}
          onToggleStaff={onToggleStaff}
          hiddenStatuses={hiddenStatuses}
          onToggleStatus={onToggleStatus}
          categoryOptions={categoryOptions}
          hiddenCategories={hiddenCategories}
          onToggleCategory={onToggleCategory}
        />
      </div>
    </>
  );
}
