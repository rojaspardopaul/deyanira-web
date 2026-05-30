'use client';

import { useState } from 'react';
import { CalendarDays, CalendarRange } from 'lucide-react';
import MonthGrid from './datetime/MonthGrid';
import WeekStrip from './datetime/WeekStrip';

// Calendario del wizard de reservas (tema oscuro) con dos vistas:
//   • "semana" (default): tira horizontal de 7 días tipo app nativa
//   • "mes": grilla mensual completa
// Ahora es un wrapper fino sobre los componentes unificados MonthGrid/WeekStrip.
// Mantiene la API original (value / onChange / minDate) para no tocar el wizard.

type Props = {
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
};

export default function BookingCalendar({ value, onChange, minDate }: Props) {
  const [view, setView] = useState<'week' | 'month'>('week');

  return (
    <div className="w-full">
      <div className="flex justify-center mb-2">
        <button
          type="button"
          onClick={() => setView(v => (v === 'week' ? 'month' : 'week'))}
          className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors active:scale-95"
          style={{ color: 'rgba(255,79,162,0.85)' }}
        >
          {view === 'week'
            ? <><CalendarDays className="w-3.5 h-3.5" /> Ver mes completo</>
            : <><CalendarRange className="w-3.5 h-3.5" /> Ver por semana</>}
        </button>
      </div>

      {view === 'week'
        ? <WeekStrip theme="dark" value={value || null} onSelect={onChange} minDate={minDate} />
        : <MonthGrid theme="dark" value={value || null} onSelect={onChange} minDate={minDate} />}
    </div>
  );
}
