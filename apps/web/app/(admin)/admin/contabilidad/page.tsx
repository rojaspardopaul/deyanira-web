'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import DateTimePicker from '@/components/ui/datetime';
import {
  TrendingUp, TrendingDown, DollarSign, Percent,
  Plus, Pencil, Trash2, ChevronDown,
} from 'lucide-react';
import { confirmAction } from '@/lib/confirm';
import { HL, Danger } from '@/components/ui/highlight';

// ─── Tipos ────────────────────────────────────────────────

type Summary = {
  period: { from: string; to: string };
  income: {
    appointments: { total: number; count: number };
    orders: { total: number; count: number };
    other: { total: number; count: number };
    total: number;
  };
  expenses: {
    total: number;
    breakdown: { category: string; total: number; count: number }[];
  };
  profit: number;
  margin: number;
};

type MonthlyItem = { month: number; year: number; income: number; expenses: number; profit: number };

type Expense = {
  id: string; date: string; category: string; description: string;
  amountPen: number; paymentMethod: string; receiptUrl?: string; notes?: string;
};

type OtherIncome = {
  id: string; date: string; category: string; description: string;
  amountPen: number; notes?: string;
};

// ─── Constantes ───────────────────────────────────────────

const EXPENSE_CATEGORIES: Record<string, string> = {
  alquiler: 'Alquiler',
  salarios: 'Salarios',
  productos: 'Insumos / Productos',
  servicios_pub: 'Servicios (luz, agua, internet)',
  marketing: 'Marketing y publicidad',
  equipos: 'Equipos y herramientas',
  mantenimiento: 'Mantenimiento',
  transporte: 'Transporte',
  impuestos: 'Impuestos / IGV',
  otro: 'Otro',
};

const OTHER_INCOME_CATEGORIES: Record<string, string> = {
  servicios_externos: 'Servicios externos (eventos)',
  cursos: 'Cursos y talleres',
  alquiler_espacio: 'Alquiler del espacio',
  otro: 'Otro',
};

const PAYMENT_METHODS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia bancaria',
  tarjeta: 'Tarjeta',
  yape: 'Yape',
};

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ─── Helpers ──────────────────────────────────────────────

