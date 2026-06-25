'use client';

// Diagramas del dashboard de citas (Recharts). Se importa con next/dynamic
// (ssr:false) desde /admin para no penalizar el bundle del resto del admin.
// Recibe los datos ya agregados en el cliente.

import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

export type StatusDatum = { key: string; label: string; value: number; hex: string };
export type StaffDatum = { name: string; value: number };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-sm sm:text-base mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function AppointmentCharts({
  porEstado, porEstilista,
}: {
  porEstado: StatusDatum[];
  porEstilista: StaffDatum[];
}) {
  const estado = porEstado.filter((d) => d.value > 0);
  const estilista = [...porEstilista].sort((a, b) => b.value - a.value).slice(0, 8);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Citas por estado — dona */}
      <Card title="Citas por estado">
        {estado.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">Sin datos en el período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={estado}
                dataKey="value"
                nameKey="label"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
              >
                {estado.map((d) => <Cell key={d.key} fill={d.hex} />)}
              </Pie>
              <Tooltip formatter={(v: number, n: string) => [`${v} citas`, n]} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Citas por estilista — barras */}
      <Card title="Citas por estilista">
        {estilista.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">Sin datos en el período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={estilista} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [`${v} citas`, 'Citas']} />
              <Bar dataKey="value" fill="#E8C040" radius={[0, 6, 6, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
