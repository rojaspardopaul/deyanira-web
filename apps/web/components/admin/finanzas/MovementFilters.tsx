'use client';

import { Search } from 'lucide-react';
import { TYPE_LABELS, SOURCE_LABELS } from './shared';

export interface MovementFiltersValue {
  direction: '' | 'in' | 'out';
  type: string;
  source: string;
  q: string;
}

export default function MovementFilters({
  value, onChange,
}: {
  value: MovementFiltersValue;
  onChange: (v: MovementFiltersValue) => void;
}) {
  const set = (patch: Partial<MovementFiltersValue>) => onChange({ ...value, ...patch });
  const selectCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={value.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Buscar concepto o categoría..."
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <select value={value.direction} onChange={(e) => set({ direction: e.target.value as MovementFiltersValue['direction'] })} className={selectCls}>
        <option value="">Todo</option>
        <option value="in">Ingresos</option>
        <option value="out">Egresos</option>
      </select>
      <select value={value.type} onChange={(e) => set({ type: e.target.value })} className={selectCls}>
        <option value="">Todos los tipos</option>
        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select value={value.source} onChange={(e) => set({ source: e.target.value })} className={selectCls}>
        <option value="">Todos los orígenes</option>
        {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  );
}
