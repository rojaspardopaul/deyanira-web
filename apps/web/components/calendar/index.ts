// Public API of the calendar library
export { CalendarRoot } from './CalendarRoot';
export type { CalendarRootProps } from './CalendarRoot';

// Views
export { MonthView } from './views/MonthView';
export { WeekView } from './views/WeekView';
export { DayView } from './views/DayView';
export { ResourceView } from './views/ResourceView';
export { AgendaView } from './views/AgendaView';

// Sidebar
export { CalendarSidebar } from './sidebar/CalendarSidebar';
export { MiniCalendar } from './sidebar/MiniCalendar';
export { StaffFilters } from './sidebar/StaffFilters';

// Panels
export { DayPanel } from './panels/DayPanel';
export { AptModal } from './panels/AptModal';

// Toolbar
export { CalendarToolbar } from './toolbar/CalendarToolbar';

// Blocks
export { AptBlock } from './blocks/AptBlock';
export { GhostBlock } from './blocks/GhostBlock';
export { ResizeHandle } from './blocks/ResizeHandle';

// Hooks
export { useAppointments } from './hooks/useAppointments';
export { useUndoToast } from './hooks/useUndoToast';
export { useSidebarToggle } from './hooks/useSidebarToggle';
export { useDrag } from './hooks/useDrag';
export { useResize } from './hooks/useResize';

// Utils (pure functions)
export { toYMD, addDays, getWeekStart, aptDateStr, isPastDate, isPastDateTime, clientName } from './utils/date';
export { timeToMin, minToHHMM, snapToGrid, clamp, hourToAMPM, fmtTime12, fmtRange12 } from './utils/time';
export { computeOverlapLayout } from './utils/layout';

// Constants
export { HOUR_START, HOUR_END, HOUR_HEIGHT, SNAP_MINUTES, MONTH_NAMES, DAY_NAMES_SHORT, DAY_NAMES_FULL, DAY_NAMES_SUN, STAFF_COLORS, staffColor } from './constants';

// Status config
export { STATUS, ALL_STATUSES } from './status';

// Types
export type { Appointment, AptStatus, CalView, StaffMember, Slot, LayoutInfo, DragState, ResizeState, UndoEntry } from './types';
