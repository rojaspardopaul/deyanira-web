'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { X, RefreshCw } from 'lucide-react';

type Reclamo = {
  id: string; correlativo: string; tipo: string; estado: string;
  consumidorNombre: string; consumidorTipoDoc: string; consumidorNumDoc: string;
  consumidorDomicilio: string; consumidorTelefono: string | null; consumidorEmail: string;
  esMenor: boolean; apoderadoNombre: string | null;
  bienTipo: string; montoReclamado: string | null; bienDescripcion: string;
  detalle: string; pedido: string;
  respuesta: string | null; respondidoAt: string | null; createdAt: string;
};

const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  RESPONDIDO: 'bg-green-100 text-green-700',
  CERRADO: 'bg-gray-200 text-gray-600',
};
const FILTERS = [['', 'Todos'], ['PENDIENTE', 'Pendientes'], ['RESPONDIDO', 'Respondidos'], ['CERRADO', 'Cerrados']] as const;

export default function ReclamacionesAdminPage() {
  const [items, setItems] = useState<Reclamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [sel, setSel] = useState<Reclamo | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi().reclamaciones.list(filter || undefined);
      setItems(data as unknown as Reclamo[]);
    } catch { /* noop */ } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function open(r: Reclamo) { setSel(r); setRespuesta(r.respuesta || ''); }

  async function send(estado?: string) {
    if (!sel) return;
    setSaving(true);
    try {
      await adminApi().reclamaciones.respond(sel.id, estado ? { estado } : { respuesta });
      setSel(null);
      await load();
    } catch { /* noop */ } finally { setSaving(false); }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Libro de Reclamaciones</h1>
        <button onClick={load} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100" aria-label="Recargar"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === v ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-400 text-sm">No hay reclamaciones.</p>
      ) : (
        <div className="space-y-2">
          {items.map(r => (
            <button key={r.id} onClick={() => open(r)}
              className="w-full text-left bg-white rounded-xl ring-1 ring-black/5 p-4 hover:ring-primary-300 transition-all flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-500">{r.correlativo}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${ESTADO_BADGE[r.estado] || ''}`}>{r.estado}</span>
                  <span className="text-[10px] uppercase font-semibold text-gray-400">{r.tipo}</span>
                </div>
                <p className="font-semibold text-sm text-gray-900 truncate mt-0.5">{r.consumidorNombre}</p>
                <p className="text-xs text-gray-500 truncate">{r.bienDescripcion}</p>
              </div>
              <span className="text-[11px] text-gray-400 shrink-0">{new Date(r.createdAt).toLocaleDateString('es-PE')}</span>
            </button>
          ))}
        </div>
      )}

      {sel && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4" onClick={() => setSel(null)}>
          <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-mono text-xs text-gray-500">{sel.correlativo}</p>
                <h2 className="font-bold text-lg text-gray-900">{sel.consumidorNombre}</h2>
              </div>
              <button onClick={() => setSel(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <dl className="text-sm space-y-1.5 mb-4">
              {([
                ['Tipo', sel.tipo],
                ['Documento', `${sel.consumidorTipoDoc} ${sel.consumidorNumDoc}`],
                ['Email', sel.consumidorEmail],
                ['Teléfono', sel.consumidorTelefono || '—'],
                ['Domicilio', sel.consumidorDomicilio],
                ['Menor de edad', sel.esMenor ? `Sí — Apoderado: ${sel.apoderadoNombre || '—'}` : 'No'],
                ['Bien', `${sel.bienTipo}: ${sel.bienDescripcion}`],
                ['Monto reclamado', sel.montoReclamado ? `S/ ${sel.montoReclamado}` : '—'],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex gap-2"><dt className="text-gray-400 w-32 shrink-0">{k}</dt><dd className="text-gray-800">{v}</dd></div>
              ))}
            </dl>

            <div className="space-y-2 mb-4">
              <div><p className="text-xs font-semibold text-gray-400">Detalle</p><p className="text-sm text-gray-800 whitespace-pre-wrap">{sel.detalle}</p></div>
              <div><p className="text-xs font-semibold text-gray-400">Pedido del consumidor</p><p className="text-sm text-gray-800 whitespace-pre-wrap">{sel.pedido}</p></div>
            </div>

            <label className="block text-xs font-semibold text-gray-500 mb-1">Respuesta al consumidor</label>
            <textarea value={respuesta} onChange={e => setRespuesta(e.target.value)} rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Escribe la respuesta. Al guardar se enviará por correo al consumidor." />

            <div className="flex gap-2 mt-3">
              <button disabled={saving || !respuesta.trim()} onClick={() => send()}
                className="flex-1 bg-primary-600 hover:bg-primary-500 text-white font-bold py-2.5 rounded-full text-sm disabled:opacity-50">
                {saving ? 'Guardando…' : 'Responder y enviar correo'}
              </button>
              {sel.estado !== 'CERRADO' && (
                <button disabled={saving} onClick={() => send('CERRADO')}
                  className="px-4 py-2.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50">
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
