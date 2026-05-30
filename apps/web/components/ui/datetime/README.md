# DateTimePicker

Componente único para **toda** selección de fecha/hora de la app (admin y público).
No uses `<input type="date|time">` nativos ni crees nuevos calendarios: usa esto.

```tsx
import DateTimePicker from '@/components/ui/datetime';
```

## Modos

| `mode` | `value` | `onChange(v)` |
|---|---|---|
| `date` | `string \| null` — `'YYYY-MM-DD'` | `'YYYY-MM-DD'` |
| `time` | `string \| null` — `'HH:mm'` | `'HH:mm'` |
| `datetime` | `{ date, startTime, endTime? } \| null` | `{ date, startTime, endTime? }` |
| `range` | `{ startDate, endDate } \| null` | `{ startDate, endDate }` |

Formatos = contrato del backend: fecha `YYYY-MM-DD`, hora `HH:mm` (24h). Nunca expone `Date`.

## Props

Comunes (`Base`):
- `theme?: 'light' | 'dark'` — default `'light'` (admin). `'dark'` para wizard público / fondos glass.
- `variant?: 'popover' | 'inline'` — default `'popover'` (abre al click; **hoja full-screen en móvil**). `'inline'` embebe el calendario.
- `minDate?`, `maxDate?`, `disabledDates?` — strings `'YYYY-MM-DD'`.
- `label?`, `error?` (validación inline), `disabled?`, `className?`, `locale?` (default `'es-PE'`).

`time` / `datetime` (hora libre):
- `minuteStep?` (default `5`), `minTime?`, `maxTime?`, `disabledTimeRanges?: { start, end }[]`.

`datetime` (hora por slots del backend):
- `availableSlots?: { start: string; end: string }[]` — si se pasa, el selector muestra estos slots (reservas = 30 min) en vez de opciones libres.
- `slotsLoading?: boolean`.

`time` / `datetime` (formato):
- `hourFormat?: '12h' | '24h'` — default `'12h'` (muestra `a.m./p.m.`). El valor siempre se guarda en 24h `'HH:mm'`.

### Selector de hora (campo segmentado + rueda)

La hora se elige con:
1. **Campo segmentado editable** (`TimeField`): cajas `[Hora] [Min] [a.m./p.m.]` con **auto-avance** (al completar la hora salta a minutos; sin segundos). Lo escrito se **valida al instante** contra la disponibilidad: si no es válido muestra el motivo y los horarios que SÍ se pueden.
2. **Icono de reloj** al lado del campo que **despliega la rueda** (`TimeWheel`): columnas Hora | Min (| a.m./p.m.) con el valor resaltado al centro.

El modo `time` se renderiza siempre inline (el campo es el control, sin trigger/popover). Los horarios **no disponibles se muestran en gris y no son seleccionables** en la rueda:
- Modo slots → grilla del primer al último slot; huecos sin disponibilidad en gris.
- Modo libre → fuera de `minTime/maxTime` o dentro de `disabledTimeRanges` en gris.

El popover **no se cierra** al elegir la hora (se ajusta hora/min/meridiano y se cierra con Esc / click fuera / "Aplicar" en móvil).

## Ejemplos

```tsx
// Fecha simple (admin, popover)
<DateTimePicker mode="date" value={date} onChange={setDate} minDate={today} />

// Fecha + hora con slots del backend (modal de cita, inline)
<DateTimePicker
  mode="datetime"
  variant="inline"
  value={{ date, startTime, endTime }}
  availableSlots={serviceId && staffId ? slots : []}
  slotsLoading={loadingSlots}
  onChange={(v) => setForm({ ...form, date: v.date, startTime: v.startTime, endTime: v.endTime ?? '' })}
/>

// Hora libre (configuración / horarios)
<DateTimePicker mode="time" minuteStep={30} minTime="05:00" maxTime="23:00"
  value={startTime} onChange={setStartTime} />

// Rango (filtro "Personalizado")
<DateTimePicker mode="range" value={{ startDate, endDate }}
  onChange={(v) => { setFrom(v.startDate); setTo(v.endDate); }} />

// Tema oscuro (wizard público)
<DateTimePicker mode="date" theme="dark" value={date} onChange={setDate} minDate={today} />
```

## Reglas

- **Slots de reserva = 30 min**: los genera el backend (`apps/api/src/lib/booking/availability.js`). El `minuteStep` de 5 es solo para campos de hora libre.
- **Zona horaria America/Lima**: para crear un `Date` desde una fecha date-only se usa el padding `'T12:00:00'` (`utils.ts → parseYMD`). Nunca parsees `'YYYY-MM-DD'` sin ese padding.
- En `datetime` libre, cambiar la fecha **conserva** la hora; en modo slots **resetea** la hora.
- `error` muestra el mensaje bajo el control (útil para reflejar un 409 de solapamiento del backend).

## Estructura

| Archivo | Rol |
|---|---|
| `DateTimePicker.tsx` | Orquestador (modo / variant / theme / trigger / popover) |
| `MonthGrid.tsx` | Grilla mensual (date y range) |
| `WeekStrip.tsx` | Tira semanal (móvil / wizard) |
| `TimeList.tsx` | Control de hora: campo + reloj + rueda, candidatos/`disabled`, validación |
| `TimeField.tsx` | Campo segmentado editable (Hora / Min / a.m.-p.m.) con auto-avance |
| `TimeWheel.tsx` | Rueda visual de columnas (Hora / Min / a.m.-p.m.) |
| `Popover.tsx` | Popover desktop + hoja full-screen móvil |
| `utils.ts` | Helpers puros de fecha/hora |
| `theme.ts` | Tokens claro/oscuro |
| `types.ts` | Tipos (unión discriminada por `mode`) |

`components/ui/Calendar.tsx` y `components/ui/BookingCalendar.tsx` son wrappers finos sobre este componente (compatibilidad con su API previa).
