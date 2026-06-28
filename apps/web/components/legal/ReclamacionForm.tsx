'use client';

import { useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Proveedor = { razonSocial?: string | null; ruc?: string | null; direccion?: string | null };

const inputCls =
  'w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';
const req = <span className="text-primary-600">*</span>;

export default function ReclamacionForm({ proveedor }: { proveedor: Proveedor }) {
  const [form, setForm] = useState({
    tipo: 'RECLAMO',
    bienTipo: 'SERVICIO',
    consumidorNombre: '', consumidorTipoDoc: 'DNI', consumidorNumDoc: '',
    consumidorDomicilio: '', consumidorTelefono: '', consumidorEmail: '',
    esMenor: false, apoderadoNombre: '',
    montoReclamado: '', bienDescripcion: '',
    detalle: '', pedido: '',
    website: '', // honeypot
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const payload = {
        tipo: form.tipo,
        bienTipo: form.bienTipo,
        consumidorNombre: form.consumidorNombre.trim(),
        consumidorTipoDoc: form.consumidorTipoDoc,
        consumidorNumDoc: form.consumidorNumDoc.trim(),
        consumidorDomicilio: form.consumidorDomicilio.trim(),
        consumidorTelefono: form.consumidorTelefono.trim() || undefined,
        consumidorEmail: form.consumidorEmail.trim(),
        esMenor: form.esMenor,
        apoderadoNombre: form.esMenor ? (form.apoderadoNombre.trim() || undefined) : undefined,
        montoReclamado: form.montoReclamado ? Number(form.montoReclamado) : undefined,
        bienDescripcion: form.bienDescripcion.trim(),
        detalle: form.detalle.trim(),
        pedido: form.pedido.trim(),
        website: form.website || undefined,
      };
      const res = await fetch(`${API}/api/reclamaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar la reclamación. Revisa los campos.');
      setOk(data.correlativo || 'registrada');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (ok) {
    return (
      <div className="rounded-2xl bg-white ring-1 ring-green-200 p-8 text-center shadow-sm">
        <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-3" />
        <h2 className="font-display font-bold text-2xl text-gray-900 mb-2">¡Reclamación registrada!</h2>
        <p className="text-gray-600 text-sm">
          Tu hoja de reclamación fue registrada con el número <strong className="text-gray-900">{ok}</strong>.
          Te enviamos una copia a tu correo y te responderemos en un plazo máximo de <strong>15 días hábiles</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white ring-1 ring-black/5 p-5 md:p-7 shadow-sm space-y-6" noValidate>
      {/* Proveedor */}
      <div className="rounded-xl bg-gray-50 ring-1 ring-black/5 p-4 text-xs text-gray-600">
        <p className="font-bold text-gray-800 mb-1">Identificación del proveedor</p>
        <p>{proveedor.razonSocial || 'Deyanira Makeup Beauty'}{proveedor.ruc ? ` · RUC ${proveedor.ruc}` : ''}</p>
        {proveedor.direccion && <p>{proveedor.direccion}</p>}
      </div>

      {/* Tipo */}
      <fieldset>
        <legend className={labelCls}>Tipo de solicitud {req}</legend>
        <div className="grid grid-cols-2 gap-3">
          {([['RECLAMO', 'Reclamo', 'Disconformidad con el producto/servicio'], ['QUEJA', 'Queja', 'Malestar respecto a la atención']] as const).map(([v, t, d]) => (
            <label key={v} className={`cursor-pointer rounded-xl border-2 p-3 text-sm ${form.tipo === v ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>
              <input type="radio" name="tipo" value={v} checked={form.tipo === v} onChange={set('tipo')} className="sr-only" />
              <span className="font-semibold text-gray-900">{t}</span>
              <span className="block text-[11px] text-gray-500 mt-0.5">{d}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Consumidor */}
      <div>
        <h3 className="font-bold text-sm text-gray-800 mb-3">1. Datos del consumidor</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><label className={labelCls}>Nombre completo {req}</label><input required maxLength={120} value={form.consumidorNombre} onChange={set('consumidorNombre')} className={inputCls} /></div>
          <div><label className={labelCls}>Tipo de documento {req}</label>
            <select value={form.consumidorTipoDoc} onChange={set('consumidorTipoDoc')} className={inputCls}>
              <option>DNI</option><option>CE</option><option>Pasaporte</option><option>RUC</option>
            </select>
          </div>
          <div><label className={labelCls}>N° de documento {req}</label><input required maxLength={20} value={form.consumidorNumDoc} onChange={set('consumidorNumDoc')} className={inputCls} /></div>
          <div className="md:col-span-2"><label className={labelCls}>Domicilio {req}</label><input required maxLength={200} value={form.consumidorDomicilio} onChange={set('consumidorDomicilio')} className={inputCls} /></div>
          <div><label className={labelCls}>Teléfono</label><input maxLength={20} value={form.consumidorTelefono} onChange={set('consumidorTelefono')} className={inputCls} placeholder="9XXXXXXXX" /></div>
          <div><label className={labelCls}>Correo electrónico {req}</label><input required type="email" maxLength={150} value={form.consumidorEmail} onChange={set('consumidorEmail')} className={inputCls} /></div>
          <label className="md:col-span-2 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.esMenor} onChange={set('esMenor')} className="w-4 h-4" />
            El consumidor es menor de edad
          </label>
          {form.esMenor && (
            <div className="md:col-span-2"><label className={labelCls}>Nombre del padre/madre o apoderado {req}</label><input maxLength={120} value={form.apoderadoNombre} onChange={set('apoderadoNombre')} className={inputCls} /></div>
          )}
        </div>
      </div>

      {/* Bien */}
      <div>
        <h3 className="font-bold text-sm text-gray-800 mb-3">2. Identificación del bien contratado</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div><label className={labelCls}>Tipo {req}</label>
            <select value={form.bienTipo} onChange={set('bienTipo')} className={inputCls}>
              <option value="SERVICIO">Servicio</option><option value="PRODUCTO">Producto</option>
            </select>
          </div>
          <div><label className={labelCls}>Monto reclamado (S/)</label><input type="number" min="0" step="0.01" value={form.montoReclamado} onChange={set('montoReclamado')} className={inputCls} placeholder="Opcional" /></div>
          <div className="md:col-span-2"><label className={labelCls}>Descripción del producto/servicio {req}</label><input required maxLength={500} value={form.bienDescripcion} onChange={set('bienDescripcion')} className={inputCls} /></div>
        </div>
      </div>

      {/* Detalle */}
      <div>
        <h3 className="font-bold text-sm text-gray-800 mb-3">3. Detalle de la reclamación</h3>
        <div className="space-y-3">
          <div><label className={labelCls}>Detalle {req}</label><textarea required maxLength={2000} rows={4} value={form.detalle} onChange={set('detalle')} className={inputCls} /></div>
          <div><label className={labelCls}>Pedido del consumidor {req}</label><textarea required maxLength={1000} rows={3} value={form.pedido} onChange={set('pedido')} className={inputCls} placeholder="¿Qué solución solicitas?" /></div>
        </div>
      </div>

      {/* honeypot */}
      <input type="text" value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <p className="text-[11px] text-gray-400 leading-relaxed">
        La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo
        para presentar una denuncia ante INDECOPI. El proveedor deberá dar respuesta en un plazo no mayor a 15 días hábiles.
      </p>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 rounded-full text-sm transition-colors disabled:opacity-50">
        {loading ? 'Enviando…' : 'Enviar reclamación'}
      </button>
    </form>
  );
}
