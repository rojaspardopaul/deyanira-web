'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { CalendarToolbar } from './toolbar/CalendarToolbar';
import { CalendarSidebar } from './sidebar/CalendarSidebar';
import { MonthView } from './views/MonthView';
import { WeekView } from './views/WeekView';
import { DayView } from './views/DayView';
import { ResourceView } from './views/ResourceView';
import { AgendaView } from './views/AgendaView';
import { DayPanel } from './panels/DayPanel';
import { AptModal } from './panels/AptModal';
import { useAppointments } from './hooks/useAppointments';
import { useUndoToast } from './hooks/useUndoToast';
import { useDrag } from './hooks/useDrag';
import { useResize } from './hooks/useResize';
import { toYMD, addDays, getWeekStart, aptDateStr } from './utils/date';
import type { Appointment, AptStatus, CalView, StaffMember } from './types';

export type CalendarRootProps = {
  adminRole: 'super_admin' | 'admin' | 'estilista';
  staffList?: StaffMember[];
  defaultView?: CalView;
  defaultDate?: string;
  defaultHiddenStatuses?: AptStatus[];
  enableDrag?: boolean;
  enableResize?: boolean;
  enableResourceView?: boolean;
  snapMinutes?: number;
  undoDuration?: number;
  onAppointmentMutated?: (apt: Appointment, action: 'created' | 'updated' | 'status_changed') => void;
};

