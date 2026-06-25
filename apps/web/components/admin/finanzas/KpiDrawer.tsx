'use client';

// Drawer lateral con el detalle filtrado de un KPI (sin cambiar de pantalla).
// Carga los movimientos del período aplicando el filtro del KPI seleccionado.

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { adminApi, type FinanceMovement } from '@/lib/api';
import MovementTimeline from './MovementTimeline';
import { fmt } from './shared';

export interface KpiDrawerConfig {
  title: string;
  subtitle?: string;
  filter: Record<string, string>; // direction/type/source...
}

export default function KpiDrawer({
  token, config, period, onClose,
}: {
  token: string;
  config: KpiDrawerConfig | null;
  period: { from: string; to: string };
  onClose: () => void;
}) {
  const [items, setItems] = useState<FinanceMovement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!config) return;
    let cancel = false;
    setLoading(true);
    const params = new URLSearchParams({ from: period.from, to: period.to, pageSize: '100', ...config.filter });
    adminApi(token).finanzas.movimientos.list(params.toString())
      .then((res) => { if (!cancel) setItems(res.items); })
      .catch(() => { if (!cancel) setItems([]); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [config, token, period.from, period.to]);

  const total = items.filter((m) => m.status !== 'void').reduce((s, m) => s + (m.direction === 'in' ? 1 : -1) * m.amountPen, 0);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-50 transition-opacity ${config ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-[440px] bg-white z-50 shadow-2xl transition-transform duration-300 flex flex-col ${
          config ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg">{config?.title}</h3>
            {config?.subtitle && <p className="text-sm text-gray-500">{config.subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-500">{items.length} movimientos</span>
          <span className={`text-sm font-semibold ${total >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(total)}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {loading ? (
            <div className="py-10 text-center text-gray-400 text-sm">Cargando...</div>
          ) : (
            <MovementTimeline movements={items} />
          )}
        </div>
      </aside>
    </>
  );
}
