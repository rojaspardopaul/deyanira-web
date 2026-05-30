# Calendar Library — `@/components/calendar`

Custom calendar component library for the Deyanira Makeup Beauty admin panel.
Zero external calendar/drag dependencies — built with native pointer events and React.

---

## 1. Overview

| Feature | Status |
|---|---|
| Month / Week / Day views | ✅ |
| Click-to-create appointment | ✅ |
| Detail / edit modal (status changes, staff assignment) | ✅ |
| Status visibility chips (filter by status) | ✅ |
| Staff filter | ✅ |
| Optimistic updates + undo toast | ✅ |
| Admin sidebar toggle | ✅ |
| Drag-to-reschedule (hook ready, wire-up in progress) | 🔄 Phase 2 |
| Resize event duration | ⏳ Phase 3 |
| Resource view (columns per stylist) | ⏳ Phase 4 |
| Recurring appointments (rrule) | ⏳ Phase 5 |
| Real-time sync (Supabase Realtime) | ⏳ Phase 6 |

---

## 2. Quick Start

```tsx
// apps/web/app/(admin)/admin/calendario/page.tsx
'use client';
import { CalendarRoot } from '@/components/calendar';

export default function CalendarioPage() {
  return (
    <CalendarRoot
      adminRole="admin"
      defaultView="week"
      defaultHiddenStatuses={['cancelled', 'no_show']}
      enableDrag
      enableResize
    />
  );
}
```

---

## 3. CalendarRoot Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `adminRole` | `'super_admin' \| 'admin' \| 'estilista'` | required | Controls permissions (create/drag/cancel disabled for estilista) |
| `staffList` | `StaffMember[]` | loaded internally | Pass to skip an extra API call |
| `defaultView` | `CalView` | `'week'` | Initial view |
| `defaultDate` | `string` | today | Initial date (YYYY-MM-DD) |
| `defaultHiddenStatuses` | `AptStatus[]` | `['cancelled','no_show']` | Initially hidden statuses |
| `enableDrag` | `boolean` | `true` | Allow drag-to-reschedule (auto-disabled for estilista) |
| `enableResize` | `boolean` | `true` | Allow resize handles |
| `enableResourceView` | `boolean` | `true` | Show "Por estilista" view button |
| `snapMinutes` | `number` | `15` | Grid snap resolution |
| `undoDuration` | `number` | `6000` | Undo toast duration in ms |
| `onAppointmentMutated` | `(apt, action) => void` | — | Called after create/update/status_changed |

---

## 4. Views

### MonthView
Grid of 42 cells (6 weeks). Up to 3 appointments per cell, +N overflow indicator. Click a date → switches to DayView.

### WeekView
7-column time grid (08:00–21:00). Each column is one day. Appointment blocks overlap-aware (side-by-side columns when times conflict). Red line = current time, gold dashed = selected time.

### DayView
Single-column time grid. Includes appointment count and day/date header.

### ResourceView *(Phase 4)*
Horizontal scroll, one column per stylist. Useful for multi-staff salons.

---

## 5. Drag & Drop *(Phase 2 — hook ready)*

Wire `useDrag` into `CalendarRoot` to enable drag-to-reschedule:

```tsx
const { dragState, handleDragStart, handlePointerMove, handlePointerUp, cancelDrag } = useDrag({
  onCommit: (apt, newDate, newStart, newEnd) => {
    optimisticUpdate(apt.id, { date: newDate, startTime: newStart, endTime: newEnd });
    pushUndo({ message: 'Cita movida', rollback: () => rollback() });
  },
  onRollback: apt => upsert(apt),
});
```

Pass `dragState` and `handleDragStart` to `WeekView` / `DayView`. They render a `GhostBlock` automatically when `dragState.isDragging && dragState.targetDate === columnDate`.

To disable drag: `enableDrag={false}` on `CalendarRoot` (also auto-disabled for `estilista` role).

---

## 6. Undo Toast

```tsx
const { undoEntry, pushUndo, dismissUndo, triggerUndo } = useUndoToast();

// Push after any reversible mutation:
pushUndo({
  message: 'Estado cambiado a Completada',
  rollback: async () => {
    await adminApi().appointments.update(id, { status: previousStatus });
    optimisticUpdate(id, { status: previousStatus });
  },
});
```

The toast auto-dismisses after `undoDuration` ms (default 6 s).

---

## 7. Sidebar Toggle