function fmt(amount: number) {
  return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(isoStr: string) {
  return isoStr.slice(0, 10).split('-').reverse().join('/');
}

function toInputDate(isoStr: string) {
  return isoStr.slice(0, 10);
}

function getPeriod(preset: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (preset === 'this_month') {
    const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const last = new Date(y, m + 1, 0).getDate();
    const to = `${y}-${String(m + 1).padStart(2, '0')}-${last}`;
    return { from, to };
  }
  if (preset === 'last_month') {
    const lm = m === 0 ? 11 : m - 1;
    const ly = m === 0 ? y - 1 : y;
    const from = `${ly}-${String(lm + 1).padStart(2, '0')}-01`;
    const last = new Date(ly, lm + 1, 0).getDate();
    const to = `${ly}-${String(lm + 1).padStart(2, '0')}-${last}`;
    return { from, to };
  }
  if (preset === 'last_3_months') {
    const d = new Date(y, m - 2, 1);
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const last = new Date(y, m + 1, 0).getDate();
    const to = `${y}-${String(m + 1).padStart(2, '0')}-${last}`;
    return { from, to };
  }
  // this_year
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

// ─── Gráfico SVG ──────────────────────────────────────────

function MonthlyChart({ data }: { data: MonthlyItem[] }) {
  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expenses]), 1);
  const H = 180;
  const PADDING_L = 58;
  const TOTAL_W = 720;
  const BAR_W = 13;
  const COL_W = (TOTAL_W - PADDING_L) / 12;

  const yPos = (val: number) => H - (val / maxVal) * H;
  const barH = (val: number) => Math.max((val / maxVal) * H, val > 0 ? 2 : 0);

  const yLabels = [0.25, 0.5, 0.75, 1];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${TOTAL_W + 20} ${H + 40}`} className="w-full min-w-[480px]">
        {/* Grid */}
        {yLabels.map(p => {
          const y = H - p * H;
          const val = maxVal * p;
          return (
            <g key={p}>
              <line x1={PADDING_L} x2={TOTAL_W + 10} y1={y} y2={y}
                stroke="#f3f4f6" strokeWidth={1} />
              <text x={PADDING_L - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
                {val >= 1000 ? `S/${(val / 1000).toFixed(0)}k` : `S/${val.toFixed(0)}`}
              </text>
            </g>
          );
        })}
        <line x1={PADDING_L} x2={TOTAL_W + 10} y1={H} y2={H} stroke="#e5e7eb" strokeWidth={1} />

        {/* Barras */}
        {data.map((d, i) => {
          const groupX = PADDING_L + i * COL_W + (COL_W - (BAR_W * 2 + 4)) / 2;
          const iH = barH(d.income);
          const eH = barH(d.expenses);
          return (
            <g key={i}>
              <rect x={groupX} y={yPos(d.income)} width={BAR_W} height={iH}
                fill="#10b981" rx={2} opacity={0.85} />
              <rect x={groupX + BAR_W + 4} y={yPos(d.expenses)} width={BAR_W} height={eH}
                fill="#ef4444" rx={2} opacity={0.85} />
              <text x={groupX + BAR_W + 2} y={H + 16} textAnchor="middle"
                fontSize={10} fill="#6b7280">
                {MONTHS_ES[d.month - 1]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-5 justify-center mt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-xs text-gray-500">Ingresos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-xs text-gray-500">Egresos</span>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Egreso ──────────────────────────────────────

type ExpenseFormData = {
  date: string; category: string; description: string;
  amountPen: string; paymentMethod: string; notes: string;
};

const EMPTY_EXPENSE: ExpenseFormData = {
  date: new Date().toISOString().slice(0, 10),
  category: 'otro',
  description: '',
  amountPen: '',
  paymentMethod: 'efectivo',
  notes: '',
};

function ExpenseModal({
  initial, onSave, onClose,
}: {
  initial?: Expense | null;
  onSave: (data: ExpenseFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ExpenseFormData>(
    initial
      ? { date: toInputDate(initial.date), category: initial.category,
          description: initial.description, amountPen: String(initial.amountPen),
          paymentMethod: initial.paymentMethod, notes: initial.notes || '' }
      : EMPTY_EXPENSE
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const f = (k: keyof ExpenseFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-lg">{initial ? 'Editar egreso' : 'Nuevo egreso'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <DateTimePicker
                mode="date"
                theme="light"
                value={form.date || null}
                onChange={d => setForm(prev => ({ ...prev, date: d }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto (S/)</label>
              <input type="number" step="0.01" min="0.01" required value={form.amountPen}
                onChange={f('amountPen')} placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select value={form.category} onChange={f('category')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input type="text" required value={form.description} onChange={f('description')}
              placeholder="Ej: Pago alquiler mes de mayo"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago</label>
            <select value={form.paymentMethod} onChange={f('paymentMethod')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea value={form.notes} onChange={f('notes')} rows={2} placeholder="Observaciones..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-red-500 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-red-600 disabled:opacity-50">
              {saving ? 'Guardando...' : (initial ? 'Guardar cambios' : 'Registrar egreso')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal de Otro Ingreso ────────────────────────────────

type OtherIncomeFormData = {
  date: string; category: string; description: string;
  amountPen: string; notes: string;
};

const EMPTY_OTHER_INCOME: OtherIncomeFormData = {
  date: new Date().toISOString().slice(0, 10),
  category: 'otro',
  description: '',
  amountPen: '',
  notes: '',
};

function OtherIncomeModal({
  initial, onSave, onClose,
}: {
  initial?: OtherIncome | null;
  onSave: (data: OtherIncomeFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<OtherIncomeFormData>(
    initial
      ? { date: toInputDate(initial.date), category: initial.category,
          description: initial.description, amountPen: String(initial.amountPen),
          notes: initial.notes || '' }
      : EMPTY_OTHER_INCOME
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const f = (k: keyof OtherIncomeFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-lg">{initial ? 'Editar ingreso' : 'Nuevo ingreso'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <DateTimePicker
                mode="date"
                theme="light"
                value={form.date || null}
                onChange={d => setForm(prev => ({ ...prev, date: d }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto (S/)</label>
              <input type="number" step="0.01" min="0.01" required value={form.amountPen}
                onChange={f('amountPen')} placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select value={form.category} onChange={f('category')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {Object.entries(OTHER_INCOME_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input type="text" required value={form.description} onChange={f('description')}
              placeholder="Ej: Taller de maquillaje nupcial"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea value={form.notes} onChange={f('notes')} rows={2} placeholder="Observaciones..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-emerald-500 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-emerald-600 disabled:opacity-50">
              {saving ? 'Guardando...' : (initial ? 'Guardar cambios' : 'Registrar ingreso')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────

type Tab = 'resumen' | 'egresos' | 'otros_ingresos';
type Preset = 'this_month' | 'last_month' | 'last_3_months' | 'this_year';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this_month', label: 'Este mes' },
  { key: 'last_month', label: 'Mes anterior' },
  { key: 'last_3_months', label: 'Últimos 3 meses' },
  { key: 'this_year', label: 'Este año' },
];

export default function ContabilidadPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [tab, setTab] = useState<Tab>('resumen');
  const [preset, setPreset] = useState<Preset>('this_month');
  const [period, setPeriod] = useState(() => getPeriod('this_month'));

  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [otherIncome, setOtherIncome] = useState<OtherIncome[]>([]);

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [loadingOther, setLoadingOther] = useState(false);

  const [expenseModal, setExpenseModal] = useState<{ open: boolean; item: Expense | null }>({ open: false, item: null });
  const [otherModal, setOtherModal] = useState<{ open: boolean; item: OtherIncome | null }>({ open: false, item: null });

  useEffect(() => {
    const t = localStorage.getItem('admin_token');
    if (!t) { router.push('/admin/login'); return; }
    setToken(t);
  }, [router]);

  const fetchSummary = useCallback(async (t: string, p: { from: string; to: string }) => {
    if (!t) return;
    setLoadingSummary(true);
    try {
      const api = adminApi(t);
      const [sum, mon] = await Promise.all([
        api.accounting.summary(p.from, p.to) as Promise<Summary>,
        api.accounting.monthly(new Date().getFullYear()) as Promise<MonthlyItem[]>,
      ]);
      setSummary(sum);
      setMonthly(mon);
    } catch {
      /* ignore */
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const fetchExpenses = useCallback(async (t: string, p: { from: string; to: string }) => {
    if (!t) return;
    setLoadingExpenses(true);
    try {
      const data = await adminApi(t).accounting.expenses.list(`from=${p.from}&to=${p.to}`) as Expense[];
      setExpenses(data);
    } catch { /* ignore */ } finally { setLoadingExpenses(false); }
  }, []);

  const fetchOtherIncome = useCallback(async (t: string, p: { from: string; to: string }) => {
    if (!t) return;
    setLoadingOther(true);
    try {
      const data = await adminApi(t).accounting.otherIncome.list(`from=${p.from}&to=${p.to}`) as OtherIncome[];
      setOtherIncome(data);
    } catch { /* ignore */ } finally { setLoadingOther(false); }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchSummary(token, period);
    fetchExpenses(token, period);
    fetchOtherIncome(token, period);
  }, [token, period, fetchSummary, fetchExpenses, fetchOtherIncome]);

  function changePreset(p: Preset) {
    setPreset(p);
    setPeriod(getPeriod(p));
  }

  async function saveExpense(data: { date: string; category: string; description: string; amountPen: string; paymentMethod: string; notes: string }) {
    const api = adminApi(token);
    const payload = { ...data, amountPen: Number(data.amountPen) };
    if (expenseModal.item) {
      await api.accounting.expenses.update(expenseModal.item.id, payload);
    } else {
      await api.accounting.expenses.create(payload);
    }
    await Promise.all([
      fetchSummary(token, period),
      fetchExpenses(token, period),
    ]);
  }

  async function deleteExpense(id: string) {
    if (!(await confirmAction({
      title: '¿Eliminar egreso?',
      message: <>Se eliminará este <HL>egreso</HL> de la contabilidad. <Danger>Esta acción no se puede deshacer.</Danger></>,
      danger: true,
    }))) return;
    await adminApi(token).accounting.expenses.delete(id);
    await Promise.all([fetchSummary(token, period), fetchExpenses(token, period)]);
  }

  async function saveOtherIncome(data: { date: string; category: string; description: string; amountPen: string; notes: string }) {
    const api = adminApi(token);
    const payload = { ...data, amountPen: Number(data.amountPen) };
    if (otherModal.item) {
      await api.accounting.otherIncome.update(otherModal.item.id, payload);
    } else {
      await api.accounting.otherIncome.create(payload);
    }
    await Promise.all([
      fetchSummary(token, period),
      fetchOtherIncome(token, period),
    ]);
  }

  async function deleteOtherIncome(id: string) {
    if (!(await confirmAction({
      title: '¿Eliminar ingreso?',
      message: <>Se eliminará este <HL>ingreso</HL> de la contabilidad. <Danger>Esta acción no se puede deshacer.</Danger></>,
      danger: true,
    }))) return;
    await adminApi(token).accounting.otherIncome.delete(id);
    await Promise.all([fetchSummary(token, period), fetchOtherIncome(token, period)]);
  }

  const isProfit = (summary?.profit ?? 0) >= 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold">Contabilidad</h1>
            <p className="text-gray-500 text-sm mt-1">Control de ingresos, egresos y rentabilidad</p>
          </div>

          {/* Selector de período */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(({ key, label }) => (
              <button key={key} onClick={() => changePreset(key)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                  preset === key
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {([
            { key: 'resumen', label: 'Resumen' },
            { key: 'egresos', label: 'Egresos' },
            { key: 'otros_ingresos', label: 'Otros ingresos' },
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === key
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── TAB: RESUMEN ─────────────────────────────────── */}
        {tab === 'resumen' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            {loadingSummary ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[0,1,2,3].map(i => (
                  <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse h-28" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Ingresos */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">Ingresos</span>
                    <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {fmt(summary?.income.total ?? 0)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {(summary?.income.appointments.count ?? 0) + (summary?.income.orders.count ?? 0)} transacciones
                  </p>
                </div>

                {/* Egresos */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">Egresos</span>
                    <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-red-500">
                    {fmt(summary?.expenses.total ?? 0)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {summary?.expenses.breakdown.reduce((s, b) => s + b.count, 0) ?? 0} registros
                  </p>
                </div>

                {/* Utilidad */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">Utilidad neta</span>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isProfit ? 'bg-blue-100' : 'bg-orange-100'}`}>
                      <DollarSign className={`w-5 h-5 ${isProfit ? 'text-blue-600' : 'text-orange-500'}`} />
                    </div>
                  </div>
                  <p className={`text-2xl font-bold ${isProfit ? 'text-blue-600' : 'text-orange-500'}`}>
                    {fmt(summary?.profit ?? 0)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {isProfit ? 'Ganancia' : 'Pérdida'} del período
                  </p>
                </div>

                {/* Margen */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">Margen</span>
                    <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Percent className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                  <p className={`text-2xl font-bold ${isProfit ? 'text-purple-600' : 'text-orange-500'}`}>
                    {summary?.margin ?? 0}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">sobre ingresos totales</p>
                </div>
              </div>
            )}

            {/* Gráfico mensual */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-base mb-4">Ingresos vs Egresos — {new Date().getFullYear()}</h2>
              {monthly.length > 0
                ? <MonthlyChart data={monthly} />
                : <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Cargando gráfico...</div>
              }
            </div>

            {/* Desglose de ingresos + egresos */}
            {summary && (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Fuentes de ingreso */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h2 className="font-semibold text-base mb-4">Fuentes de ingreso</h2>
                  <div className="space-y-3">
                    {[
                      { label: 'Citas completadas', amount: summary.income.appointments.total, count: summary.income.appointments.count, color: 'bg-emerald-500' },
                      { label: 'Pedidos pagados', amount: summary.income.orders.total, count: summary.income.orders.count, color: 'bg-blue-500' },
                      { label: 'Otros ingresos', amount: summary.income.other.total, count: summary.income.other.count, color: 'bg-purple-500' },
                    ].map(({ label, amount, count, color }) => {
                      const pct = summary.income.total > 0 ? (amount / summary.income.total) * 100 : 0;
                      return (
                        <div key={label}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-600">{label}</span>
                            <span className="font-medium">{fmt(amount)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div className={`${color} h-2 rounded-full transition-all`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{count} transacciones</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Desglose de egresos */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h2 className="font-semibold text-base mb-4">Desglose de egresos</h2>
                  {summary.expenses.breakdown.length === 0 ? (
                    <p className="text-gray-400 text-sm">No hay egresos registrados en este período.</p>
                  ) : (
                    <div className="space-y-3">
                      {summary.expenses.breakdown
                        .sort((a, b) => b.total - a.total)
                        .map(({ category, total }) => {
                          const pct = summary.expenses.total > 0 ? (total / summary.expenses.total) * 100 : 0;
                          return (
                            <div key={category}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-600">
                                  {EXPENSE_CATEGORIES[category] ?? category}
                                </span>
                                <span className="font-medium text-red-500">{fmt(total)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-100 rounded-full h-2">
                                  <div className="bg-red-400 h-2 rounded-full transition-all"
                                    style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(0)}%</span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: EGRESOS ─────────────────────────────────── */}
        {tab === 'egresos' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                {expenses.length} registros · Total: <span className="font-semibold text-red-500">
                  {fmt(expenses.reduce((s, e) => s + Number(e.amountPen), 0))}
                </span>
              </p>
              <button onClick={() => setExpenseModal({ open: true, item: null })}
                className="flex items-center gap-2 bg-gray-900 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-700">
                <Plus className="w-4 h-4" /> Nuevo egreso
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {loadingExpenses ? (
                <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
              ) : expenses.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-sm">
                  No hay egresos en este período.<br />
                  <button onClick={() => setExpenseModal({ open: true, item: null })}
                    className="mt-3 text-gray-700 underline text-sm">Registrar el primero</button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Categoría</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Descripción</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Método</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Monto</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(exp => (
                      <tr key={exp.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{fmtDate(exp.date)}</td>
                        <td className="px-5 py-3">
                          <span className="bg-red-50 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                            {EXPENSE_CATEGORIES[exp.category] ?? exp.category}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-700 max-w-xs truncate">{exp.description}</td>
                        <td className="px-5 py-3 text-gray-500">{PAYMENT_METHODS[exp.paymentMethod] ?? exp.paymentMethod}</td>
                        <td className="px-5 py-3 font-semibold text-red-500 text-right whitespace-nowrap">
                          {fmt(Number(exp.amountPen))}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => setExpenseModal({ open: true, item: exp })}
                              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteExpense(exp.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-red-50">
                      <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-gray-700">Total egresos</td>
                      <td className="px-5 py-3 font-bold text-red-600 text-right">
                        {fmt(expenses.reduce((s, e) => s + Number(e.amountPen), 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: OTROS INGRESOS ──────────────────────────── */}
        {tab === 'otros_ingresos' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                {otherIncome.length} registros · Total: <span className="font-semibold text-emerald-600">
                  {fmt(otherIncome.reduce((s, i) => s + Number(i.amountPen), 0))}
                </span>
              </p>
              <button onClick={() => setOtherModal({ open: true, item: null })}
                className="flex items-center gap-2 bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-emerald-700">
                <Plus className="w-4 h-4" /> Nuevo ingreso
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {loadingOther ? (
                <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
              ) : otherIncome.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-sm">
                  No hay otros ingresos en este período.<br />
                  <button onClick={() => setOtherModal({ open: true, item: null })}
                    className="mt-3 text-gray-700 underline text-sm">Registrar el primero</button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Categoría</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Descripción</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Monto</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {otherIncome.map(inc => (
                      <tr key={inc.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{fmtDate(inc.date)}</td>
                        <td className="px-5 py-3">
                          <span className="bg-emerald-50 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full">
                            {OTHER_INCOME_CATEGORIES[inc.category] ?? inc.category}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-700 max-w-xs truncate">{inc.description}</td>
                        <td className="px-5 py-3 font-semibold text-emerald-600 text-right whitespace-nowrap">
                          {fmt(Number(inc.amountPen))}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => setOtherModal({ open: true, item: inc })}
                              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteOtherIncome(inc.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50">
                      <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-gray-700">Total otros ingresos</td>
                      <td className="px-5 py-3 font-bold text-emerald-600 text-right">
                        {fmt(otherIncome.reduce((s, i) => s + Number(i.amountPen), 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modales */}
      {expenseModal.open && (
        <ExpenseModal
          initial={expenseModal.item}
          onSave={saveExpense}
          onClose={() => setExpenseModal({ open: false, item: null })}
        />
      )}
      {otherModal.open && (
        <OtherIncomeModal
          initial={otherModal.item}
          onSave={saveOtherIncome}
          onClose={() => setOtherModal({ open: false, item: null })}
        />
      )}
    </div>
  );
}
