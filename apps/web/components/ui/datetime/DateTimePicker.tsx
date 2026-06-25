'use client';

import { useRef, useState } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronDown } from 'lucide-react';
import MonthGrid from './MonthGrid';
import TimeList from './TimeList';
import Popover from './Popover';
import { formatDateLong, formatDateShort, formatTimeLabel } from './utils';
import { getTokens } from './theme';
import type {
  DateTimePickerProps, DateTimeValue, RangeValue, DateTimeTheme,
} from './types';

export type { DateTimePickerProps, DateTimeValue, RangeValue } from './types';

// Componente unificado de selección de fecha/hora.
// Preserva los formatos del backend: fecha 'YYYY-MM-DD', hora 'HH:mm'.

function TriggerField({
  icon, text, placeholder, theme, disabled, error, onClick, triggerRef, ariaLabel,
}: {
  icon: React.ReactNode;
  text?: string;
  placeholder: string;
  theme: DateTimeTheme;
  disabled?: boolean;
  error?: boolean;
  onClick: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  ariaLabel?: string;
}) {
  const t = getTokens(theme);
  return (
    <button
      ref={triggerRef}
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      style={theme === 'dark' ? { borderColor: 'rgba(255,255,255,0.15)' } : undefined}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-colors
        focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed
        ${t.inputField} ${error ? 'border-red-400 ring-1 ring-red-400' : ''}`}
    >
      <span className="text-gray-400 shrink-0">{icon}</span>
      <span className={`flex-1 truncate ${text ? '' : 'text-gray-400'}`}>{text || placeholder}</span>
      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
    </button>
  );
}

export default function DateTimePicker(props: DateTimePickerProps) {
  const {
    theme = 'light', variant = 'popover', label, error,
    disabled, className = '', locale = 'es-PE',
    minDate, maxDate, disabledDates,
  } = props;

  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  // hover state para previsualizar rango
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const dateConstraints = { minDate, maxDate, disabledDates };

  // ── Contenido del picker según modo ──────────────────────────
  function renderContent() {
    switch (props.mode) {
      case 'date':
        return (
          <MonthGrid
            theme={theme}
            value={props.value}
            onSelect={d => { props.onChange(d); if (variant === 'popover') setOpen(false); }}
            {...dateConstraints}
          />
        );

      case 'time':
        return (
          <TimeList
            theme={theme}
            value={props.value}
            minuteStep={props.minuteStep ?? 5}
            minTime={props.minTime}
            maxTime={props.maxTime}
            hourFormat={props.hourFormat ?? '12h'}
            disabledTimeRanges={props.disabledTimeRanges}
            autoSelectEarliest={props.autoSelectEarliest}
            onSelect={start => { props.onChange(start); }}
          />
        );

      case 'datetime': {
        const v = props.value;
        return (
          <div className="space-y-3">
            <MonthGrid
              theme={theme}
              value={v?.date || null}
              onSelect={d => props.onChange(
                // Modo slots (availableSlots presente): los horarios dependen de la
                // fecha → resetear hora. Modo libre: conservar la hora ya elegida.
                props.availableSlots
                  ? { date: d, startTime: '', endTime: undefined }
                  : { date: d, startTime: v?.startTime ?? '', endTime: v?.endTime },
              )}
              {...dateConstraints}
            />
            {v?.date && (
              <div>
                <p className="text-[11px] font-semibold mb-1.5"
                  style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : '#6b7280' }}>
                  Horario
                </p>
                <TimeList
                  theme={theme}
                  value={v?.startTime || null}
                  slots={props.availableSlots}
                  slotsLoading={props.slotsLoading}
                  minuteStep={props.minuteStep ?? 5}
                  minTime={props.minTime}
                  maxTime={props.maxTime}
                  hourFormat={props.hourFormat ?? '12h'}
                  disabledTimeRanges={props.disabledTimeRanges}
                  autoSelectEarliest={props.autoSelectEarliest}
                  onSelect={(start, end) => {
                    props.onChange({ date: v.date, startTime: start, endTime: end });
                  }}
                />
              </div>
            )}
          </div>
        );
      }

      case 'range': {
        const v = props.value;
        const onChangeRange = props.onChange;
        const pick = (d: string) => {
          const start = v?.startDate;
          const end = v?.endDate;
          // Sin start, o ya hay rango completo → empezar de nuevo
          if (!start || (start && end)) {
            onChangeRange({ startDate: d, endDate: '' });
            return;
          }
          // Hay start sin end → completar (con swap si va al revés)
          const next: RangeValue = d < start
            ? { startDate: d, endDate: start }
            : { startDate: start, endDate: d };
          onChangeRange(next);
          if (variant === 'popover') setOpen(false);
        };
        return (
          <MonthGrid
            theme={theme}
            rangeStart={v?.startDate || null}
            rangeEnd={v?.endDate || null}
            hoverDate={hoverDate}
            onHoverDate={setHoverDate}
            onSelect={pick}
            {...dateConstraints}
          />
        );
      }
    }
  }

  // ── Texto del trigger según modo ─────────────────────────────
  function triggerText(): string | undefined {
    switch (props.mode) {
      case 'date':
        return props.value ? formatDateLong(props.value, locale) : undefined;
      case 'time':
        return props.value ? formatTimeLabel(props.value, props.hourFormat ?? '12h') : undefined;
      case 'datetime': {
        const v = props.value;
        if (!v?.date) return undefined;
        const datePart = formatDateLong(v.date, locale);
        return v.startTime ? `${datePart} · ${formatTimeLabel(v.startTime, props.hourFormat ?? '12h')}` : datePart;
      }
      case 'range': {
        const v = props.value;
        if (!v?.startDate) return undefined;
        if (!v.endDate) return `${formatDateShort(v.startDate, locale)} — …`;
        return `${formatDateShort(v.startDate, locale)} — ${formatDateShort(v.endDate, locale)}`;
      }
    }
  }

  const icon = props.mode === 'time'
    ? <Clock className="w-4 h-4" />
    : <CalendarIcon className="w-4 h-4" />;

  const placeholder = props.mode === 'time' ? 'Seleccionar hora'
    : props.mode === 'range' ? 'Seleccionar rango'
    : props.mode === 'datetime' ? 'Seleccionar fecha y hora'
    : 'Seleccionar fecha';

  // ── Render ───────────────────────────────────────────────────
  // El modo "time" siempre va inline: su control YA es el campo editable con
  // icono de reloj que despliega la rueda (no necesita trigger+popover).
  const inline = variant === 'inline' || props.mode === 'time';
  if (inline) {
    return (
      <div className={className}>
        {label && <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>}
        {renderContent()}
        {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {label && <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>}
      <TriggerField
        icon={icon}
        text={triggerText()}
        placeholder={placeholder}
        theme={theme}
        disabled={disabled}
        error={!!error}
        onClick={() => setOpen(o => !o)}
        triggerRef={anchorRef}
        ariaLabel={label || placeholder}
      />
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        title={label || placeholder}
        theme={theme}
      >
        {renderContent()}
      </Popover>
      {error && <p className="text-xs text-red-500 mt-1" role="alert">{error}</p>}
    </div>
  );
}
