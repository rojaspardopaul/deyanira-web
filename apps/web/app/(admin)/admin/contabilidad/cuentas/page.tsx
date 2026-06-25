'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Wallet, Banknote, Smartphone, CreditCard } from 'lucide-react';
import { adminApi, type FinanceAccount } from '@/lib/api';
import { fmt, ACCOUNT_TYPE_LABELS } from '@/components/admin/finanzas/shared';

const TYPE_ICON: Record<string, typeof Wallet> = {
  cash: Banknote, wallet: Smartphone, bank: Wallet, card: CreditCard,
};

export default function CuentasPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; item: FinanceAccount | null }>({ open: false, item: null });

  useEffect(() => {
    const t = localStorage.getItem('admin_token');
    if (!t) { router.push('/admin/login'); return; }
    setToken(t);
  }, [router]);

  const load = useCallback(async (t: string) => {
    if (!t) return;
    setLoading(true);
    try {
      setAccounts(await adminApi(t).finanzas.cuentas.list());
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (token) load(token); }, [token, load]);

  const totalCaja = accounts.filter((a) => a.isActive).reduce((s, a) => s + a.balancePen, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Caja total activa: <span className="font-semibold text-gray-900">{fmt(totalCaja)}</span>
        </p>
        <button onClick={() => setModal({ open: true, item: null })}
          className="flex items-center gap-2 bg-gray-900 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-800">
          <Plus className="w-4 h-4" /> Nueva cuenta
        </button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
          No hay cuentas todavía.<br />
          <button onClick={() => setModal({ open: true, item: null })} className="mt-3 text-gray-700 underline">Crear la primera (Caja Principal, Yape, Banco)</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((a) => {
            const Icon = TYPE_ICON[a.type] ?? Wallet;
            return (
              <div key={a.id} className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 ${!a.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-gray-700" />
                  </div>
                  <button onClick={() => setModal({ open: true, item: a })} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                <p className="font-semibold text-gray-900">{a.name}</p>
                <p className="text-xs text-gray-400 mb-2">{ACCOUNT_TYPE_LABELS[a.type] ?? a.type}{!a.isActive && ' · inactiva'}</p>
                <p className={`text-xl font-bold ${a.balancePen >= 0 ? 'text-gray-900' : 'text-red-500'}`}>{fmt(a.balancePen)}</p>
              </div>
            );
          })}
        </div>
      )}

      {modal.open && (
        <AccountModal token={token} item={modal.item} onClose={() => setModal({ open: false, item: null })} onSaved={() => load(token)} />
      )}
    </div>
  );
}

function AccountModal({
  token, item, onClose, onSaved,
}: {
  token: string;
  item: FinanceAccount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    type: item?.type ?? 'cash',
    isActive: item?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const api = adminApi(token);
      if (item) await api.finanzas.cuentas.update(item.id, { name: form.name, type: form.type, isActive: form.isActive });
      else await api.finanzas.cuentas.create({ name: form.name, type: form.type });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'No se pudo guardar');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-lg">{item ? 'Editar cuenta' : 'Nueva cuenta'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input type="text" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ej: Caja Principal, Yape, Banco BCP" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className={inputCls}>
              {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {item && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
              Cuenta activa
            </label>
          )}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-gray-900 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {saving ? 'Guardando...' : (item ? 'Guardar' : 'Crear cuenta')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
