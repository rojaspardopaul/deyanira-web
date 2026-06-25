// ─── Core domain types ────────────────────────────────────────────────────────

export type AptStatus = 'pending' | 'confirmed' | 'in_progress' | 'cancelled' | 'completed' | 'no_show';

export type CalView = 'month' | 'week' | 'day' | 'resource' | 'agenda';

export type Appointment = {
  id: string;
  date: string; // ISO string from backend (YYYY-MM-DDTHH:mm:ss.sssZ) or YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  status: AptStatus;
  totalPen: number | string;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  notes?: string;
  atHome?: boolean;
  atHomeDistrict?: string;
  onDutyStaff?: boolean;
  bookingGroupId?: string | null;
  packageId?: string | null;
  /** Paquete (novia/quinceañera): el precio se muestra a nivel paquete y el
   *  eventType da el icono/color del badge en el calendario. */
  package?: {
    id: string;
    name: string;
    pricePen?: number | string | null;
    groupLabel?: string | null;
    trialAddonServiceId?: string | null;
    eventType?: { id: string; name: string; slug: string; icon?: string | null; accentColor?: string | null } | null;
  } | null;
  service: {
    id: string;
    name: string;
    duration: number;
    category?: { id: string; name: string; slug: string; icon?: string | null } | null;
  };
  staff: { id: string; name: string } | null;
  customer?: { id?: string; name?: string; phone?: string; email?: string } | null;
};

// Pago/adelanto asociado a un grupo de reserva (paquete con adelanto)
export type BookingPaymentInfo = {
  id: string;
  status: 'pending' | 'awaiting_verification' | 'paid' | 'rejected' | 'expired';
  proofImageUrl?: string | null;
  method?: string | null;
  totalPen: number | string;
  depositPen: number | string;
  paidPen: number | string;
  balancePen: number | string;
  receiptNumber?: string | null;
  customerName?: string | null;
};

export type StaffMember = { id: string; name: string };

export type Slot = { start: string; end: string };

// ─── Layout algorithm ─────────────────────────────────────────────────────────

export type LayoutInfo = { col: number; totalCols: number };

// ─── Drag-to-reschedule ───────────────────────────────────────────────────────

export type DragState = {
  aptId: string;
  originalDate: string;
  originalStartTime: string;
  originalEndTime: string;
  /** Snap-corrected target date (YYYY-MM-DD) */
  targetDate: string;
  /** Snap-corrected start time (HH:MM) */
  snappedStart: string;
  /** Snap-corrected end time (HH:MM) — same duration as original */
  snappedEnd: string;
  /** Pointer Y relative to the time-grid container */
  pointerY: number;
  /** Day-column index inside WeekView (0–6). -1 for DayView / ResourceView. */
  targetDayIndex: number;
  /** Target staffId when dragging in ResourceView */
  targetStaffId: string | null;
  /** Pixels from block's top to the pointer's initial contact point */
  offsetY: number;
  /** True once pointer moved > 4px — distinguishes drag from click */
  isDragging: boolean;
};

// ─── Undo stack ───────────────────────────────────────────────────────────────

export type UndoEntry = {
  /** Human-readable message shown in the toast */
  message: string;
  /** Reverts the optimistic update in local state AND calls the inverse API */
  rollback: () => Promise<void>;
};

// ─── Resize ───────────────────────────────────────────────────────────────────

export type ResizeState = {
  aptId: string;
  originalEndTime: string;
  snappedEnd: string;
  pointerY: number;
  isDragging: boolean;
};
