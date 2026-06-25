'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Wallet, Clock,
  HandCoins, Package, Scissors, Users, Receipt, CalendarCheck,
} from 'lucide-react';
import { adminApi, type FinanceResumen, type FinanceSeriePoint, type FinanceMovement } from '@/lib/api';
import KpiCard from '@/components/admin/finanzas/KpiCard';
import KpiDrawer, { type KpiDrawerConfig } from '@/components/admin/finanzas/KpiDrawer';
import PeriodPicker from '@/components/admin/finanzas/PeriodPicker';
import MovementTimeline from '@/components/admin/finanzas/MovementTimeline';
import QuickAddButton from '@/components/admin/finanzas/QuickAddButton';
import { fmt, getPeriod, variationPct, type Preset } from '@/components/admin/finanzas/shared';

// Recharts aislado: import dinámico (ssr:false) para no penalizar el bundle admin.
const FinanceCharts = dynamic(() => import('@/components/admin/finanzas/FinanceCharts'), {
  ssr: false,
  loading: () => <div className="h-72 bg-white rounded-2xl border border-gray-100 animate-pulse" />,
});

export default function ContabilidadDashboard() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [preset, setPreset] = useState<Preset>('month');
  const [period, setPeriod] = useState(() => getPeriod('month'));

  const [resumen, setResumen] = useState<FinanceResumen | null>(null);
  const [serie, setSerie] = useState<FinanceSeriePoint[]>([]);
  const [recent, setRecent] = useState<FinanceMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState<KpiDrawerConfig | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('admin_token');
    if (!t) { router.push('/admin/login'); return; }
    setToken(t);
  }, [router]);

  const load = useCallback(async (t: string, p: { from: string; to: string }) => {
    if (!t) return;
    setLoading(true);
    try {
      const api = adminApi(t);
      const [res, ser, mov] = await Promise.all([
        api.finanzas.resumen(p.from, p.to),
        api.finanzas.serie(new Date().getFullYear()),
        api.finanzas.movimientos.list(`from=${p.from}&to=${p.to}&pageSize=8`),
      ]);
      setResumen(res);
      setSerie(ser);
      setRecent(mov.items);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (token) load(token, period); }, [token, period, load]);

  const refresh = useCallback(() => { if (token) load(token, period); }, [token, period, load]);

  const v = resumen?.periodoActual.variacion ?? null;
  const pa = resumen?.periodoActual;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <PeriodPicker preset={preset} period={period} onChange={(pr, pe) => { setPreset(pr); setPeriod(pe); }} />
      </div>

      {/* KPIs */}
      {loading && !resumen ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse h-28" />
          ))}
        </div>
      ) : resumen && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard label="Ingresos del período" value={fmt(pa!.ingresos)} icon={TrendingUp} tone="emerald"
              variation={v ? variationPct(pa!.ingresos, v.ingresos) : null}
              onClick={() => setDrawer({ title: 'Ingresos del período', subtitle: 'Entradas registradas', filter: { direction: 'in' } })} />
            <KpiCard label="Egresos del período" value={fmt(pa!.egresos)} icon={TrendingDown} tone="red" invertVariation
              variation={v ? variationPct(pa!.egresos, v.egresos) : null}
              onClick={() => setDrawer({ title: 'Egresos del período', subtitle: 'Salidas registradas', filter: { direction: 'out' } })} />
            <KpiCard label="Utilidad del período" value={fmt(pa!.utilidad)} icon={DollarSign} tone={pa!.utilidad >= 0 ? 'blue' : 'amber'}
              variation={v ? variationPct(pa!.utilidad, v.utilidad) : null} hint={pa!.utilidad >= 0 ? 'Ganancia' : 'Pérdida'} />
            <KpiCard label="Margen" value={`${resumen.margen}%`} icon={Percent} tone="purple" hint="sobre ingresos" />

            <KpiCard label="Caja disponible" value={fmt(resumen.cajaDisponible)} icon={Wallet} tone="gray" hint="neto acumulado" />
            <KpiCard label="Adelantos pendientes" value={fmt(resumen.adelantosPendientes.total)} icon={Clock} tone="amber"
              hint={`${resumen.adelantosPendientes.count} reservas`} />
            <KpiCard label="Cuentas por cobrar" value={fmt(resumen.cuentasPorCobrar.total)} icon={HandCoins} tone="amber"
              hint={`${resumen.cuentasPorCobrar.count} con saldo`} />
            <KpiCard label="Ticket promedio" value={fmt(resumen.ticketPromedio)} icon={Receipt} tone="gray" hint="por ingreso" />

            <KpiCard label="Ventas de productos" value={fmt(resumen.ventasProductos.total)} icon={Package} tone="blue"
              hint={`${resumen.ventasProductos.count} pedidos`}
              onClick={() => setDrawer({ title: 'Ventas de productos', subtitle: 'Pedidos pagados', filter: { source: 'order' } })} />
            <KpiCard label="Servicios vendidos" value={fmt(resumen.serviciosVendidos.total)} icon={Scissors} tone="emerald"
              hint={`${resumen.serviciosVendidos.count} citas`}
              onClick={() => setDrawer({ title: 'Servicios vendidos', subtitle: 'Citas completadas', filter: { source: 'appointment' } })} />
            <KpiCard label="Clientes atendidos" value={String(resumen.clientesAtendidos)} icon={Users} tone="purple" hint="en el período" />
            <KpiCard label="Ingresos hoy" value={fmt(resumen.hoy.ingresos)} icon={CalendarCheck} tone="emerald"
              hint={`Utilidad ${fmt(resumen.hoy.utilidad)}`} />
          </div>

          {/* Gráficos */}
          <FinanceCharts serie={serie} resumen={resumen} />

          {/* Timeline reciente */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-base">Movimientos recientes</h2>
              <button onClick={() => router.push('/admin/contabilidad/movimientos')} className="text-sm text-gray-500 hover:text-gray-800">
                Ver todos →
              </button>
            </div>
            <MovementTimeline movements={recent} />
          </div>
        </>
      )}

      <KpiDrawer token={token} config={drawer} period={period} onClose={() => setDrawer(null)} />
      {token && <QuickAddButton token={token} onSaved={refresh} />}
    </div>
  );
}
