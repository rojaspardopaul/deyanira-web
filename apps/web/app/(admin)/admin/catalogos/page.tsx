'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { ChevronLeft, Plus, Pencil, Trash2, X, Save, BookOpen, ArrowRight } from 'lucide-react';
import { Toast, type ToastState } from '@/components/ui/Toast';
import { ImageUploader } from '@/components/ui/ImageUploader';

type CatalogRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  heroImageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { items: number };
};

const EMPTY = { name: '', slug: '', description: '', heroImageUrl: '', sortOrder: 0, isActive: true };

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export default function AdminCatalogosPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CatalogRow[]>([]);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = (await adminApi().catalogs.list()) as CatalogRow[];
      setItems(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(EMPTY); setEditing(null); setError(''); setModal('create');
  }
  function openEdit(c: CatalogRow) {
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description || '',
      heroImageUrl: c.heroImageUrl || '',
      sortOrder: c.sortOrder,
      isActive: c.isActive,
    });
    setEditing(c); setError(''); setModal('edit');
  }
  async function save() {
    setSaving(true); setError('');
    try {
      const payload = { ...form, slug: form.slug || slugify(form.name) };
      if (editing) {
        await adminApi().catalogs.update(editing.id, payload);
        setToast({ type: 'success', msg: `Catálogo "${form.name}" actualizado` });
      } else {
        await adminApi().catalogs.create(payload);
        setToast({ type: 'success', msg: `Catálogo "${form.name}" creado` });
      }
      await load();
      setModal(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error';
      setError(msg);
      setToast({ type: 'error', msg });
    } finally {
      setSaving(false);
    }
  }
  async function remove(c: CatalogRow) {
    if (!confirm(`¿Eliminar el catálogo "${c.name}" y todos sus items?`)) return;
    try {
      await adminApi().catalogs.delete(c.id);
      setToast({ type: 'success', msg: 'Catálogo eliminado' });
      await load();
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'Error al eliminar' });
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-2">
              <ChevronLeft className="w-4 h-4" /> Dashboard
            </Link>
            <h1 className="text-3xl font-display font-bold flex items-center gap-2">
              <BookOpen className="w-7 h-7" /> Catálogos visuales
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Peinados, cortes, colores… Vincúlalos a servicios via el campo &ldquo;Catálogo asociado&rdquo; en el form de servicio.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm text-white bg-amber-500 hover:bg-amber-600"
          >
            <Plus className="w-4 h-4" /> Nuevo catálogo
          </button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="font-semibold mb-1">Aún no hay catálogos</p>
            <p className="text-sm text-gray-500">Crea uno (ej. &ldquo;Peinados&rdquo;) y agrega items para que se enlacen desde los servicios.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {items.map((c) => (
              <article key={c.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-sm transition" style={{ opacity: c.isActive ? 1 : 0.6 }}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-lg">{c.name}</h3>
                      <p className="text-xs text-gray-500">/catalogo/{c.slug}</p>
                      {c.description && <p className="text-xs text-gray-600 mt-2">{c.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold text-amber-600">{c._count?.items || 0}</p>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500">items</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 flex-wrap">
                    <Link
                      href={`/admin/catalogos/${c.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600"
                    >
                      Gestionar items <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <button onClick={() => openEdit(c)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200">
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button onClick={() => remove(c)} className="ml-auto p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4" onClick={() => setModal(null)}>
          <div className="bg-white w-full md:max-w-xl rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-lg">{editing ? 'Editar catálogo' : 'Nuevo catálogo'}</h3>
              <button onClick={() => setModal(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Nombre *</label>
                  <input type="text" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })}
                    placeholder="Peinados"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Slug</label>
                  <input type="text" value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                    placeholder="peinados"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 font-mono text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Descripción</label>
                <textarea value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 resize-none" />
              </div>
              <ImageUploader
                value={form.heroImageUrl}
                onChange={(url) => setForm({ ...form, heroImageUrl: url || '' })}
                folder="catalogos"
                label="Imagen principal (hero)"
                aspect="21/9"
                onError={(msg) => setToast({ type: 'error', msg })}
              />
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 rounded text-amber-500" />
                  <span className="text-sm">Activo</span>
                </label>
                <div className="flex-1">
                  <input type="number" value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    placeholder="Orden"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100">Cancelar</button>
              <button onClick={save} disabled={saving || !form.name}
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
