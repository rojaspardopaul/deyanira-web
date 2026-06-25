'use client';

// Alta de un movimiento manual / ajuste directo en el libro mayor
// (/admin/finanzas/movimientos). Para ingresos/egresos operativos usar la captura
// (Expense/OtherIncome); esto es para ajustes, comisiones, reembolsos, etc.

import { useState } from 'react';
import DateTimePicker from '@/components/ui/datetime';
import { adminApi, type FinanceAccount } from '@/lib/api';
import { TYPE_LABELS, METHOD_LABELS } from './shared';

const TIPOS = ['ingreso', 'egreso', 'ajuste', 'reembolso', 'comision', 'impuesto', 'transferencia'] as const;
const TIPO_DIRECCION: Record<string, 'in' | 'out'> = {
  ingreso: 'in', egreso: 'out', reembolso: 'out', comision: 'out', impuesto: 'out',
};

export default function ManualMovementModal({
  token, onClose, onSaved, accounts = [],
}: {
  token: string;
  onClose: () => void;
  onSaved: () => void;
  accounts?: FinanceAccount[];
}) {
  const [form, setForm] = useState({
    tipo: 'ingreso' as string,
    direccion: 'in' as 'in' | 'out',
    monto: '',
    descripcion: '',
    fecha: new Date().toISOString().slice(0, 10),
    categoria: '',
    metodoPago: '',
    accountId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  const ambiguo = form.tipo === 'ajuste' || form.tipo === 'transferencia';

  function setTipo(tipo: string) {
    setForm((p) => ({ ...p, tipo, direccion: TIPO_DIRECCION[tipo] ?? p.direccion }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await adminApi(token).finanzas.movimientos.create({
        tipo: form.tipo,
        direccion: form.direccion,
        monto: Number(form.monto),
        descripcion: form.descripcion,
        fecha: form.fecha,
        categoria: form.categoria || null,
        metodoPago: form.metodoPago || null,
        accountId: form.accountId || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'No se pudo guardar');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-semibold text-lg">Movimiento manual</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={form.tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
                {TIPOS.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto (S/)</label>
              <input type="number" step="0.01" min="0.01" required value={form.monto}
                onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))} placeholder="0.00" className={inputCls} />
            </div>
          </div>
          {ambiguo && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <select value={form.direccion} onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value as 'in' | 'out' }))} className={inputCls}>
                <option value="in">Entrada (+)</option>
                <option value="out">Salida (−)</option>
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <DateTimePicker mode="date" theme="light" value={form.fecha || null} onChange={(d) => setForm((p) => ({ ...p, fecha: d as string }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
              <select value={form.metodoPago} onChange={(e) => setForm((p) => ({ ...p, metodoPago: e.target.value }))} className={inputCls}>
                <option value="">—</option>
                {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          {accounts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta</label>
              <select value={form.accountId} onChange={(e) => setForm((p) => ({ ...p, accountId: e.target.value }))} className={inputCls}>
                <option value="">Sin cuenta</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input type="text" required value={form.descripcion}
              onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
              placeholder="Ej: Ajuste de caja, comisión, reembolso..." className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría (opcional)</label>
            <input type="text" value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))} className={inputCls} />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-gray-900 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Registrar movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
