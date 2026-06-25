'use client';

// Drawer de detalle de un movimiento + gestión de vouchers (comprobantes).
// Subida estilo Drive/Notion: arrastrar, elegir archivo o tomar foto (móvil).
// Acepta imágenes y PDF (≤ 8MB). El movimiento muestra toda su trazabilidad.

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Upload, FileText, Trash2, Ban, Camera, Loader2, ExternalLink } from 'lucide-react';
import { adminApi, type FinanceMovement, type FinanceVoucher, type FinanceAccount } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import { HL, Danger } from '@/components/ui/highlight';
import { fmt, fmtDate, TYPE_LABELS, SOURCE_LABELS, CATEGORY_LABELS, METHOD_LABELS } from './shared';

const CATEGORY_OPTIONS = [
  'servicios', 'adelanto', 'productos', 'alquiler', 'salarios', 'servicios_pub',
  'marketing', 'equipos', 'mantenimiento', 'transporte', 'impuestos',
  'servicios_externos', 'cursos', 'alquiler_espacio', 'otro',
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MovementDetailDrawer({
  token, movement, onClose, onChanged,
}: {
  token: string;
  movement: FinanceMovement | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [vouchers, setVouchers] = useState<FinanceVoucher[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try { setVouchers(await adminApi(token).finanzas.vouchers.list(id)); }
    catch { setVouchers([]); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    if (!movement) return;
    setError('');
    load(movement.id);
    adminApi(token).finanzas.cuentas.list().then(setAccounts).catch(() => setAccounts([]));
  }, [movement, load, token]);

  async function patch(data: Parameters<ReturnType<typeof adminApi>['finanzas']['movimientos']['update']>[1]) {
    if (!movement) return;
    try { await adminApi(token).finanzas.movimientos.update(movement.id, data); onChanged(); }
    catch (err) { setError((err as Error).message || 'No se pudo actualizar'); }
  }

  async function upload(files: FileList | File[]) {
    if (!movement) return;
    setError('');
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 8 * 1024 * 1024) { setError(`${file.name}: supera 8MB`); continue; }
        const b64 = await fileToBase64(file);
        await adminApi(token).finanzas.vouchers.upload(movement.id, b64, file.name);
      }
      await load(movement.id);
      onChanged();
    } catch (err) {
      setError((err as Error).message || 'No se pudo subir el comprobante');
    } finally {
      setUploading(false);
    }
  }

  async function removeVoucher(v: FinanceVoucher) {
    const ok = await confirmAction({
      title: '¿Eliminar comprobante?',
      message: <>Se eliminará <HL>{v.fileName || 'el archivo'}</HL>. <Danger>No se puede deshacer.</Danger></>,
      danger: true,
    });
    if (!ok || !movement) return;
    await adminApi(token).finanzas.vouchers.delete(v.id);
    await load(movement.id);
    onChanged();
  }

  async function anular() {
    if (!movement) return;
    const ok = await confirmAction({
      title: '¿Anular movimiento?',
      message: <>Se anulará <HL>{movement.description}</HL>. <Danger>Se conserva en el historial pero deja de sumar.</Danger></>,
      danger: true,
    });
    if (!ok) return;
    await adminApi(token).finanzas.movimientos.anular(movement.id);
    onChanged();
    onClose();
  }

  const m = movement;
  const isIn = m?.direction === 'in';

  return (
    <>
      <div className={`fixed inset-0 bg-black/30 z-50 transition-opacity ${m ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <aside className={`fixed top-0 right-0 h-full w-full sm:w-[460px] bg-white z-50 shadow-2xl transition-transform duration-300 flex flex-col ${m ? 'translate-x-0' : 'translate-x-full'}`}>
        {m && (
          <>
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-lg truncate">{m.description}</p>
                <p className={`text-xl font-bold ${m.status === 'void' ? 'line-through text-gray-400' : isIn ? 'text-emerald-600' : 'text-red-500'}`}>
                  {isIn ? '+' : '−'}{fmt(m.amountPen)}
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Detalle */}
              <dl className="px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm border-b border-gray-50">
                <Field label="Fecha" value={fmtDate(m.occurredAt)} />
                <Field label="Tipo" value={TYPE_LABELS[m.type] ?? m.type} />
                <Field label="Categoría" value={m.category ? (CATEGORY_LABELS[m.category] ?? m.category) : '—'} />
                <Field label="Método" value={m.paymentMethod ? (METHOD_LABELS[m.paymentMethod] ?? m.paymentMethod) : '—'} />
                <Field label="Origen" value={SOURCE_LABELS[m.source] ?? m.source} />
                <Field label="Cuenta" value={m.account?.name ?? '—'} />
                {m.status === 'void' && <Field label="Estado" value={`Anulado${m.voidReason ? ` · ${m.voidReason}` : ''}`} />}
              </dl>

              {/* Categorizar / asignar cuenta (resolución rápida) */}
              {m.status !== 'void' && (
                <div className="px-5 py-4 grid grid-cols-2 gap-3 border-b border-gray-50">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Categoría</label>
                    <select defaultValue={m.category ?? ''} onChange={(e) => patch({ category: e.target.value || null })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                      <option value="">Sin categoría</option>
                      {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Cuenta</label>
                    <select defaultValue={m.accountId ?? ''} onChange={(e) => patch({ accountId: e.target.value || null })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                      <option value="">Sin cuenta</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Vouchers */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm">Comprobantes</h4>
                  <div className="flex gap-2">
                    <button onClick={() => cameraRef.current?.click()} className="sm:hidden flex items-center gap-1 text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-1">
                      <Camera className="w-3.5 h-3.5" /> Foto
                    </button>
                    <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-1">
                      <Upload className="w-3.5 h-3.5" /> Subir
                    </button>
                  </div>
                </div>

                <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden
                  onChange={(e) => e.target.files && upload(e.target.files)} />
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
                  onChange={(e) => e.target.files && upload(e.target.files)} />

                {/* Zona drag & drop */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  {uploading ? (
                    <span className="inline-flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</span>
                  ) : (
                    <span className="text-sm text-gray-500">Arrastra una imagen o PDF, o haz clic para elegir</span>
                  )}
                </div>
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

                {/* Galería */}
                {loading ? (
                  <p className="text-sm text-gray-400 mt-4">Cargando...</p>
                ) : vouchers.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {vouchers.map((v) => (
                      <div key={v.id} className="relative group rounded-lg overflow-hidden border border-gray-100 aspect-square">
                        {v.fileType === 'pdf' ? (
                          <a href={v.url} target="_blank" rel="noreferrer" className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-500">
                            <FileText className="w-7 h-7" />
                            <span className="text-[10px] mt-1 px-1 truncate w-full text-center">PDF</span>
                          </a>
                        ) : (
                          <a href={v.url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={v.url} alt={v.fileName || 'comprobante'} className="w-full h-full object-cover" />
                          </a>
                        )}
                        <button onClick={() => removeVoucher(v)}
                          className="absolute top-1 right-1 p-1 bg-white/90 rounded-md text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <a href={v.url} target="_blank" rel="noreferrer"
                          className="absolute bottom-1 right-1 p-1 bg-white/90 rounded-md text-gray-500 hover:text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            {m.status !== 'void' && (
              <div className="px-5 py-3 border-t border-gray-100">
                <button onClick={anular} className="w-full flex items-center justify-center gap-2 text-sm text-red-600 border border-red-200 rounded-xl py-2 hover:bg-red-50">
                  <Ban className="w-4 h-4" /> Anular movimiento
                </button>
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-gray-800">{value}</dd>
    </div>
  );
}
