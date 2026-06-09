// Tipos del componente DateTimePicker unificado.
// Formatos de intercambio (mismos que el backend):
//   fecha = 'YYYY-MM-DD'   ·   hora = 'HH:mm' (24h)

export type Slot = { start: string; end: string };

/** Valor de mode="datetime". endTime se completa al elegir un slot. */
export type DateTimeValue = { date: string; startTime: string; endTime?: string };

/** Valor de mode="range" (estilo aerolínea: dos fechas, un calendario). */
export type RangeValue = { startDate: string; endDate: string };

export type DateTimeTheme = 'light' | 'dark';
export type DateTimeVariant = 'popover' | 'inline';

interface Base {
  /** 'light' (admin, default) o 'dark' (wizard público, glass). */
  theme?: DateTimeTheme;
  /** 'popover' abre calendario al hacer foco (default); 'inline' lo embebe. */
  variant?: DateTimeVariant;
  label?: string;
  /** Mensaje de validación inline (p. ej. respuesta 409 del backend). */
  error?: string;
  disabled?: boolean;
  className?: string;
  /** Locale para etiquetas legibles. Default 'es-PE'. */
  locale?: string;
  /** Límites de fecha en 'YYYY-MM-DD'. */
  minDate?: string;
  maxDate?: string;
  /** Fechas específicas deshabilitadas ('YYYY-MM-DD'). */
  disabledDates?: string[];
}

export interface DateProps extends Base {
  mode: 'date';
  value: string | null;
  onChange: (v: string) => void;
}

export interface TimeProps extends Base {
  mode: 'time';
  value: string | null;
  onChange: (v: string) => void;
  /** Paso en minutos para generar opciones (default 5). */
  minuteStep?: number;
  /** Rango de horas seleccionables (default 00:00 – 23:59). */
  minTime?: string;
  maxTime?: string;
  /** Formato visible. Default '12h' (a.m./p.m.); el valor siempre es 'HH:mm' 24h. */
  hourFormat?: '12h' | '24h';
  /** Rangos de hora deshabilitados (se muestran en gris, no seleccionables). */
  disabledTimeRanges?: { start: string; end: string }[];
  /** Pre-selecciona el primer horario disponible (el más temprano no ocupado) si
   *  no hay valor. En modo libre por defecto NO (déjalo vacío). */
  autoSelectEarliest?: boolean;
}

export interface DateTimeProps extends Base {
  mode: 'datetime';
  value: DateTimeValue | null;
  onChange: (v: DateTimeValue) => void;
  minuteStep?: number;
  minTime?: string;
  maxTime?: string;
  /** Si se pasa, la lista de horas muestra estos slots (caso reserva, 30 min). */
  availableSlots?: Slot[];
  slotsLoading?: boolean;
  /** Formato visible. Default '12h' (a.m./p.m.); el valor siempre es 'HH:mm' 24h. */
  hourFormat?: '12h' | '24h';
  /** Rangos de hora deshabilitados (modo libre). */
  disabledTimeRanges?: { start: string; end: string }[];
  /** Pre-selecciona el primer slot disponible si no hay hora elegida. En modo
   *  slots va activo por defecto (evita el "12:00" no viable). */
  autoSelectEarliest?: boolean;
}

export interface RangeProps extends Base {
  mode: 'range';
  value: RangeValue | null;
  onChange: (v: RangeValue) => void;
}

export type DateTimePickerProps = DateProps | TimeProps | DateTimeProps | RangeProps;
