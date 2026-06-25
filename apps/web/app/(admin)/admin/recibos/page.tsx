'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ReceiptText, Plus, Search, Loader2 } from 'lucide-react';
import { adminApi } from '@/lib/api';
import type { Receipt } from '@/features/receipts/api/receipts.api';
import NewReceiptModal from '@/components/admin/receipts/NewReceiptModal';
import ReceiptDetailModal from '@/components/admin/receipts/ReceiptDetailModal';
import { STATUS_UI, money, fmtDate } from '@/components/admin/receipts/labels';

const FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'partial', label: 'Parciales' },
  { key: 'paid', label: 'Pagados' },
];

export default function AdminRecibosPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Receipt | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi().receipts.list({ status: filter || undefined, q: q.trim() || undefined });
      setReceipts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los recibos');
    } finally {
      setLoading(false);
    }
  }, [filter, q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  function onCreated(r: Receipt) {
    setShowNew(false);
    setReceipts((rs) => [r, ...rs]);
    setSelected(r);
  }

  function onChanged(updated: Receipt) {
    setReceipts((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    setSelected((s) => (s && s.id === updated.id ? updated : s));
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-gray-500 hover:text-pink-600"><ChevronLeft className="w-5 h-5" /></Link>
            <h1 className="font-display font-bold text-2xl text-gray-900 flex items-center gap-2">
              <ReceiptText className="w-6 h-6 text-pink-500" /> Recibos
            </h1>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-pink-600 hover:bg-pink-500"
          >
            <Plus className="w-4 h-4" /> Nuevo recibo
          </button>
        </div>

        {/* Filtros + búsqueda */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${filter === f.key ? 'bg-pink-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {f.label}
            </button>
          ))}
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente o N° recibo…"
              className="pl-9 pr-3 py-2 w-56 rounded-xl border border-gray-200 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
            />
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="w-7 h-7 animate-spin text-pink-500" /></div>
        ) : error ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-100">
            <p className="text-red-600">{error}</p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-100">
            <ReceiptText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay recibos en esta vista.</p>
            <button onClick={() => setShowNew(true)} className="mt-3 text-sm font-semibold text-pink-600 hover:text-pink-700">Crear el primero</button>
          </div>
        ) : (
          <div className="space-y-3">
            {receipts.map((r) => {
              const st = STATUS_UI[r.status] || STATUS_UI.pending;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="w-full text-left bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-wrap items-center gap-4 hover:border-pink-200 hover:shadow transition-all"
                >
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{r.customerName}</p>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.receiptNumber} · {r.title || `${r.items.length} concepto${r.items.length !== 1 ? 's' : ''}`} · {fmtDate(r.createdAt)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-gray-900 font-bold">{money(r.totalPen)}</p>
                    <p className="text-xs text-gray-500">
                      Pagado {money(r.paidPen)} · <span className={r.balancePen > 0 ? 'text-amber-600 font-semibold' : 'text-green-600 font-semibold'}>Saldo {money(r.balancePen)}</span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showNew && <NewReceiptModal open={showNew} onClose={() => setShowNew(false)} onCreated={onCreated} />}
      {selected && <ReceiptDetailModal receipt={selected} onClose={() => setSelected(null)} onChanged={onChanged} />}
    </div>
  );
}