export function CalendarRoot({
  adminRole,
  staffList: externalStaffList,
  defaultView = 'week',
  defaultDate,
  defaultHiddenStatuses = ['cancelled', 'no_show'],
  enableDrag = true,
  enableResize = true,
  enableResourceView = true,
  onAppointmentMutated,
}: CalendarRootProps) {
  const today = toYMD(new Date());

  const [view, setView]                       = useState<CalView>(defaultView);
  const [curDate, setCurDate]                 = useState(defaultDate || today);
  const [selectedDate, setSelectedDate]       = useState(defaultDate || today);
  const [selectedTime, setSelectedTime]       = useState<string | null>(null);
  const [selectedApt, setSelectedApt]         = useState<Appointment | null>(null);
  const [hiddenStatuses, setHiddenStatuses]   = useState<AptStatus[]>(defaultHiddenStatuses);
  const [staffVisibility, setStaffVisibility] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [closedDaysOfWeek, setClosedDaysOfWeek] = useState<Set<number>>(new Set());
  const [salonBlockedDates, setSalonBlockedDates] = useState<Set<string>>(new Set());
  const [salonPartialBlocks, setSalonPartialBlocks] = useState<Array<{ date: string; start: string; end: string }>>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [staffList, setStaffList]             = useState<StaffMember[]>(externalStaffList || []);
  const [defaultStaffId, setDefaultStaffId]   = useState<string | undefined>(undefined);

  const { appointments, loading, load, optimisticUpdate, upsert, subscribeToChanges } = useAppointments();
  const { undoEntry, pushUndo, dismissUndo, triggerUndo } = useUndoToast();

  const canDrag   = enableDrag   && adminRole !== 'estilista';
  const canResize = enableResize && adminRole !== 'estilista';

  // Auto-open sidebar on desktop
  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) setSidebarOpen(true);
  }, []);

  // Fetch salon settings once to determine closed days of week
  useEffect(() => {
    adminApi().settings.get()
      .then((d: unknown) => {
        const s = d as { hoursWeekday?: string; hoursSaturday?: string; hoursSunday?: string };
        const isClosed = (v?: string) => !v || v.toLowerCase().includes('cerrado');
        const closed = new Set<number>();
        if (isClosed(s?.hoursSunday))   closed.add(0);
        if (isClosed(s?.hoursWeekday))  [1, 2, 3, 4, 5].forEach(n => closed.add(n));
        if (isClosed(s?.hoursSaturday)) closed.add(6);
        setClosedDaysOfWeek(closed);
      })
      .catch(() => {});
  }, []);

  // ── Drag (Phase 2) ────────────────────────────────────────────────────────
  const dragOnCommit = useCallback((apt: Appointment, newDate: string, newStart: string, newEnd: string) => {
    const rollback = optimisticUpdate(apt.id, { date: newDate, startTime: newStart, endTime: newEnd });
    const originalDate = aptDateStr(apt);
    pushUndo({
      message: `Cita movida a ${newDate} ${newStart}`,
      rollback: async () => {
        rollback();
        await adminApi().appointments.update(apt.id, {
          date: originalDate,
          startTime: apt.startTime,
          endTime: apt.endTime,
          staffId: apt.staff?.id || null,
        }).catch(() => {});
      },
    });
  }, [optimisticUpdate, pushUndo]);

  const dragOnRollback = useCallback((apt: Appointment) => { upsert(apt); }, [upsert]);

  const { dragState, handleDragStart } = useDrag({ onCommit: dragOnCommit, onRollback: dragOnRollback });

  // ── Resize (Phase 3) ──────────────────────────────────────────────────────
  const resizeOnCommit = useCallback((apt: Appointment, newEndTime: string) => {
    const rollback = optimisticUpdate(apt.id, { endTime: newEndTime });
    pushUndo({
      message: `Duración ajustada a ${newEndTime}`,
      rollback: async () => {
        rollback();
        await adminApi().appointments.update(apt.id, { endTime: apt.endTime }).catch(() => {});
      },
    });
  }, [optimisticUpdate, pushUndo]);

  const resizeOnRollback = useCallback((apt: Appointment) => { upsert(apt); }, [upsert]);

  const { handleResizeStart } = useResize({ onCommit: resizeOnCommit, onRollback: resizeOnRollback });

  // ── Date range ────────────────────────────────────────────────────────────
  const { dateFrom, dateTo } = useMemo(() => {
    const d = new Date(curDate + 'T12:00:00');
    if (view === 'month') {
      return {
        dateFrom: toYMD(new Date(d.getFullYear(), d.getMonth(), 1)),
        dateTo:   toYMD(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
      };
    }
    if (view === 'week') {
      const ws = getWeekStart(d);
      return { dateFrom: toYMD(ws), dateTo: toYMD(addDays(ws, 6)) };
    }
    if (view === 'agenda') {
      return {
        dateFrom: today,
        dateTo: toYMD(addDays(new Date(today + 'T12:00:00'), 30)),
      };
    }
    return { dateFrom: curDate, dateTo: curDate };
  }, [view, curDate, today]);

  // Fetch appointments when date range changes
  useEffect(() => {
    const params = new URLSearchParams({ dateFrom, dateTo });
    load(params);
  }, [load, dateFrom, dateTo]);

  // Phase 6: Supabase Realtime subscription — follows date range
  useEffect(() => {
    subscribeToChanges(dateFrom, dateTo);
  }, [subscribeToChanges, dateFrom, dateTo]);

  // Fetch salon-wide unavailability blocks — must be AFTER dateFrom/dateTo useMemo
  useEffect(() => {
    adminApi().unavailability.list(dateFrom)
      .then((data: unknown) => {
        const items = data as Array<{
          staffId?: string | null;
          date: string;
          startTime?: string | null;
          endTime?: string | null;
        }>;
        const blocked = new Set<string>();
        const partial: Array<{ date: string; start: string; end: string }> = [];
        for (const item of items) {
          if (item.staffId != null) continue; // only salon-wide blocks
          const ds = item.date.slice(0, 10);
          if (!item.startTime) {
            blocked.add(ds);
          } else if (item.startTime && item.endTime) {
            partial.push({ date: ds, start: item.startTime, end: item.endTime });
          }
        }
        setSalonBlockedDates(blocked);
        setSalonPartialBlocks(partial);
      })
      .catch(() => {});
  }, [dateFrom, dateTo]);

  // Load staff list (external prop wins; otherwise fetch once)
  useEffect(() => {
    if (externalStaffList) { setStaffList(externalStaffList); return; }
    adminApi().staff.list()
      .then(d => setStaffList(d as StaffMember[]))
      .catch(() => {});
  }, [externalStaffList]);

  const weekStart = getWeekStart(new Date(curDate + 'T12:00:00'));

  // Appointments filtered by staff visibility (for all views)
  const visibleAppointments = useMemo(() =>
    appointments.filter(a => {
      if (a.staff && staffVisibility[a.staff.id] === false) return false;
      return true;
    }),
    [appointments, staffVisibility],
  );

  // Staff list filtered by visibility (for ResourceView columns)
  const filteredStaffList = useMemo(() =>
    staffList.filter(s => staffVisibility[s.id] !== false),
    [staffList, staffVisibility],
  );

  // Dates with at least one appointment (for MiniCalendar dots)
  const markedDates = useMemo(() =>
    new Set(appointments.map(a => aptDateStr(a))),
    [appointments],
  );

  const dayAptsForPanel = useMemo(() =>
    visibleAppointments
      .filter(a => aptDateStr(a) === selectedDate && !hiddenStatuses.includes(a.status))
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [visibleAppointments, selectedDate, hiddenStatuses],
  );

  // ── Navigation ────────────────────────────────────────────────────────────
  function goPrev() {
    const d = new Date(curDate + 'T12:00:00');
    if (view === 'month') d.setMonth(d.getMonth() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurDate(toYMD(d));
    if (view === 'day' || view === 'resource') setSelectedDate(toYMD(d));
  }

  function goNext() {
    const d = new Date(curDate + 'T12:00:00');
    if (view === 'month') d.setMonth(d.getMonth() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurDate(toYMD(d));
    if (view === 'day' || view === 'resource') setSelectedDate(toYMD(d));
  }

  function goToday() { setCurDate(today); setSelectedDate(today); }

  // ── Interaction handlers ──────────────────────────────────────────────────
  function handleSlotClick(date: string, time: string, staffId?: string) {
    setSelectedDate(date);
    setSelectedTime(time || null);
    setSelectedApt(null);
    setDefaultStaffId(staffId);
    if (time) setShowMobilePanel(true);
  }

  function handleAptClick(apt: Appointment) {
    setSelectedApt(apt);
    setSelectedDate(aptDateStr(apt));
    setShowMobilePanel(true);
  }

  function handleDayClick(date: string) {
    setSelectedDate(date);
    setSelectedTime(null);
    setSelectedApt(null);
    setDefaultStaffId(undefined);
    setShowMobilePanel(true);
    if (view === 'month') { setCurDate(date); setView('day'); }
  }

  // Clicking a day header in WeekView switches to that day
  function handleDayHeaderClick(date: string) {
    setCurDate(date);
    setSelectedDate(date);
    setSelectedTime(null);
    setSelectedApt(null);
    setView('day');
  }

  function handleSidebarDateSelect(date: string) {
    setCurDate(date);
    setSelectedDate(date);
    setSelectedTime(null);
    setSelectedApt(null);
    if (view === 'month' || view === 'agenda') setView('day');
  }

  function toggleHidden(s: AptStatus) {
    setHiddenStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  function toggleStaffVisibility(id: string) {
    setStaffVisibility(prev => ({ ...prev, [id]: prev[id] !== false }));
  }

  // ── Status mutation (used by AptModal) ────────────────────────────────────
  async function handleStatusChange(id: string, status: AptStatus): Promise<void> {
    const rollback = optimisticUpdate(id, { status });
    try {
      await adminApi().appointments.update(id, { status });
      if (selectedApt?.id === id) setSelectedApt(prev => prev ? { ...prev, status } : null);
      onAppointmentMutated?.(appointments.find(a => a.id === id)!, 'status_changed');
    } catch {
      rollback();
      throw new Error('Error al actualizar estado');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <CalendarToolbar
        view={view}
        curDate={curDate}
        loading={loading}
        staffList={staffList}
        adminRole={adminRole}
        sidebarOpen={sidebarOpen}
        enableResourceView={enableResourceView}
        onViewChange={setView}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
        onToggleSidebar={() => setSidebarOpen(v => !v)}
        onNewApt={() => setShowCreateModal(true)}
      />

      <div className="flex flex-1 overflow-hidden relative">

        {/* Left sidebar (mini-calendar + filters) */}
        <CalendarSidebar
          open={sidebarOpen}
          curDate={selectedDate}
          today={today}
          markedDates={markedDates}
          staffList={staffList}
          staffVisibility={staffVisibility}
          hiddenStatuses={hiddenStatuses}
          closedDaysOfWeek={closedDaysOfWeek}
          onDateSelect={handleSidebarDateSelect}
          onToggleStaff={toggleStaffVisibility}
          onToggleStatus={toggleHidden}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Mobile backdrop for sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 lg:hidden bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Calendar views */}
        <div className="flex flex-col flex-1 overflow-hidden border-r border-gray-200 min-w-0">
          {view === 'month' && (
            <MonthView
              year={new Date(curDate + 'T12:00:00').getFullYear()}
              month={new Date(curDate + 'T12:00:00').getMonth()}
              appointments={visibleAppointments}
              selectedDate={selectedDate}
              hiddenStatuses={hiddenStatuses}
              today={today}
              onDateClick={handleDayClick}
              onAptClick={handleAptClick}
            />
          )}
          {view === 'week' && (
            <WeekView
              weekStart={weekStart}
              appointments={visibleAppointments}
              hiddenStatuses={hiddenStatuses}
              today={today}
              selectedApt={selectedApt}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              onSlotClick={handleSlotClick}
              onAptClick={handleAptClick}
              onDayHeaderClick={handleDayHeaderClick}
              dragState={dragState}
              onDragStart={canDrag ? handleDragStart : undefined}
              enableDrag={canDrag}
              onResizeStart={canResize ? handleResizeStart : undefined}
              enableResize={canResize}
              closedDaysOfWeek={closedDaysOfWeek}
              blockedDates={salonBlockedDates}
              partialBlocks={salonPartialBlocks}
            />
          )}
          {view === 'day' && (
            <DayView
              date={curDate}
              appointments={visibleAppointments}
              hiddenStatuses={hiddenStatuses}
              today={today}
              selectedApt={selectedApt}
              selectedTime={selectedTime}
              weekStart={weekStart}
              onSlotClick={handleSlotClick}
              onAptClick={handleAptClick}
              onDayClick={date => { setCurDate(date); setSelectedDate(date); }}
              dragState={dragState}
              onDragStart={canDrag ? handleDragStart : undefined}
              enableDrag={canDrag}
              onResizeStart={canResize ? handleResizeStart : undefined}
              enableResize={canResize}
              closedDaysOfWeek={closedDaysOfWeek}
            />
          )}
          {view === 'resource' && (
            <ResourceView
              date={curDate}
              staffList={filteredStaffList}
              appointments={visibleAppointments}
              hiddenStatuses={hiddenStatuses}
              today={today}
              selectedApt={selectedApt}
              onSlotClick={handleSlotClick}
              onAptClick={handleAptClick}
              dragState={dragState}
              onDragStart={canDrag ? handleDragStart : undefined}
              enableDrag={canDrag}
              onResizeStart={canResize ? handleResizeStart : undefined}
              enableResize={canResize}
            />
          )}
          {view === 'agenda' && (
            <AgendaView
              appointments={appointments}
              hiddenStatuses={hiddenStatuses}
              staffVisibility={staffVisibility}
              today={today}
              dateFrom={dateFrom}
              dateTo={dateTo}
              selectedApt={selectedApt}
              onAptClick={handleAptClick}
            />
          )}
        </div>

        {/* Desktop right panel — only on xl+ */}
        <aside className="w-[280px] shrink-0 hidden xl:block overflow-hidden border-l border-gray-100">
          <DayPanel
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            dayApts={dayAptsForPanel}
            adminRole={adminRole}
            onCreate={() => setShowCreateModal(true)}
            onAptClick={handleAptClick}
            onClearTime={() => setSelectedTime(null)}
          />
        </aside>
      </div>

      {/* Mobile bottom sheet (DayPanel) */}
      {showMobilePanel && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end xl:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowMobilePanel(false)}
          />
          <div className="relative bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <button
              onClick={() => setShowMobilePanel(false)}
              className="absolute top-2 right-3 p-1.5 text-gray-400 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex-1 overflow-hidden">
              <DayPanel
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                dayApts={dayAptsForPanel}
                adminRole={adminRole}
                onCreate={() => { setShowMobilePanel(false); setShowCreateModal(true); }}
                onAptClick={apt => { setShowMobilePanel(false); setSelectedApt(apt); }}
                onClearTime={() => setSelectedTime(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Appointment detail / edit modal */}
      {selectedApt && (
        <AptModal
          apt={selectedApt}
          staffList={staffList}
          adminRole={adminRole}
          onClose={() => setSelectedApt(null)}
          onCreated={() => {}}
          onUpdated={updated => {
            upsert(updated);
            setSelectedApt(updated);
            onAppointmentMutated?.(updated, 'updated');
          }}
          onStatusChanged={async (id, status) => {
            await handleStatusChange(id, status);
          }}
        />
      )}

      {/* Create appointment modal */}
      {showCreateModal && (
        <AptModal
          defaultDate={selectedDate || today}
          defaultTime={selectedTime || ''}
          defaultStaffId={defaultStaffId}
          staffList={staffList}
          adminRole={adminRole}
          onClose={() => setShowCreateModal(false)}
          onCreated={apt => {
            setShowCreateModal(false);
            upsert(apt);
            setSelectedTime(null);
            setDefaultStaffId(undefined);
            onAppointmentMutated?.(apt, 'created');
          }}
          onUpdated={() => {}}
          onStatusChanged={async () => {}}
        />
      )}

      {/* Undo toast */}
      {undoEntry && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl animate-in slide-in-from-bottom-4">
          <span className="text-sm">{undoEntry.message}</span>
          <button
            onClick={triggerUndo}
            className="text-xs font-bold text-gold-400 hover:text-gold-300 transition-colors"
          >
            Deshacer
          </button>
          <button onClick={dismissUndo} className="text-gray-400 hover:text-white ml-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
