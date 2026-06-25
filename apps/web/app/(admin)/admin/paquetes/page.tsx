'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { ChevronLeft, Plus, Pencil, Trash2, X, Save, Package, Eye, EyeOff, Star, ArrowRight, Crown } from 'lucide-react';
import { Toast, type ToastState } from '@/components/ui/Toast';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { confirmAction } from '@/lib/confirm';
import { HL, Danger } from '@/components/ui/highlight';

type EventTypeRow = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  shortDesc: string | null;
  heroImageUrl: string | null;
  presentationMd: string | null;
  policiesMd: string | null;
  accentColor: string;
  icon: string | null;
  sortOrder: number;
  highlight: boolean;
  isActive: boolean;
  _count?: { packages: number; benefits: number; addons: number };
};

const EMPTY_ET = {
  name: '', slug: '', tagline: '', shortDesc: '', heroImageUrl: '',
  presentationMd: '', policiesMd: '', accentColor: '#E8C040',
  icon: '✨', sortOrder: 0, highlight: false, isActive: true,
};

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export default function AdminPaquetesPage() {
  const [loading, setLoading] = useState(true);
  const [eventTypes, setEventTypes] = useState<EventTypeRow[]>([]);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<EventTypeRow | null>(null);
  const [form, setForm] = useState(EMPTY_ET);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = (await adminApi().eventTypes.list()) as EventTypeRow[];
      setEventTypes(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // La auth admin es por cookies HttpOnly — la sesión caducada la maneja el cliente API.
    load();
  }, [load]);

  function openCreate() {
    setForm(EMPTY_ET);
    setEditing(null);
    setError('');
    setModal('create');
  }

  function openEdit(et: EventTypeRow) {
    setForm({
      name: et.name,
      slug: et.slug,
      tagline: et.tagline || '',
      shortDesc: et.shortDesc || '',
      heroImageUrl: et.heroImageUrl || '',
      presentationMd: et.presentationMd || '',
      policiesMd: et.policiesMd || '',
      accentColor: et.accentColor || '#E8C040',
      icon: et.icon || '',
      sortOrder: et.sortOrder,
      highlight: et.highlight,
      isActive: et.isActive,
    });
    setEditing(et);
    setError('');
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setEditing(null);
    setError('');
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        slug: form.slug || slugify(form.name),
      };
      if (editing) {
        await adminApi().eventTypes.update(editing.id, payload);
        setToast({ type: 'success', msg: `Evento "${form.name}" actualizado` });
      } else {
        await adminApi().eventTypes.create(payload);
        setToast({ type: 'success', msg: `Evento "${form.name}" creado` });
      }
      await load();
      closeModal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      setError(msg);
      setToast({ type: 'error', msg });
    } finally {
      setSaving(false);
    }
  }

  async function remove(et: EventTypeRow) {
    if (!(await confirmAction({
      title: '¿Eliminar evento?',
      message: <>Se eliminará el evento <HL>{et.name}</HL> con <Danger>todos sus paquetes y contenido</Danger>. <Danger>Esta acción no se puede deshacer.</Danger></>,
      danger: true,
    }))) return;
    try {
      await adminApi().eventTypes.delete(et.id);
      setToast({ type: 'success', msg: `Evento "${et.name}" eliminado` });
      await load();
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'Error al eliminar' });
    }
  }

  async function toggleActive(et: EventTypeRow) {
    try {
      await adminApi().eventTypes.update(et.id, { isActive: !et.isActive });
      setToast({ type: 'success', msg: `Evento ${!et.isActive ? 'activado' : 'desactivado'}` });
      await load();
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'Error al actualizar' });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-2">
              <ChevronLeft className="w-4 h-4" /> Dashboard
            </Link>
            <h1 className="text-3xl font-display font-bold flex items-center gap-2">
              <Package className="w-7 h-7" /> Eventos y paquetes
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Crea categorías de evento (Novia, Quinceañera…) con sus paquetes y contenido informativo.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm text-white bg-amber-500 hover:bg-amber-600 transition"
          >
            <Plus className="w-4 h-4" /> Nuevo evento
          </button>
        </div>

        {/* Lista de event types */}
        {eventTypes.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="font-semibold mb-1">Aún no hay eventos creados</p>
            <p className="text-sm text-gray-500 mb-5">Empieza creando &ldquo;Novia&rdquo; o &ldquo;Quinceañera&rdquo;.</p>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm text-white bg-amber-500 hover:bg-amber-600 transition"
            >
              <Plus className="w-4 h-4" /> Crear primer evento
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {eventTypes.map((et) => (
              <article
                key={et.id}
                className="relative bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition"
                style={{ opacity: et.isActive ? 1 : 0.6 }}
              >
                {/* Banda superior con color de acento */}
                <div className="h-1" style={{ background: et.accentColor }} />

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                        style={{ background: `${et.accentColor}18` }}
                      >
                        {et.icon || '✨'}
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-display font-bold text-xl truncate">{et.name}</h2>
                        <p className="text-xs text-gray-500 truncate">/servicios/{et.slug}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {et.highlight && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: `${et.accentColor}22`, color: et.accentColor }}
                          title="Destacado en /servicios"
                        >
                          <Crown className="w-3 h-3" /> Destacado
                        </span>
                      )}
                    </div>
                  </div>

                  {et.tagline && (
                    <p className="text-sm italic text-gray-600 mb-3">&ldquo;{et.tagline}&rdquo;</p>
                  )}
                  {et.shortDesc && (
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{et.shortDesc}</p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
                      <div className="text-lg font-bold">{et._count?.packages ?? 0}</div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-500">Paquetes</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
                      <div className="text-lg font-bold">{et._count?.addons ?? 0}</div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-500">Add-ons</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
                      <div className="text-lg font-bold">{et._count?.benefits ?? 0}</div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-500">Ventajas</div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/admin/paquetes/${et.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition"
                      style={{ background: et.accentColor }}
                    >
                      Gestionar paquetes <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => openEdit(et)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(et)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
                      title={et.isActive ? 'Desactivar' : 'Activar'}
                    >
                      {et.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {et.isActive ? 'Activo' : 'Oculto'}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(et)}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 transition ml-auto"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4" onClick={closeModal}>
          <div
            className="bg-white w-full md:max-w-2xl rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-lg">{editing ? 'Editar evento' : 'Nuevo evento'}</h3>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })}
                    placeholder="Novia"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Slug *</label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                    placeholder="novia"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Tagline</label>
                <input
                  type="text"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  placeholder="Más que mi profesión, mi pasión"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none italic"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Descripción corta</label>
                <textarea
                  value={form.shortDesc}
                  onChange={(e) => setForm({ ...form, shortDesc: e.target.value })}
                  rows={2}
                  placeholder="Una línea o dos sobre este evento (sale en las cards)"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none resize-none"
                />
              </div>

              <ImageUploader
                value={form.heroImageUrl}
                onChange={(url) => setForm({ ...form, heroImageUrl: url || '' })}
                folder="eventos"
                label="Imagen principal (hero)"
                helpText="Se muestra como fondo del evento en /servicios/[slug]"
                slot="eventHero"
                onError={(msg) => setToast({ type: 'error', msg })}
              />

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Color acento</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={form.accentColor}
                      onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                      className="w-12 h-10 rounded-lg cursor-pointer border border-gray-200"
                    />
                    <input
                      type="text"
                      value={form.accentColor}
                      onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                      placeholder="#E8C040"
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 font-mono text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Icono</label>
                  <input
                    type="text"
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    placeholder="👰"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-center text-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Orden</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Presentación</label>
                  <span className="cursor-help text-xs text-gray-400 hover:text-gray-700"
                    title="Texto introductorio del evento. Acepta formato: **negrita**, listas con -, encabezados con ###. Si solo pones texto plano, se ve normal.">ⓘ</span>
                </div>
                <textarea
                  value={form.presentationMd}
                  onChange={(e) => setForm({ ...form, presentationMd: e.target.value })}
                  rows={6}
                  placeholder="¡Hola, querida novia! Soy Deyanira…"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none text-sm leading-relaxed resize-none"
                />
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Datos a tomar en cuenta</label>
                  <span className="cursor-help text-xs text-gray-400 hover:text-gray-700"
                    title="Políticas: depósito, cancelación, pruebas. Acepta listas con - y **negrita**.">ⓘ</span>
                </div>
                <textarea
                  value={form.policiesMd}
                  onChange={(e) => setForm({ ...form, policiesMd: e.target.value })}
                  rows={6}
                  placeholder="- Las pruebas son previa coordinación... &#10;- 50 % de depósito ..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none font-mono text-xs leading-relaxed resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.highlight}
                    onChange={(e) => setForm({ ...form, highlight: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Star className="w-4 h-4" /> Destacar en /servicios
                  </span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-sm font-medium">Activo (visible en la web)</span>
                </label>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !form.name}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear evento'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
