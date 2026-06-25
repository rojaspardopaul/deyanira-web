'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Send, ScanLine, Loader2, Upload, Camera, AlertCircle } from 'lucide-react';
import { adminApi, type FinanceSugerencia, type FinanceAccount } from '@/lib/api';
import { TYPE_LABELS, METHOD_LABELS, CATEGORY_LABELS } from '@/components/admin/finanzas/shared';
import DateTimePicker from '@/components/ui/datetime';

const CATEGORY_OPTIONS = [
  'servicios', 'adelanto', 'productos', 'alquiler', 'salarios', 'servicios_pub',
  'marketing', 'equipos', 'mantenimiento', 'transporte', 'impuestos',
  'servicios_externos', 'cursos', 'alquiler_espacio', 'otro',
];
const TIPOS = ['ingreso', 'egreso', 'venta', 'adelanto', 'pago_final', 'reembolso', 'ajuste', 'comision', 'impuesto'];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function IAContablePage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sugerencia, setSugerencia] = useState<FinanceSugerencia | null>(null);
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = localStorage.getItem('admin_token');
    if (!t) { router.push('/admin/login'); return; }
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    adminApi(token).finanzas.ia.estado().then((r) => setDisponible(r.disponible)).catch(() => setDisponible(false));
    adminApi(token).finanzas.cuentas.list().then(setAccounts).catch(() => setAccounts([]));
  }, [token]);

  const interpretarTexto = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(''); setSugerencia(null); setPendingFile(null);
    try { setSugerencia(await adminApi(token).finanzas.ia.texto(prompt.trim())); }
    catch (err) { setError((err as Error).message || 'No se pudo interpretar'); }
    finally { setLoading(false); }
  }, [prompt, token]);

  async function analizarArchivo(file: File) {
    setLoading(true); setError(''); setSugerencia(null);
    try {
      const b64 = await fileToBase64(file);
      setPendingFile(b64);
      setSugerencia(await adminApi(token).finanzas.ia.comprobante(b64));
    } catch (err) {
      setError((err as Error).message || 'No se pudo analizar el comprobante');
    } finally {
      setLoading(false);
    }
  }

  if (disponible === false) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
        <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="font-semibold text-gray-800">IA Contable no configurada</p>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
          Define <code className="bg-gray-100 px-1 rounded">GEMINI_API_KEY</code> en el <code className="bg-gray-100 px-1 rounded">.env</code> del backend
          para habilitar el escaneo de comprobantes y el asistente por texto. El resto del Centro Financiero funciona igual.
        </p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {/* Entrada */}
      <div className="space-y-5">
        {/* Asistente por texto */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center"><Sparkles className="w-4 h-4 text-indigo-600" /></div>
            <h3 className="font-semibold text-sm">Asistente por texto</h3>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder='Ej: "Compré tintes por 150 soles y pagué con Yape"'
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button onClick={interpretarTexto} disabled={loading || !prompt.trim()}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Interpretar
          </button>
        </div>

        {/* Escanear comprobante */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center"><ScanLine className="w-4 h-4 text-emerald-600" /></div>
            <h3 className="font-semibold text-sm">Escanear comprobante</h3>
          </div>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => e.target.files?.[0] && analizarArchivo(e.target.files[0])} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && analizarArchivo(e.target.files[0])} />
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2 text-sm hover:bg-gray-50">
              <Upload className="w-4 h-4" /> Subir boleta/PDF
            </button>
            <button onClick={() => cameraRef.current?.click()} className="sm:hidden flex-1 flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2 text-sm hover:bg-gray-50">
              <Camera className="w-4 h-4" /> Tomar foto
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Boletas, facturas, capturas de Yape/Plin o transferencias.</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* Revisión */}
      <div>
        {loading && !sugerencia ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Analizando con IA...
          </div>
        ) : sugerencia ? (
          <ReviewForm
            token={token}
            sugerencia={sugerencia}
            accounts={accounts}
            pendingFile={pendingFile}
            onDone={() => { setSugerencia(null); setPendingFile(null); setPrompt(''); }}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-400 text-sm">
            La sugerencia de la IA aparecerá aquí para que la revises y confirmes.
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewForm({
  token, sugerencia, accounts, pendingFile, onDone,
}: {
  token: string;
  sugerencia: FinanceSugerencia;
  accounts: FinanceAccount[];
  pendingFile: string | null;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    tipo: sugerencia.tipo,
    direccion: sugerencia.direccion,
    monto: sugerencia.monto != null ? String(sugerencia.monto) : '',
    descripcion: sugerencia.descripcion,
    fecha: sugerencia.fecha || new Date().toISOString().slice(0, 10),
    categoria: sugerencia.categoria || '',
    metodoPago: sugerencia.metodoPago || '',
    accountId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';
  const conf = Math.round(sugerencia.confianza * 100);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.monto || Number(form.monto) <= 0) { setError('Indica un monto válido'); return; }
    setSaving(true); setError('');
    try {
      const mov = await adminApi(token).finanzas.movimientos.create({
        tipo: form.tipo,
        direccion: form.direccion,
        monto: Number(form.monto),
        descripcion: form.descripcion,
        fecha: form.fecha,
        categoria: form.categoria || null,
        metodoPago: form.metodoPago || null,
        accountId: form.accountId || null,
      });
      // Si vino de un comprobante escaneado, lo adjuntamos como voucher.
      if (pendingFile && mov?.id) {
        await adminApi(token).finanzas.vouchers.upload(mov.id, pendingFile, 'comprobante-ia').catch(() => {});
      }
      setDone(true);
      setTimeout(onDone, 1200);
    } catch (err) {
      setError((err as Error).message || 'No se pudo guardar');
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-100 p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
          <Send className="w-5 h-5 text-emerald-600" />
        </div>
        <p className="font-semibold text-gray-800">Movimiento registrado</p>
      </div>
    );
  }

  return (
    <form onSubmit={confirmar} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Revisa y confirma</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${conf >= 70 ? 'bg-emerald-100 text-emerald-700' : conf >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
          Confianza {conf}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Tipo</label>
          <select value={form.tipo}
            onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value, direccion: ['ingreso', 'venta', 'adelanto', 'pago_final'].includes(e.target.value) ? 'in' : 'out' }))}
            className={inputCls}>
            {TIPOS.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Monto (S/)</label>
          <input type="number" step="0.01" min="0.01" value={form.monto} onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))} className={inputCls} />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Descripción</label>
        <input type="text" value={form.descripcion} onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Fecha</label>
          <DateTimePicker mode="date" theme="light" value={form.fecha || null} onChange={(d) => setForm((p) => ({ ...p, fecha: d as string }))} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Método</label>
          <select value={form.metodoPago} onChange={(e) => setForm((p) => ({ ...p, metodoPago: e.target.value }))} className={inputCls}>
            <option value="">—</option>
            {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Categoría</label>
          <select value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))} className={inputCls}>
            <option value="">Sin categoría</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Cuenta</label>
          <select value={form.accountId} onChange={(e) => setForm((p) => ({ ...p, accountId: e.target.value }))} className={inputCls}>
            <option value="">Sin cuenta</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      {sugerencia.contraparte && <p className="text-xs text-gray-400">Detectado: {sugerencia.contraparte}</p>}
      {pendingFile && <p className="text-xs text-emerald-600">Se adjuntará el comprobante escaneado.</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button type="submit" disabled={saving} className="w-full bg-gray-900 text-white rounded-xl py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
        {saving ? 'Guardando...' : 'Confirmar y registrar'}
      </button>
    </form>
  );
}
