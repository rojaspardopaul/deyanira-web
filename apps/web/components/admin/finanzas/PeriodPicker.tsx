'use client';

import { useState } from 'react';
import DateTimePicker from '@/components/ui/datetime';
import { PRESETS, type Preset, getPeriod, fmtDate } from './shared';

export interface PeriodPickerProps {
  preset: Preset;
  period: { from: string; to: string };
  onChange: (preset: Preset, period: { from: string; to: string }) => void;
}

export default function PeriodPicker({ preset, period, onChange }: PeriodPickerProps) {
  const [openCustom, setOpenCustom] = useState(false);

  function pick(p: Preset) {
    if (p === 'custom') {
      setOpenCustom(true);
      onChange('custom', period);
      return;
    }
    setOpenCustom(false);
    onChange(p, getPeriod(p));
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => pick(key)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              preset === key
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {(preset === 'custom' || openCustom) && (
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <DateTimePicker
            mode="range"
            theme="light"
            value={{ startDate: period.from, endDate: period.to }}
            onChange={(r) => {
              const v = r as { startDate: string; endDate: string } | null;
              if (v?.startDate && v?.endDate) onChange('custom', { from: v.startDate, to: v.endDate });
            }}
          />
          <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:inline">
            {fmtDate(period.from)} – {fmtDate(period.to)}
          </span>
        </div>
      )}
    </div>
  );
}
