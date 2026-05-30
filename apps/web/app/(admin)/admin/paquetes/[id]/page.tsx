'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import {
  ChevronLeft, Plus, Pencil, Trash2, X, Save, Package, Star, Users,
  Sparkles, GripVertical, ArrowUp, ArrowDown, Eye, EyeOff,
} from 'lucide-react';
import { Toast, type ToastState } from '@/components/ui/Toast';
import { ImageUploader } from '@/components/ui/ImageUploader';

type ServiceLite = { id: string; name: string };
type EventTypeDetail = {
  id: string;
  name: string;
  slug: string;
  accentColor: string;
  isActive: boolean;
  packages: PackageRow[];
  benefits: BenefitRow[];
  addons: AddonRow[];
};
type PackageItem = {
  id?: string;
  label: string;
  serviceId: string | null;
  quantity: number;
  sortOrder?: number;
  service?: ServiceLite;
};
type PackageRow = {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  pricePen: number | string;
  comparePricePen: number | string | null;
  groupSize: number | null;
  groupLabel: string | null;
  hasTrial: boolean;
  highlighted: boolean;
  sortOrder: number;
  isActive: boolean;
  requiresDeposit?: boolean;
  depositPercent?: number;
  items: PackageItem[];
  trialAddonServiceId: string | null;
  trialAddonPricePen: number | string | null;
};
type AddonRow = {
  id: string;
  name: string;
  description: string | null;
  pricePen: number | string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
};
type BenefitRow = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
};

type Tab = 'packages' | 'addons' | 'benefits';

const EMPTY_PKG = {
  name: '', slug: '', subtitle: '', description: '', imageUrl: '',
  pricePen: '', comparePricePen: '', groupSize: '', groupLabel: '',
  hasTrial: false, highlighted: false, sortOrder: 0, isActive: true,
  trialAddonServiceId: '', trialAddonPricePen: '',
  requiresDeposit: true, depositPercent: 50,
  items: [] as PackageItem[],
};

const EMPTY_ADDON = {
  name: '', description: '', pricePen: '', icon: '✨', sortOrder: 0, isActive: true,
};

