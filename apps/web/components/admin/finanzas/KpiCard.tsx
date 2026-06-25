'use client';

import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

type Tone = 'emerald' | 'red' | 'blue' | 'purple' | 'amber' | 'gray';

const TONES: Record<Tone, { icon: string; iconBg: string; value: string }> = {
  emerald: { icon: 'text-emerald-600', iconBg: 'bg-emerald-100', value: 'text-emerald-600' },
  red: { icon: 'text-red-500', iconBg: 'bg-red-100', value: 'text-red-500' },
  blue: { icon: 'text-blue-600', iconBg: 'bg-blue-100', value: 'text-blue-600' },
  purple: { icon: 'text-purple-600', iconBg: 'bg-purple-100', value: 'text-purple-600' },
  amber: { icon: 'text-amber-600', iconBg: 'bg-amber-100', value: 'text-amber-600' },
  gray: { icon: 'text-gray-700', iconBg: 'bg-gray-100', value: 'text-gray-900' },
};

export interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
  /** Variación porcentual vs período anterior (positivo = subió). */
  variation?: number | null;
  /** Cuando true, una baja se pinta verde y una subida roja (p. ej. egresos). */
  invertVariation?: boolean;
  onClick?: () => void;
  /** Cuando true, resalta la tarjeta (KPI usado como filtro activo). */
  active?: boolean;
}

export default function KpiCard({
  label, value, icon: Icon, tone = 'gray', hint, variation, invertVariation, onClick, active,
}: KpiCardProps) {
  const t = TONES[tone];
  const hasVar = variation != null && Number.isFinite(variation);
  const up = (variation ?? 0) >= 0;
  const good = invertVariation ? !up : up;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={`text-left bg-white rounded-2xl p-4 sm:p-5 shadow-sm border transition-all ${
        active ? 'border-primary-300 ring-2 ring-primary-400' : 'border-gray-100'
      } ${
        onClick ? 'hover:shadow-md hover:border-gray-200 active:scale-[0.99] cursor-pointer' : 'cursor-default'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs sm:text-sm text-gray-500">{label}</span>
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center ${t.iconBg}`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${t.icon}`} />
        </div>
      </div>
      <p className={`text-xl sm:text-2xl font-bold ${t.value}`}>{value}</p>
      <div className="flex items-center gap-2 mt-1 min-h-[18px]">
        {hasVar && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${good ? 'text-emerald-600' : 'text-red-500'}`}>
            {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(variation as number)}%
          </span>
        )}
        {hint && <span className="text-xs text-gray-400 truncate">{hint}</span>}
      </div>
    </button>
  );
}
