'use client';

import DateTimePicker from './datetime';

// Calendario mensual de tema claro. Ahora es un wrapper fino sobre el
// componente unificado DateTimePicker (mode="date", inline). Se conserva la
// API original (value / onChange / minDate) por compatibilidad.

type Props = {
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
};

export default function Calendar({ value, onChange, minDate }: Props) {
  return (
    <DateTimePicker
      mode="date"
      variant="inline"
      theme="light"
      value={value || null}
      minDate={minDate}
      onChange={onChange}
    />
  );
}