The admin layout uses `useSidebarToggle` to collapse the left nav:

```tsx
// apps/web/app/(admin)/layout.tsx
import { useSidebarToggle } from '@/components/calendar/hooks/useSidebarToggle';

const { collapsed, toggle } = useSidebarToggle();
// persists to localStorage('admin_sidebar_collapsed')
```

---

## 8. Extending — Adding a New View

1. Create `views/MyView.tsx` with props matching the other views (at minimum: `appointments`, `hiddenStatuses`, `today`, `onSlotClick`, `onAptClick`).
2. Add `'myview'` to the `CalView` type in `types.ts`.
3. Add a button entry in `toolbar/CalendarToolbar.tsx` VIEWS array.
4. Add the conditional render in `CalendarRoot.tsx`.

---

## 9. Types Reference

```ts
type AptStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
type CalView   = 'month' | 'week' | 'day' | 'resource';

type Appointment = {
  id: string; date: string; startTime: string; endTime: string;
  status: AptStatus; totalPen: number | string;
  guestName?: string; guestPhone?: string; guestEmail?: string;
  notes?: string; atHome?: boolean; atHomeDistrict?: string; onDutyStaff?: boolean;
  service: { id: string; name: string; duration: number };
  staff: { id: string; name: string } | null;
  customer?: { name?: string; phone?: string; email?: string } | null;
};

type StaffMember = { id: string; name: string };
type Slot        = { start: string; end: string };
type LayoutInfo  = { col: number; totalCols: number };

type DragState = {
  aptId: string; originalDate: string; originalStartTime: string; originalEndTime: string;
  targetDate: string; snappedStart: string; snappedEnd: string;
  pointerY: number; targetDayIndex: number; targetStaffId: string | null;
  offsetY: number; isDragging: boolean;
};

type UndoEntry = { message: string; rollback: () => Promise<void> };
```

---

## 10. Utils Reference

### `utils/date.ts`
| Function | Signature | Description |
|---|---|---|
| `toYMD` | `(d: Date) => string` | Date → YYYY-MM-DD |
| `addDays` | `(d: Date, n: number) => Date` | Add N days |
| `getWeekStart` | `(d: Date) => Date` | Monday of the week |
| `aptDateStr` | `(apt: Appointment) => string` | Timezone-safe date string from apt |
| `isPastDate` | `(date: string) => boolean` | Before today |
| `isPastDateTime` | `(date, time: string) => boolean` | Before now |
| `clientName` | `(apt: Appointment) => string` | `customer.name \|\| guestName \|\| 'Sin nombre'` |

### `utils/time.ts`
| Function | Signature | Description |
|---|---|---|
| `timeToMin` | `(t: string) => number` | "HH:MM" → minutes since midnight |
| `minToHHMM` | `(m: number) => string` | minutes → "HH:MM" |
| `snapToGrid` | `(minutes: number, snap?: number) => number` | Snap to nearest N minutes (default 15) |
| `clamp` | `(value, min, max: number) => number` | Clamp to range |

### `utils/layout.ts`
| Function | Signature | Description |
|---|---|---|
| `computeOverlapLayout` | `(apts: Appointment[]) => Map<string, LayoutInfo>` | Greedy column assignment for overlapping appointments |

---

## File Structure

```
components/calendar/
├── README.md
├── index.ts                  ← public re-exports
├── types.ts
├── constants.ts              ← HOUR_START=7, HOUR_END=21, HOUR_HEIGHT=48
├── status.ts                 ← STATUS record (colors/labels per AptStatus)
├── utils/
│   ├── date.ts
│   ├── time.ts
│   └── layout.ts
├── hooks/
│   ├── useSidebarToggle.ts
│   ├── useUndoToast.ts
│   ├── useAppointments.ts
│   └── useDrag.ts
├── blocks/
│   ├── AptBlock.tsx          ← appointment block in time grid
│   ├── GhostBlock.tsx        ← translucent drag preview
│   └── ResizeHandle.tsx      ← bottom resize handle
├── views/
│   ├── MonthView.tsx
│   ├── WeekView.tsx
│   └── DayView.tsx
├── panels/
│   ├── DayPanel.tsx          ← right side panel (day's appointment list)
│   └── AptModal.tsx          ← unified create + edit floating modal
├── toolbar/
│   └── CalendarToolbar.tsx
└── CalendarRoot.tsx          ← root orchestrator
```
