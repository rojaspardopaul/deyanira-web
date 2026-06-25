'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { ChevronLeft, Plus, Pencil, Trash2, X, Save, BookOpen } from 'lucide-react';
import { Toast, type ToastState } from '@/components/ui/Toast';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { confirmAction } from '@/lib/confirm';
import { HL, Danger } from '@/components/ui/highlight';
import { ZoomableImage } from '@/components/catalog/ZoomableImage';
import { clImage } from '@/lib/cloudinary-client';

type CatalogItemRow = {
  id: string;
  groupLabel: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  extraPricePen: number | string | null;
  extraMinutes: number | null;
  sortOrder: number;
};
type CatalogDetail = {
  id: string;
  slug: string;
  name: string;
  items: CatalogItemRow[];
};

const EMPTY_ITEM = { groupLabel: '', title: '', description: '', imageUrl: '', extraPricePen: '', extraMinutes: '', sortOrder: 0 };

export default function AdminCatalogDetailPage() {
  const params = useParams();
  const catalogId = String(params?.id || '');
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<CatalogDetail | null>(null);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<CatalogItemRow | null>(null);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const load = useCallback(async () => {
    if (!catalogId) return;
    setLoading(true);
    try {
      const data = (await adminApi().catalogs.get(catalogId)) as CatalogDetail;
      setCat(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [catalogId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(EMPTY_ITEM); setEditing(null); setModal('create');
  }
  function openEdit(it: CatalogItemRow) {
    setForm({
      groupLabel: it.groupLabel || '',
      title: it.title,
      description: it.description || '',
      imageUrl: it.imageUrl || '',
      extraPricePen: it.extraPricePen != null ? String(it.extraPricePen) : '',
      extraMinutes: it.extraMinutes != null ? String(it.extraMinutes) : '',
      sortOrder: it.sortOrder,
    });
    setEditing(it); setModal('edit');
  }
  async function save() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        extraPricePen: form.extraPricePen ? Number(form.extraPricePen) : null,
        extraMinutes: form.extraMinutes ? Number(form.extraMinutes) : null,
      };
      if (editing) {
        await adminApi().catalogs.updateItem(editing.id, payload);
        setToast({ type: 'success', msg: `Item "${form.title}" actualizado` });
      } else {
        await adminApi().catalogs.addItem(catalogId, payload);
        setToast({ type: 'success', msg: `Item "${form.title}" creado` });
      }
      await load();
      setModal(null);
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  }
  async function remove(it: CatalogItemRow) {
    if (!(await confirmAction({
      title: '¿Eliminar ítem?',
      message: <>Se eliminará <HL>{it.title}</HL> del catálogo. <Danger>Esta acción no se puede deshacer.</Danger></>,
      danger: true,
    }))) return;
    try {
      await adminApi().catalogs.deleteItem(it.id);
      setToast({ type: 'success', msg: 'Item eliminado' });
      await load();
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'Error al eliminar' });
    }
  }

  if (loading || !cat) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando…</div>;
  }

  // Group items by groupLabel
  const groups: Record<string, CatalogItemRow[]> = {};
  for (const it of cat.items) {
    const g = it.groupLabel || 'General';
    if (!groups[g]) groups[g] = [];
    groups[g].push(it);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link href="/admin/catalogos" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-3">
          <ChevronLeft className="w-4 h-4" /> Catálogos
        </Link>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-amber-500" />
            <div>
              <h1 className="text-3xl font-display font-bold">{cat.name}</h1>
              <p className="text-xs text-gray-500">
                <Link href={`/catalogo/${cat.slug}`} target="_blank" rel="noopener" className="hover:underline">
                  /catalogo/{cat.slug} ↗
                </Link>
              </p>
            </div>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm text-white bg-amber-500 hover:bg-amber-600">
            <Plus className="w-4 h-4" /> Nuevo item
          </button>
        </div>

        {cat.items.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
            <p className="font-semibold mb-1">Aún no hay items</p>
            <p className="text-sm text-gray-500">Agrega items con grupos (ej. &ldquo;Normal&rdquo;, &ldquo;Elaborado&rdquo;, &ldquo;Muy elaborado&rdquo;).</p>
          </div>
        ) : (
          Object.entries(groups).map(([groupLabel, items]) => (
            <section key={groupLabel} className="mb-6">
              <h2 className="font-bold text-lg mb-3">{groupLabel}</h2>
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-3">
                {items.map((it) => (
                  <article key={it.id} className="mb-3 break-inside-avoid bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    {it.imageUrl && (
                      <ZoomableImage
                        src={clImage(it.imageUrl, { w: 800, crop: 'limit' })}
                        full={clImage(it.imageUrl, { w: 1600, crop: 'limit' })}
                        alt={it.title}
                        className="w-full h-auto"
                      />
                    )}
                    <div className="p-3">
                      <h3 className="font-bold text-sm">{it.title}</h3>
                      {it.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{it.description}</p>}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
                        {it.extraPricePen != null && Number(it.extraPricePen) > 0 && <span>+S/{Number(it.extraPricePen)}</span>}
                        {it.extraMinutes != null && it.extraMinutes > 0 && <span>+{it.extraMinutes} min</span>}
                      </div>
                      <div className="flex gap-1 mt-3">
                        <button onClick={() => openEdit(it)} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => remove(it)} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4" onClick={() => setModal(null)}>
          <div className="bg-white w-full md:max-w-xl rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-lg">{editing ? 'Editar item' : 'Nuevo item'}</h3>
              <button onClick={() => setModal(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Grupo</label>
                  <input type="text" value={form.groupLabel}
                    onChange={(e) => setForm({ ...form, groupLabel: e.target.value })}
                    placeholder="Normal / Elaborado…"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Título *</label>
                  <input type="text" value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Recogido alto"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Descripción</label>
                <textarea value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none" />
              </div>
              <ImageUploader
                value={form.imageUrl}
                onChange={(url) => setForm({ ...form, imageUrl: url || '' })}
                folder="catalogos"
                label="Imagen del item"
                slot="catalogItem"
                onError={(msg) => setToast({ type: 'error', msg })}
              />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">+ S/</label>
                  <input type="number" min={0} step="0.01" value={form.extraPricePen}
                    onChange={(e) => setForm({ ...form, extraPricePen: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">+ min</label>
                  <input type="number" min={0} value={form.extraMinutes}
                    onChange={(e) => setForm({ ...form, extraMinutes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Orden</label>
                  <input type="number" value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100">Cancelar</button>
              <button onClick={save} disabled={saving || !form.title}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50">
                <Save className="w-4 h-4" />{saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
