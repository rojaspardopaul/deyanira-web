'use client';

// Gráficos del Centro Financiero (Recharts). Se importa con next/dynamic
// (ssr:false) desde el dashboard para no penalizar el bundle del resto del admin.

import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import type { FinanceSeriePoint, FinanceResumen } from '@/features/admin/api/admin.api';
import { MONTHS_ES, CATEGORY_LABELS, METHOD_LABELS, fmt, fmtShort } from './shared';

const PIE_COLORS = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-sm sm:text-base mb-4">{title}</h3>
      {children}
    </div>
  );
}

function tip(value: number, name: string) {
  return [fmt(value), name];
}

export default function FinanceCharts({ serie, resumen }: { serie: FinanceSeriePoint[]; resumen: FinanceResumen | null }) {
  const barData = serie.map((s) => ({ name: MONTHS_ES[s.month - 1], Ingresos: s.income, Egresos: s.expenses }));

  // Flujo de caja acumulado en el año.
  let running = 0;
  const flowData = serie.map((s) => {
    running += s.profit;
    return { name: MONTHS_ES[s.month - 1], Caja: Math.round(running * 100) / 100 };
  });

  const catData = (resumen?.porCategoria ?? []).slice(0, 8).map((c) => ({
    name: CATEGORY_LABELS[c.key] ?? c.label, value: c.total,
  }));
  const methodData = (resumen?.porMetodoPago ?? []).map((m) => ({
    name: METHOD_LABELS[m.key] ?? m.label, value: m.total,
  }));

  const hasYear = serie.some((s) => s.income > 0 || s.expenses > 0);

  return (
    <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
      <Card title={`Ingresos vs Egresos — ${serie[0]?.year ?? new Date().getFullYear()}`}>
        {hasYear ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={tip} contentStyle={{ borderRadius: 12, border: '1px solid #f1f5f9', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="Egresos" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </Card>

      <Card title="Flujo de caja acumulado">
        {hasYear ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={flowData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={tip} contentStyle={{ borderRadius: 12, border: '1px solid #f1f5f9', fontSize: 12 }} />
              <Line type="monotone" dataKey="Caja" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </Card>

      <Card title="Egresos por categoría">
        {catData.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: '1px solid #f1f5f9', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : <Empty label="Sin egresos en el período" />}
      </Card>

      <Card title="Ingresos por método de pago">
        {methodData.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={methodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} paddingAngle={2}>
                {methodData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: '1px solid #f1f5f9', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : <Empty label="Sin ingresos en el período" />}
      </Card>
    </div>
  );
}

function Empty({ label = 'Sin datos todavía' }: { label?: string }) {
  return <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">{label}</div>;
}