const EMPTY_BENEFIT = {
  title: '', description: '', icon: '✨', sortOrder: 0,
};

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export default function AdminEventDetailPage() {
  const params = useParams();
  const eventTypeId = String(params?.id || '');
  const [loading, setLoading] = useState(true);
  const [et, setEt] = useState<EventTypeDetail | null>(null);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [tab, setTab] = useState<Tab>('packages');
  const [toast, setToast] = useState<ToastState>(null);

  // Package modal
  const [pkgModal, setPkgModal] = useState<'create' | 'edit' | null>(null);
  const [editingPkg, setEditingPkg] = useState<PackageRow | null>(null);
  const [pkgForm, setPkgForm] = useState(EMPTY_PKG);
  const [pkgError, setPkgError] = useState('');
  const [pkgSaving, setPkgSaving] = useState(false);

  // Addon modal
  const [addonModal, setAddonModal] = useState<'create' | 'edit' | null>(null);
  const [editingAddon, setEditingAddon] = useState<AddonRow | null>(null);
  const [addonForm, setAddonForm] = useState(EMPTY_ADDON);
  const [addonSaving, setAddonSaving] = useState(false);

  // Benefit modal
  const [benefitModal, setBenefitModal] = useState<'create' | 'edit' | null>(null);
  const [editingBenefit, setEditingBenefit] = useState<BenefitRow | null>(null);
  const [benefitForm, setBenefitForm] = useState(EMPTY_BENEFIT);
  const [benefitSaving, setBenefitSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, allServices] = await Promise.all([
        adminApi().eventTypes.get(eventTypeId) as Promise<EventTypeDetail>,
        adminApi().services.list() as Promise<ServiceLite[]>,
      ]);
      setEt(detail);
      setServices(allServices.map((s) => ({ id: s.id, name: s.name })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [eventTypeId]);

  useEffect(() => {
    // La auth admin es por cookies HttpOnly — si la sesión caducó, el cliente API
    // dispara el evento 'admin:session-expired' que el layout admin maneja.
    if (!eventTypeId) return;
    load();
  }, [eventTypeId, load]);

  // ── PACKAGES ──────────────────────────────────────────────
  function openCreatePkg() {
    setPkgForm({ ...EMPTY_PKG, sortOrder: et ? et.packages.length : 0 });
    setEditingPkg(null);
    setPkgError('');
    setPkgModal('create');
  }
  function openEditPkg(p: PackageRow) {
    setPkgForm({
      name: p.name,
      slug: p.slug,
      subtitle: p.subtitle || '',
      description: p.description || '',
      imageUrl: p.imageUrl || '',
      pricePen: String(p.pricePen),
      comparePricePen: p.comparePricePen == null ? '' : String(p.comparePricePen),
      trialAddonServiceId: p.trialAddonServiceId || '',
      trialAddonPricePen: p.trialAddonPricePen == null ? '' : String(p.trialAddonPricePen),
      groupSize: p.groupSize == null ? '' : String(p.groupSize),
      groupLabel: p.groupLabel || '',
      hasTrial: p.hasTrial,
      highlighted: p.highlighted,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
      requiresDeposit: p.requiresDeposit ?? true,
      depositPercent: p.depositPercent ?? 50,
      items: p.items.map((i) => ({ ...i })),
    });
    setEditingPkg(p);
    setPkgError('');
    setPkgModal('edit');
  }

  function addItem() {
    setPkgForm((s) => ({ ...s, items: [...s.items, { label: '', serviceId: null, quantity: 1 }] }));
  }
  function updateItem(idx: number, patch: Partial<PackageItem>) {
    setPkgForm((s) => ({ ...s, items: s.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  }
  function removeItem(idx: number) {
    setPkgForm((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }));
  }
  function moveItem(idx: number, dir: -1 | 1) {
    setPkgForm((s) => {
      const items = [...s.items];
      const target = idx + dir;
      if (target < 0 || target >= items.length) return s;
      [items[idx], items[target]] = [items[target], items[idx]];
      return { ...s, items };
    });
  }

  async function savePkg() {
    setPkgSaving(true);
    setPkgError('');
    try {
      const payload = {
        eventTypeId,
        ...pkgForm,
        slug: pkgForm.slug || slugify(pkgForm.name),
        pricePen: Number(pkgForm.pricePen) || 0,
        comparePricePen: pkgForm.comparePricePen === '' ? null : Number(pkgForm.comparePricePen),
        groupSize: pkgForm.groupSize === '' ? null : Number(pkgForm.groupSize),
        trialAddonServiceId: pkgForm.trialAddonServiceId || null,
        trialAddonPricePen: pkgForm.trialAddonPricePen === '' ? null : Number(pkgForm.trialAddonPricePen),
      };
      if (editingPkg) {
        await adminApi().packages.update(editingPkg.id, payload);
        setToast({ type: 'success', msg: `Paquete "${pkgForm.name}" actualizado` });
      } else {
        await adminApi().packages.create(payload);
        setToast({ type: 'success', msg: `Paquete "${pkgForm.name}" creado` });
      }
      await load();
      setPkgModal(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      setPkgError(msg);
      setToast({ type: 'error', msg });
    } finally {
      setPkgSaving(false);
    }
  }

  async function removePkg(p: PackageRow) {
    if (!confirm(`¿Eliminar el paquete "${p.name}"?`)) return;
    try {
      await adminApi().packages.delete(p.id);
      setToast({ type: 'success', msg: 'Paquete eliminado' });
      await load();
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'Error al eliminar' });
    }
  }

  // ── ADDONS ────────────────────────────────────────────────
  function openCreateAddon() {
    setAddonForm({ ...EMPTY_ADDON, sortOrder: et ? et.addons.length : 0 });
    setEditingAddon(null);
    setAddonModal('create');
  }
  function openEditAddon(a: AddonRow) {
    setAddonForm({
      name: a.name,
      description: a.description || '',
      pricePen: String(a.pricePen),
      icon: a.icon || '✨',
      sortOrder: a.sortOrder,
      isActive: a.isActive,
    });
    setEditingAddon(a);
    setAddonModal('edit');
  }
  async function saveAddon() {
    setAddonSaving(true);
    try {
      const payload = {
        eventTypeId,
        ...addonForm,
        pricePen: Number(addonForm.pricePen) || 0,
      };
      if (editingAddon) {
        await adminApi().addons.update(editingAddon.id, payload);
        setToast({ type: 'success', msg: `Add-on "${addonForm.name}" actualizado` });
      } else {
        await adminApi().addons.create(payload);
        setToast({ type: 'success', msg: `Add-on "${addonForm.name}" creado` });
      }
      await load();
      setAddonModal(null);
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'Error al guardar' });
    } finally {
      setAddonSaving(false);
    }
  }
  async function removeAddon(a: AddonRow) {
    if (!confirm(`¿Eliminar el add-on "${a.name}"?`)) return;
    try {
      await adminApi().addons.delete(a.id);
      setToast({ type: 'success', msg: 'Add-on eliminado' });
      await load();
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'Error al eliminar' });
    }
  }

  // ── BENEFITS ──────────────────────────────────────────────
  function openCreateBenefit() {
    setBenefitForm({ ...EMPTY_BENEFIT, sortOrder: et ? et.benefits.length : 0 });
    setEditingBenefit(null);
    setBenefitModal('create');
  }
  function openEditBenefit(b: BenefitRow) {
    setBenefitForm({
      title: b.title,
      description: b.description || '',
      icon: b.icon || '✨',
      sortOrder: b.sortOrder,
    });
    setEditingBenefit(b);
    setBenefitModal('edit');
  }
  async function saveBenefit() {
    setBenefitSaving(true);
    try {
      const payload = { eventTypeId, ...benefitForm };
      if (editingBenefit) {
        await adminApi().benefits.update(editingBenefit.id, payload);
        setToast({ type: 'success', msg: `Ventaja "${benefitForm.title}" actualizada` });
      } else {
        await adminApi().benefits.create(payload);
        setToast({ type: 'success', msg: `Ventaja "${benefitForm.title}" creada` });
      }
      await load();
      setBenefitModal(null);
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'Error al guardar' });
    } finally {
      setBenefitSaving(false);
    }
  }
  async function removeBenefit(b: BenefitRow) {
    if (!confirm(`¿Eliminar la ventaja "${b.title}"?`)) return;
    try {
      await adminApi().benefits.delete(b.id);
      setToast({ type: 'success', msg: 'Ventaja eliminada' });
      await load();
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'Error al eliminar' });
    }
  }

  if (loading || !et) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando…</p>
      </div>
    );
  }

  const accent = et.accentColor || '#E8C040';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <Link href="/admin/paquetes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-3">
          <ChevronLeft className="w-4 h-4" /> Eventos
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: `${accent}18` }}
          >
            <Package className="w-6 h-6" style={{ color: accent }} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold">{et.name}</h1>
            <p className="text-xs text-gray-500">
              <Link href={`/servicios/${et.slug}`} target="_blank" rel="noopener" className="hover:underline">
                /servicios/{et.slug} ↗
              </Link>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
          {[
            { key: 'packages' as Tab, label: 'Paquetes', count: et.packages.length },
            { key: 'addons' as Tab, label: 'Add-ons', count: et.addons.length },
            { key: 'benefits' as Tab, label: 'Ventajas', count: et.benefits.length },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-semibold transition border-b-2 whitespace-nowrap ${
                tab === t.key ? 'border-current' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
              style={tab === t.key ? { color: accent } : undefined}
            >
              {t.label}
              <span
                className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={tab === t.key ? { background: `${accent}22`, color: accent } : { background: '#f3f4f6', color: '#6b7280' }}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* PAQUETES */}
        {tab === 'packages' && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={openCreatePkg}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white transition"
                style={{ background: accent }}
              >
                <Plus className="w-4 h-4" /> Nuevo paquete
              </button>
            </div>
            {et.packages.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                <Package className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                <p className="font-semibold mb-1">Aún no hay paquetes</p>
                <p className="text-sm text-gray-500">Empieza por crear &ldquo;Paquete Uno&rdquo;.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {et.packages.map((p) => (
                  <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-4 hover:shadow-sm transition" style={{ opacity: p.isActive ? 1 : 0.5 }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base">{p.name}</h3>
                        {p.subtitle && <span className="text-xs text-gray-500">— {p.subtitle}</span>}
                        {p.highlighted && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: `${accent}22`, color: accent }}>
                            Recomendado
                          </span>
                        )}
                        {p.trialAddonServiceId && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-pink-100 text-pink-700" title="Tiene toggle 'Con prueba' habilitado">
                            <Sparkles className="w-3 h-3 inline" /> Toggle prueba
                          </span>
                        )}
                        {p.groupLabel && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                            <Users className="w-3 h-3 inline mr-0.5" /> {p.groupLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{p.items.length} items · {p.description || 'Sin descripción'}</p>
                    </div>
                    <div className="font-display font-bold text-xl shrink-0" style={{ color: accent }}>
                      S/{Number(p.pricePen)}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditPkg(p)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => removePkg(p)} className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADDONS */}
        {tab === 'addons' && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={openCreateAddon}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white transition"
                style={{ background: accent }}
              >
                <Plus className="w-4 h-4" /> Nuevo add-on
              </button>
            </div>
            {et.addons.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                <p className="text-sm text-gray-500">No hay add-ons configurados.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {et.addons.map((a) => (
                  <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3" style={{ opacity: a.isActive ? 1 : 0.5 }}>
                    <div className="text-2xl shrink-0">{a.icon || '✨'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-bold text-sm">{a.name}</h3>
                        <span className="font-bold text-sm" style={{ color: accent }}>+S/{Number(a.pricePen)}</span>
                      </div>
                      {a.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{a.description}</p>}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => openEditAddon(a)} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeAddon(a)} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BENEFITS */}
        {tab === 'benefits' && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={openCreateBenefit}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white transition"
                style={{ background: accent }}
              >
                <Plus className="w-4 h-4" /> Nueva ventaja
              </button>
            </div>
            {et.benefits.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                <p className="text-sm text-gray-500">No hay ventajas configuradas.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {et.benefits.map((b) => (
                  <div key={b.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="text-2xl mb-2">{b.icon || '✨'}</div>
                    <h3 className="font-bold text-sm mb-1">{b.title}</h3>
                    {b.description && <p className="text-xs text-gray-500 leading-relaxed mb-3">{b.description}</p>}
                    <div className="flex gap-1">
                      <button onClick={() => openEditBenefit(b)} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeBenefit(b)} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL PACKAGE ───────────────────────────────────── */}
      {pkgModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4" onClick={() => setPkgModal(null)}>
          <div className="bg-white w-full md:max-w-3xl rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-lg">{editingPkg ? 'Editar paquete' : 'Nuevo paquete'}</h3>
              <button onClick={() => setPkgModal(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {pkgError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{pkgError}</div>}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Nombre *</label>
                  <input type="text" value={pkgForm.name}
                    onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value, slug: pkgForm.slug || slugify(e.target.value) })}
                    placeholder="Paquete Uno"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Subtítulo</label>
                  <input type="text" value={pkgForm.subtitle}
                    onChange={(e) => setPkgForm({ ...pkgForm, subtitle: e.target.value })}
                    placeholder="Esencial / Premium / Con prueba…"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200" />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Slug</label>
                  <input type="text" value={pkgForm.slug}
                    onChange={(e) => setPkgForm({ ...pkgForm, slug: slugify(e.target.value) })}
                    placeholder="paquete-uno"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 font-mono text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Precio (S/) *</label>
                  <input type="number" min={0} step="0.01" value={pkgForm.pricePen}
                    onChange={(e) => setPkgForm({ ...pkgForm, pricePen: e.target.value })}
                    placeholder="450"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none font-bold" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1" title="Precio antes de oferta (tachado en la web)">
                    Antes (S/) <span className="text-gray-400 normal-case">opcional</span>
                  </label>
                  <input type="number" min={0} step="0.01" value={pkgForm.comparePricePen}
                    onChange={(e) => setPkgForm({ ...pkgForm, comparePricePen: e.target.value })}
                    placeholder="600"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none line-through text-gray-500" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Descripción</label>
                <textarea value={pkgForm.description}
                  onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })}
                  rows={2}
                  placeholder="Una línea sobre este paquete"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 resize-none" />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1"># personas grupo</label>
                  <input type="number" min={1} value={pkgForm.groupSize}
                    onChange={(e) => setPkgForm({ ...pkgForm, groupSize: e.target.value })}
                    placeholder="3 / 5 …"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Etiqueta grupo</label>
                  <input type="text" value={pkgForm.groupLabel}
                    onChange={(e) => setPkgForm({ ...pkgForm, groupLabel: e.target.value })}
                    placeholder="Novia + 3 familiares"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200" />
                </div>
              </div>

              <ImageUploader
                value={pkgForm.imageUrl}
                onChange={(url) => setPkgForm({ ...pkgForm, imageUrl: url || '' })}
                folder="paquetes"
                label="Imagen del paquete"
                helpText="Se muestra en la card del paquete"
                aspect="16/9"
                onError={(msg) => setToast({ type: 'error', msg })}
              />

              {/* Trial addon (toggle "Con prueba" en card pública) */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">
                  ✨ Toggle &ldquo;Con prueba de maquillaje&rdquo;
                </p>
                <p className="text-[11px] text-amber-700 mb-3">
                  Si configuras un servicio aquí, las cards mostrarán un toggle para que el cliente lo active y el precio se actualice.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 block mb-1">Servicio prueba</label>
                    <select
                      value={pkgForm.trialAddonServiceId}
                      onChange={(e) => setPkgForm({ ...pkgForm, trialAddonServiceId: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm"
                    >
                      <option value="">— Sin toggle —</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 block mb-1">Sobrecargo (S/)</label>
                    <input
                      type="number" min={0} step="0.01"
                      value={pkgForm.trialAddonPricePen}
                      onChange={(e) => setPkgForm({ ...pkgForm, trialAddonPricePen: e.target.value })}
                      placeholder="200"
                      disabled={!pkgForm.trialAddonServiceId}
                      className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* ITEMS */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Servicios incluidos</label>
                  <button type="button" onClick={addItem} className="text-xs font-semibold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>
                <div className="space-y-2">
                  {pkgForm.items.length === 0 && (
                    <p className="text-xs text-gray-400 italic">Agrega los servicios que incluye este paquete.</p>
                  )}
                  {pkgForm.items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
                      <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                      <input
                        type="text"
                        value={it.label}
                        onChange={(e) => updateItem(idx, { label: e.target.value })}
                        placeholder="Maquillaje, Peinado, Manicura en gel…"
                        className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                      />
                      <select
                        value={it.serviceId || ''}
                        onChange={(e) => updateItem(idx, { serviceId: e.target.value || null })}
                        className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs max-w-[140px]"
                        title="Servicio del catálogo (para reservas)"
                      >
                        <option value="">— Servicio —</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-14 px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-center"
                        title="Cantidad"
                      />
                      <button type="button" onClick={() => moveItem(idx, -1)} className="p-1 text-gray-400 hover:text-gray-700" disabled={idx === 0}>
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => moveItem(idx, 1)} className="p-1 text-gray-400 hover:text-gray-700" disabled={idx === pkgForm.items.length - 1}>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => removeItem(idx)} className="p-1 text-red-500 hover:text-red-700">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pkgForm.highlighted} onChange={(e) => setPkgForm({ ...pkgForm, highlighted: e.target.checked })} className="w-4 h-4 rounded text-amber-500" />
                  <span className="text-sm font-medium flex items-center gap-1.5"><Star className="w-4 h-4" /> Recomendado</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pkgForm.isActive} onChange={(e) => setPkgForm({ ...pkgForm, isActive: e.target.checked })} className="w-4 h-4 rounded text-amber-500" />
                  <span className="text-sm font-medium">Activo</span>
                </label>
              </div>

              {/* Adelanto */}
              <div className="rounded-xl border border-pink-100 bg-pink-50/40 p-3">
                <label className="inline-flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={pkgForm.requiresDeposit} onChange={(e) => setPkgForm({ ...pkgForm, requiresDeposit: e.target.checked })} className="w-4 h-4 rounded text-pink-500" />
                  <span className="text-sm font-medium">Requiere adelanto al reservar</span>
                </label>
                {pkgForm.requiresDeposit && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">% de adelanto</label>
                    <input type="number" min={0} max={100} value={pkgForm.depositPercent}
                      onChange={(e) => setPkgForm({ ...pkgForm, depositPercent: Math.min(100, Math.max(0, Number(e.target.value))) })}
                      className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    <span className="text-xs text-gray-400">% (por defecto 50%)</span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
              <button type="button" onClick={() => setPkgModal(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100">Cancelar</button>
              <button type="button" onClick={savePkg} disabled={pkgSaving || !pkgForm.name}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: accent }}>
                <Save className="w-4 h-4" />{pkgSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ADDON ─────────────────────────────────────── */}
      {addonModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4" onClick={() => setAddonModal(null)}>
          <div className="bg-white w-full md:max-w-xl rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-lg">{editingAddon ? 'Editar add-on' : 'Nuevo add-on'}</h3>
              <button onClick={() => setAddonModal(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-[80px_1fr] gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Icono</label>
                  <input type="text" value={addonForm.icon} onChange={(e) => setAddonForm({ ...addonForm, icon: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-center text-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Nombre *</label>
                  <input type="text" value={addonForm.name} onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })} placeholder="Maquillaje con Aerógrafo HD" className="w-full px-3 py-2 rounded-xl border border-gray-200" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Descripción</label>
                <textarea value={addonForm.description} onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-xl border border-gray-200 resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Precio adicional (S/) *</label>
                <input type="number" min={0} step="0.01" value={addonForm.pricePen} onChange={(e) => setAddonForm({ ...addonForm, pricePen: e.target.value })} placeholder="150" className="w-full px-3 py-2 rounded-xl border border-gray-200" />
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={addonForm.isActive} onChange={(e) => setAddonForm({ ...addonForm, isActive: e.target.checked })} className="w-4 h-4 rounded text-amber-500" />
                <span className="text-sm font-medium">Activo</span>
              </label>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setAddonModal(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100">Cancelar</button>
              <button onClick={saveAddon} disabled={addonSaving || !addonForm.name} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: accent }}>
                <Save className="w-4 h-4" />{addonSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL BENEFIT ───────────────────────────────────── */}
      {benefitModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4" onClick={() => setBenefitModal(null)}>
          <div className="bg-white w-full md:max-w-xl rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-lg">{editingBenefit ? 'Editar ventaja' : 'Nueva ventaja'}</h3>
              <button onClick={() => setBenefitModal(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-[80px_1fr] gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Icono</label>
                  <input type="text" value={benefitForm.icon} onChange={(e) => setBenefitForm({ ...benefitForm, icon: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-center text-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Título *</label>
                  <input type="text" value={benefitForm.title} onChange={(e) => setBenefitForm({ ...benefitForm, title: e.target.value })} placeholder="Acabado perfecto" className="w-full px-3 py-2 rounded-xl border border-gray-200" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Descripción</label>
                <textarea value={benefitForm.description} onChange={(e) => setBenefitForm({ ...benefitForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-xl border border-gray-200 resize-none" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setBenefitModal(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100">Cancelar</button>
              <button onClick={saveBenefit} disabled={benefitSaving || !benefitForm.title} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: accent }}>
                <Save className="w-4 h-4" />{benefitSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
