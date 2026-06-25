'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { List, Table2, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { adminApi, type FinanceMovement } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import { HL, Danger, Money } from '@/components/ui/highlight';
import PeriodPicker from '@/components/admin/finanzas/PeriodPicker';
import MovementFilters, { type MovementFiltersValue } from '@/components/admin/finanzas/MovementFilters';
import MovementTimeline from '@/components/admin/finanzas/MovementTimeline';
import MovementTable from '@/components/admin/finanzas/MovementTable';
import MovementDetailDrawer from '@/components/admin/finanzas/MovementDetailDrawer';
import QuickAddButton from '@/components/admin/finanzas/QuickAddButton';
import { fmt, getPeriod, type Preset } from '@/components/admin/finanzas/shared';

const PAGE_SIZE = 25;
const EMPTY_FILTERS: MovementFiltersValue = { direction: '', type: '', source: '', q: '' };

export default function MovimientosPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [preset, setPreset] = useState<Preset>('month');
  const [period, setPeriod] = useState(() => getPeriod('month'));
  const [filters, setFilters] = useState<MovementFiltersValue>(EMPTY_FILTERS);
  const [view, setView] = useState<'timeline' | 'table'>('table');

  const [items, setItems] = useState<FinanceMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<FinanceMovement | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('admin_token');
    if (!t) { router.push('/admin/login'); return; }
    setToken(t);
  }, [router]);

  const load = useCallback(async (t: string, p: { from: string; to: string }, f: MovementFiltersValue, pg: number) => {
    if (!t) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: p.from, to: p.to, page: String(pg), pageSize: String(PAGE_SIZE) });
      if (f.direction) params.set('direction', f.direction);
      if (f.type) params.set('type', f.type);
      if (f.source) params.set('source', f.source);
      if (f.q.trim()) params.set('q', f.q.trim());
      const res = await adminApi(t).finanzas.movimientos.list(params.toString());
      setItems(res.items);
      setTotal(res.total);
    } catch {
      setItems([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce ligero para la búsqueda por texto.
  useEffect(() => {
    if (!token) return;
    const id = setTimeout(() => load(token, period, filters, page), 250);
    return () => clearTimeout(id);
  }, [token, period, filters, page, load]);

  // Al cambiar período/filtros, volver a página 1.
  useEffect(() => { setPage(1); }, [period, filters]);

  async function anular(m: FinanceMovement) {
    const ok = await confirmAction({
      title: '¿Anular movimiento?',
      message: <>Se anulará <HL>{m.description}</HL> por <Money>{fmt(m.amountPen)}</Money>. <Danger>Se conserva en el historial pero deja de sumar.</Danger></>,
      danger: true,
    });
    if (!ok) return;
    await adminApi(token).finanzas.movimientos.anular(m.id);
    load(token, period, filters, page);
  }

  async function exportCsv() {
    const params = new URLSearchParams({ from: period.from, to: period.to });
    if (filters.direction) params.set('direction', filters.direction);
    if (filters.type) params.set('type', filters.type);
    if (filters.source) params.set('source', filters.source);
    if (filters.q.trim()) params.set('q', filters.q.trim());
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${base}/api/admin/finanzas/movimientos/export.csv?${params}`, { credentials: 'include' });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movimientos-${period.from}_${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-gray-200 rounded-lg p-0.5">
            <button onClick={() => setView('table')} className={`p-1.5 rounded-md ${view === 'table' ? 'bg-gray-900 text-white' : 'text-gray-500'}`} title="Tabla">
              <Table2 className="w-4 h-4" />
            </button>
            <button onClick={() => setView('timeline')} className={`p-1.5 rounded-md ${view === 'timeline' ? 'bg-gray-900 text-white' : 'text-gray-500'}`} title="Timeline">
              <List className="w-4 h-4" />
            </button>
          </div>
          <span className="text-sm text-gray-500">{total} movimientos</span>
          <button onClick={exportCsv} className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50" title="Exportar CSV">
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
        <PeriodPicker preset={preset} period={period} onChange={(pr, pe) => { setPreset(pr); setPeriod(pe); }} />
      </div>

      <MovementFilters value={filters} onChange={setFilters} />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Cargando...</div>
        ) : view === 'table' ? (
          <MovementTable movements={items} onAnular={anular} onSelect={setDetail} />
        ) : (
          <div className="px-4 py-2">
            <MovementTimeline movements={items} onSelect={setDetail} />
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <MovementDetailDrawer
        token={token}
        movement={detail}
        onClose={() => setDetail(null)}
        onChanged={() => load(token, period, filters, page)}
      />

      {token && <QuickAddButton token={token} onSaved={() => load(token, period, filters, page)} />}
    </div>
  );
}
