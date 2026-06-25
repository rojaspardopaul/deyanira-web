'use client';

// Captura manual de egreso / otro ingreso. Persiste en las tablas Expense /
// OtherIncome (vía /admin/accounting/*), que además proyectan su movimiento al
// libro mayor. Reutiliza el DateTimePicker unificado.

import { useState } from 'react';
import DateTimePicker from '@/components/ui/datetime';
import { adminApi } from '@/lib/api';

const EXPENSE_CATEGORIES: Record<string, string> = {
  alquiler: 'Alquiler', salarios: 'Salarios', productos: 'Insumos / Productos',
  servicios_pub: 'Servicios (luz, agua, internet)', marketing: 'Marketing y publicidad',
  equipos: 'Equipos y herramientas', mantenimiento: 'Mantenimiento', transporte: 'Transporte',
  impuestos: 'Impuestos / IGV', otro: 'Otro',
};
const OTHER_INCOME_CATEGORIES: Record<string, string> = {
  servicios_externos: 'Servicios externos (eventos)', cursos: 'Cursos y talleres',
  alquiler_espacio: 'Alquiler del espacio', otro: 'Otro',
};
const PAYMENT_METHODS: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia bancaria', tarjeta: 'Tarjeta', yape: 'Yape',
};

export type CaptureKind = 'egreso' | 'ingreso';

export default function CaptureModal({
  kind, token, onClose, onSaved,
}: {
  kind: CaptureKind;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEgreso = kind === 'egreso';
  const cats = isEgreso ? EXPENSE_CATEGORIES : OTHER_INCOME_CATEGORIES;
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: 'otro',
    description: '',
    amountPen: '',
    paymentMethod: 'efectivo',
    notes: '',
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
      const base = {
        date: form.date,
        category: form.category,
        description: form.description,
        amountPen: Number(form.amountPen),
        notes: form.notes || undefined,
      };
      if (isEgreso) await api.accounting.expenses.create({ ...base, paymentMethod: form.paymentMethod });
      else await api.accounting.otherIncome.create(base);
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
          <h3 className="font-semibold text-lg">{isEgreso ? 'Nuevo egreso' : 'Nuevo ingreso'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <DateTimePicker mode="date" theme="light" value={form.date || null} onChange={(d) => setForm((p) => ({ ...p, date: d as string }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto (S/)</label>
              <input type="number" step="0.01" min="0.01" required value={form.amountPen}
                onChange={(e) => setForm((p) => ({ ...p, amountPen: e.target.value }))} placeholder="0.00" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className={inputCls}>
              {Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input type="text" required value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder={isEgreso ? 'Ej: Pago alquiler mes de mayo' : 'Ej: Taller de maquillaje'} className={inputCls} />
          </div>
          {isEgreso && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago</label>
              <select value={form.paymentMethod} onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value }))} className={inputCls}>
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2}
              placeholder="Observaciones..." className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving}
              className={`flex-1 text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50 ${isEgreso ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {saving ? 'Guardando...' : (isEgreso ? 'Registrar egreso' : 'Registrar ingreso')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
