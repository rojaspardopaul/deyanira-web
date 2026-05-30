'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { ChevronLeft, Check, X, ExternalLink, Loader2, ReceiptText } from 'lucide-react';

type Pay = Record<string, unknown>;
const money = (n: unknown) => `S/ ${Number(n || 0).toFixed(2)}`;

const STATUS = {
  pending: { label: 'Pendiente', cls: 'bg-gray-100 text-gray-600' },
  awaiting_verification: { label: 'Por verificar', cls: 'bg-yellow-100 text-yellow-700' },
  paid: { label: 'Pagado', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rechazado', cls: 'bg-red-100 text-red-600' },
  expired: { label: 'Expirado', cls: 'bg-gray-100 text-gray-400' },
} as const;

const FILTERS = [
  { key: 'awaiting_verification', label: 'Por verificar' },
  { key: 'paid', label: 'Pagados' },
  { key: '', label: 'Todos' },
];

export default function AdminPagosPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Pay[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('awaiting_verification');
  const [busy, setBusy] = useState<string | null>(null);
  const [proof, setProof] = useState<string | null>(null);

  const load = useCallback(async (token: string) => {
    setLoading(true);
    const data = await adminApi(token).bookingPayments.list(filter || undefined).catch((err: Error) => {
      if (err.message.toLowerCase().includes('401') || err.message.toLowerCase().includes('token')) {
        localStorage.removeItem('admin_token'); router.push('/admin/login');
      }
      return [];
    });
    setPayments(data as Pay[]);
    setLoading(false);
  }, [filter, router]);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/admin/login'); return; }
    load(token);
  }, [router, load]);

  async function act(id: string, approved: boolean) {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setBusy(id);
    try {
      await adminApi(token).bookingPayments.verify(id, approved);
      await load(token);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally { setBusy(null); }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin" className="text-gray-500 hover:text-primary-600"><ChevronLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold text-2xl text-gray-900 flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-pink-500" /> Adelantos y pagos
          </h1>
        </div>

        <div className="flex gap-2 mb-5">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${filter === f.key ? 'bg-pink-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="w-7 h-7 animate-spin text-pink-500" /></div>
        ) : payments.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-500">No hay pagos en esta vista.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((p) => {
              const st = STATUS[(p.status as keyof typeof STATUS)] || STATUS.pending;
              const pkg = p.package as { name?: string } | null;
              return (
                <div key={p.id as string} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{p.customerName as string}</p>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {pkg?.name || 'Reserva'} · {p.customerPhone as string || 's/teléfono'}
                    </p>
                    {p.receiptNumber ? <p className="text-[11px] text-gray-400 mt-0.5">Recibo {p.receiptNumber as string}</p> : null}
                  </div>

                  <div className="text-right text-sm">
                    <p className="text-gray-900 font-bold">{money(p.depositPen)} <span className="text-xs font-normal text-gray-400">adelanto</span></p>
                    <p className="text-xs text-gray-500">Total {money(p.totalPen)} · Saldo {money(p.balancePen)}</p>
                    <p className="text-[11px] text-gray-400 capitalize">{(p.method as string) || '—'}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {p.proofImageUrl ? (
                      <button onClick={() => setProof(p.proofImageUrl as string)}
                        className="text-xs font-semibold text-blue-600 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-blue-50">
                        <ExternalLink className="w-3.5 h-3.5" /> Comprobante
                      </button>
                    ) : null}
                    {p.status === 'paid' && (
                      <a href={`/reserva/${p.id}/recibo`} target="_blank" rel="noreferrer"
                        className="text-xs font-semibold text-gray-600 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-gray-100">
                        <ReceiptText className="w-3.5 h-3.5" /> Recibo
                      </a>
                    )}
                    {p.status === 'awaiting_verification' && (
                      <>
                        <button onClick={() => act(p.id as string, true)} disabled={busy === p.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-500 disabled:opacity-50">
                          <Check className="w-3.5 h-3.5" /> Aprobar
                        </button>
                        <button onClick={() => act(p.id as string, false)} disabled={busy === p.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50">
                          <X className="w-3.5 h-3.5" /> Rechazar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Visor de comprobante */}
      {proof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setProof(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={proof} alt="Comprobante" className="max-h-[90vh] max-w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
