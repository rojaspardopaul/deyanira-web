'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { ChevronLeft, Plus, Pencil, Trash2, X, Save, Clock, Users, Tag, Scissors } from 'lucide-react';
import { ConfirmModal, type ConfirmDialogConfig } from '@/components/ui/ConfirmModal';
import { Toast, type ToastState } from '@/components/ui/Toast';
import { ImageUploader } from '@/components/ui/ImageUploader';
import ServiceModifiersBuilder from '@/components/admin/ServiceModifiersBuilder';
import type { ModifierGroup } from '@/lib/pricing';

type Svc = Record<string, unknown>;
type Cat = Record<string, unknown>;
type StaffItem = { id: string; name: string };

const EMPTY_SVC = {
  name: '', description: '', pricePen: '', comparePricePen: '', duration: '60',
  isActive: true, categoryId: '',
  parallelGroup: '', daysBeforeMain: '',
  longDescriptionMd: '', recommendationMd: '', scheduleInfoMd: '',
  catalogSlug: '', imageUrl: '',
  // IDs de otros servicios con los que este se puede hacer en paralelo.
  // El backend sincroniza el `parallelGroup` para mantener al grupo consistente.
  parallelWithIds: [] as string[],
};
const EMPTY_CAT = { name: '', icon: '✨' };
const ICON_OPTIONS = ['💄', '💇', '💅', '✨', '🌟', '💆', '🦋', '👄', '💋', '🌸', '🎨', '🧖', '💈', '👁️', '🪮', '🌺'];

const LUCIDE_TO_EMOJI: Record<string, string> = {
  Scissors: '✂️', Wand2: '✨', Wand: '✨', Sparkles: '✨', Star: '⭐',
  Heart: '❤️', Flower: '🌸', Brush: '🖌️', Palette: '🎨', Gem: '💎',
  Smile: '😊', Sun: '☀️', Moon: '🌙', Zap: '⚡', Crown: '👑',
  Feather: '🪶', Eye: '👁️', Layers: '🗂️', Grid: '⊞', Circle: '⭕',
};

function safeCatIcon(icon: string | null | undefined): string {
  if (!icon) return '✨';
  if (/^[A-Z][A-Za-z0-9]+$/.test(icon)) return LUCIDE_TO_EMOJI[icon] ?? '✨';
  return icon;
}

function slugify(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function AdminServiciosPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'services' | 'categories'>('services');
  const [loading, setLoading] = useState(true);

  const [services, setServices] = useState<Svc[]>([]);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [allStaff, setAllStaff] = useState<StaffItem[]>([]);
  const [catalogs, setCatalogs] = useState<Array<{ id: string; slug: string; name: string }>>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig | null>(null);

  // Service modal (only service details — staff assigned inline in the table)
  const [svcModal, setSvcModal] = useState<'create' | 'edit' | null>(null);
  const [editingSvc, setEditingSvc] = useState<Svc | null>(null);
  const [svcForm, setSvcForm] = useState(EMPTY_SVC);
  const [svcSaving, setSvcSaving] = useState(false);
  const [svcError, setSvcError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [filterCatId, setFilterCatId] = useState<string>('');

  // Category modal
  const [catModal, setCatModal] = useState<'create' | 'edit' | null>(null);
  const [editingCat, setEditingCat] = useState<Cat | null>(null);
  const [catForm, setCatForm] = useState(EMPTY_CAT);
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState('');

  // Tracks which service is currently saving its staff (for loading state on chips)
  const [staffSaving, setStaffSaving] = useState<string | null>(null);

  // Búsqueda dentro del multi-select de servicios paralelos
  const [parallelSearch, setParallelSearch] = useState('');

  const load = useCallback(async (token: string) => {
    const [svcs, cats, staff, cats2] = await Promise.all([
      adminApi(token).services.list().catch(() => []),
      adminApi(token).serviceCategories.list().catch(() => []),
      adminApi(token).staff.list().catch(() => []),
      adminApi(token).catalogs.list().catch(() => []),
    ]);
    setServices(svcs as Svc[]);
    setCategories(cats as Cat[]);
    setAllStaff(
      (staff as Svc[]).filter(s => s.isActive).map(s => ({ id: s.id as string, name: s.name as string }))
    );
    setCatalogs((cats2 as Array<{ id: string; slug: string; name: string }>).map(c => ({ id: c.id, slug: c.slug, name: c.name })));
    setLoading(false);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/admin/login'); return; }
    load(token);
  }, [router, load]);

  // ── Inline staff toggle ──────────────────────────────────────
  async function toggleStaffInline(svcId: string, staffId: string, currentIds: string[]) {
    const newIds = currentIds.includes(staffId)
      ? currentIds.filter(id => id !== staffId)
      : [...currentIds, staffId];

    // Optimistic update
    setServices(prev => prev.map(s => {
      if (s.id !== svcId) return s;
      return {
        ...s,
        staffServices: newIds.map(id => ({
          staff: allStaff.find(st => st.id === id) ?? { id, name: '' },
        })),
      };
    }));

    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setStaffSaving(svcId);
    try {
      await adminApi(token).services.setStaff(svcId, newIds);
    } catch (e) {
      await load(token); // revert on error
      alert(e instanceof Error ? e.message : 'Error al asignar estilista');
    } finally {
      setStaffSaving(null);
    }
  }

  // ── Service modal helpers ────────────────────────────────────
  function openCreateSvc() {
    setSvcForm(EMPTY_SVC);
    setEditingSvc(null);
    setSvcError('');
    setParallelSearch('');
    setSvcModal('create');
  }

  function openEditSvc(s: Svc) {
    const grp = (s.parallelGroup as string) || '';
    // Otros servicios que comparten el mismo parallelGroup que `s`
    const parallelWithIds = grp
      ? services
          .filter((x) => x.id !== s.id && (x.parallelGroup as string) === grp)
          .map((x) => x.id as string)
      : [];
    setSvcForm({
      name: s.name as string || '',
      description: s.description as string || '',
      pricePen: String(s.pricePen || ''),
      comparePricePen: s.comparePricePen != null ? String(s.comparePricePen) : '',
      duration: String(s.duration || '60'),
      isActive: s.isActive as boolean ?? true,
      categoryId: s.categoryId as string || '',
      parallelGroup: grp,
      daysBeforeMain: s.daysBeforeMain != null ? String(s.daysBeforeMain) : '',
      longDescriptionMd: (s.longDescriptionMd as string) || '',
      recommendationMd: (s.recommendationMd as string) || '',
      scheduleInfoMd: (s.scheduleInfoMd as string) || '',
      catalogSlug: (s.catalogSlug as string) || '',
      imageUrl: (s.imageUrl as string) || '',
      parallelWithIds,
    });
    setEditingSvc(s);
    setSvcError('');
    setParallelSearch('');
    setSvcModal('edit');
  }

  async function saveSvc() {
    if (!svcForm.name.trim() || !svcForm.pricePen || !svcForm.duration) {
      setSvcError('Nombre, precio y duración son obligatorios'); return;
    }
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setSvcSaving(true); setSvcError('');
    const slug = slugify(svcForm.name.trim());
    // El campo parallelGroup se sincroniza desde el endpoint dedicado /parallel-with
    // (no se envía directamente desde el form para no romper la consistencia del grupo).
    const body = {
      name: svcForm.name.trim(), slug,
      description: svcForm.description.trim() || null,
      pricePen: parseFloat(svcForm.pricePen),
      comparePricePen: svcForm.comparePricePen ? parseFloat(svcForm.comparePricePen) : null,
      duration: parseInt(svcForm.duration),
      isActive: svcForm.isActive,
      categoryId: svcForm.categoryId || null,
      daysBeforeMain: svcForm.daysBeforeMain ? parseInt(svcForm.daysBeforeMain) : null,
      longDescriptionMd: svcForm.longDescriptionMd.trim() || null,
      recommendationMd: svcForm.recommendationMd.trim() || null,
      scheduleInfoMd: svcForm.scheduleInfoMd.trim() || null,
      catalogSlug: svcForm.catalogSlug.trim() || null,
      imageUrl: svcForm.imageUrl.trim() || null,
    };
    try {
      let svcId: string;
      if (svcModal === 'edit' && editingSvc) {
        await adminApi(token).services.update(editingSvc.id as string, body);
        svcId = editingSvc.id as string;
        setToast({ type: 'success', msg: `Servicio "${svcForm.name}" actualizado` });
      } else {
        const created = await adminApi(token).services.create(body) as { id: string };
        svcId = created.id;
        // New service has no staff yet — will be assigned inline from the table
        await adminApi(token).services.setStaff(created.id, []);
        setToast({ type: 'success', msg: `Servicio "${svcForm.name}" creado` });
      }
      // Sincronizar el grupo paralelo (siempre lo enviamos para reflejar deselecciones)
      await adminApi(token).services.setParallelWith(svcId, svcForm.parallelWithIds);
      await load(token);
      setSvcModal(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      setSvcError(msg);
      setToast({ type: 'error', msg });
    } finally {
      setSvcSaving(false);
    }
  }

  function deleteSvc(id: string) {
    setConfirmDialog({
      title: 'Eliminar servicio',
      message: '¿Eliminar este servicio? Esta acción no se puede deshacer.',
      confirmLabel: 'Sí, eliminar',
      confirmClass: 'bg-red-600 hover:bg-red-500',
      onConfirm: async () => {
        const token = localStorage.getItem('admin_token');
        if (!token) return;
        try {
          await adminApi(token).services.delete(id);
          setServices(prev => prev.filter(s => s.id !== id));
        } catch (e) { alert(e instanceof Error ? e.message : 'Error al eliminar'); }
      },
    });
  }

  // ── Category modal helpers ───────────────────────────────────
  function openCreateCat() {
    setCatForm(EMPTY_CAT);
    setEditingCat(null);
    setCatError('');
    setCatModal('create');
  }

  function openEditCat(c: Cat) {
    setCatForm({ name: c.name as string || '', icon: c.icon as string || '✨' });
    setEditingCat(c);
    setCatError('');
    setCatModal('edit');
  }

  async function saveCat() {
    if (!catForm.name.trim()) { setCatError('El nombre es obligatorio'); return; }
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setCatSaving(true); setCatError('');
    try {
      if (catModal === 'edit' && editingCat) {
        await adminApi(token).serviceCategories.update(editingCat.id as string, catForm);
      } else {
        await adminApi(token).serviceCategories.create({ ...catForm, slug: slugify(catForm.name.trim()) });
      }
      await load(token);
      setCatModal(null);
    } catch (e) {
      setCatError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setCatSaving(false);
    }
  }

  function deleteCat(id: string) {
    setConfirmDialog({
      title: 'Eliminar categoría',
      message: '¿Eliminar esta categoría? Los servicios quedarán sin categoría.',
      confirmLabel: 'Sí, eliminar',
      confirmClass: 'bg-red-600 hover:bg-red-500',
      onConfirm: async () => {
        const token = localStorage.getItem('admin_token');
        if (!token) return;
        try {
          await adminApi(token).serviceCategories.delete(id);
          setCategories(prev => prev.filter(c => c.id !== id));
        } catch (e) { alert(e instanceof Error ? e.message : 'Error al eliminar'); }
      },
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {confirmDialog && <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />}
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin" className="text-gray-500 hover:text-primary-600">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display font-bold text-2xl text-gray-900">Servicios</h1>
          <button
            onClick={tab === 'services' ? openCreateSvc : openCreateCat}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-semibold rounded-xl text-sm hover:bg-primary-500 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {tab === 'services' ? 'Nuevo servicio' : 'Nueva categoría'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-5">
          <button
            onClick={() => setTab('services')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === 'services' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Scissors className="w-4 h-4" /> Servicios
          </button>
          <button
            onClick={() => setTab('categories')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === 'categories' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Tag className="w-4 h-4" /> Categorías
            {categories.length > 0 && (
              <span className="ml-1 text-[10px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                {categories.length}
              </span>
            )}
          </button>
        </div>

        {/* ── SERVICIOS TAB ─────────────────────────────────────── */}
        {tab === 'services' && (
          loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <Scissors className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">No hay servicios creados</p>
              <button onClick={openCreateSvc} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-full text-sm hover:bg-primary-500 transition-colors">
                <Plus className="w-4 h-4" /> Crear primer servicio
              </button>
            </div>
          ) : (
            (() => {
              // Filtros: por nombre y por categoría
              const q = search.trim().toLowerCase();
              const filtered = services.filter(svc => {
                if (filterCatId && (svc.categoryId as string) !== filterCatId) return false;
                if (q && !(svc.name as string).toLowerCase().includes(q)) return false;
                return true;
              });
              // Agrupar por categoría (Sin categoría va al final)
              const byCat = new Map<string, { cat: Cat | null; items: Svc[] }>();
              for (const svc of filtered) {
                const catId = (svc.categoryId as string) || '__none__';
                if (!byCat.has(catId)) {
                  const c = categories.find(c => c.id === catId) || null;
                  byCat.set(catId, { cat: c, items: [] });
                }
                byCat.get(catId)!.items.push(svc);
              }
              // Ordenar grupos: primero las categorías por sortOrder, luego "Sin categoría"
              const groupEntries = Array.from(byCat.entries()).sort(([aId, a], [bId, b]) => {
                if (aId === '__none__') return 1;
                if (bId === '__none__') return -1;
                const ao = Number((a.cat?.sortOrder as number) ?? 0);
                const bo = Number((b.cat?.sortOrder as number) ?? 0);
                return ao - bo;
              });

              return (
                <>
                  {/* Filtros */}
                  <div className="mb-4 flex flex-wrap gap-2 items-center">
                    <div className="relative flex-1 min-w-[180px]">
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar servicio por nombre…"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      />
                      <Scissors className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 text-gray-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <select
                      value={filterCatId}
                      onChange={(e) => setFilterCatId(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                    >
                      <option value="">Todas las categorías</option>
                      {categories.map(c => (
                        <option key={c.id as string} value={c.id as string}>
                          {safeCatIcon(c.icon as string)} {c.name as string}
                        </option>
                      ))}
                      <option value="__none__">Sin categoría</option>
                    </select>
                    {(search || filterCatId) && (
                      <button onClick={() => { setSearch(''); setFilterCatId(''); }}
                        className="text-xs text-gray-500 hover:text-gray-900 underline">
                        Limpiar
                      </button>
                    )}
                    <span className="text-xs text-gray-500 ml-auto">
                      {filtered.length} de {services.length}
                    </span>
                  </div>

                  {filtered.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                      <p className="text-gray-400">No hay servicios que coincidan con los filtros</p>
                    </div>
                  ) : (
                    groupEntries.map(([catId, group]) => (
                      <div key={catId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
                        {/* Header de grupo */}
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                          <span className="text-lg">{safeCatIcon(group.cat?.icon as string)}</span>
                          <p className="font-bold text-sm text-gray-800">
                            {(group.cat?.name as string) || 'Sin categoría'}
                          </p>
                          <span className="text-[10px] font-bold bg-white text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                            {group.items.length}
                          </span>
                        </div>
                        {allStaff.length === 0 && (
                          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 shrink-0" />
                            No hay estilistas activas.{' '}
                            <Link href="/admin/estilistas" className="underline font-semibold">Agregar</Link>
                          </div>
                        )}
                        {(() => {
                          const groupServices = group.items;
                          return groupServices.map((svc, i) => {
                const staffServices = svc.staffServices as Array<{ staff: StaffItem }> || [];
                const assignedIds = staffServices.map(ss => ss.staff.id);
                const cat = svc.category as Cat | null;
                const isSavingStaff = staffSaving === svc.id;

                return (
                  <div
                    key={svc.id as string}
                    className={`px-4 py-4 ${i < services.length - 1 ? 'border-b border-gray-100' : ''} ${!svc.isActive ? 'opacity-55' : ''}`}
                  >
                    {/* Top row: icon + name + price + actions */}
                    <div className="flex items-start gap-3">
                      <span className="text-2xl shrink-0 mt-0.5">{safeCatIcon(cat?.icon as string)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-gray-900 truncate">{svc.name as string}</p>
                            {cat && (
                              <span className="inline-block text-[10px] font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full mt-0.5">
                                {safeCatIcon(cat.icon as string)} {cat.name as string}
                              </span>
                            )}
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-1">
                            <div className="text-right mr-1">
                              <p className="font-black text-primary-600 text-sm">S/ {Number(svc.pricePen).toFixed(0)}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-0.5 justify-end mt-0.5">
                                <Clock className="w-3 h-3" />{svc.duration as number} min
                              </p>
                            </div>
                            <button
                              onClick={() => openEditSvc(svc)}
                              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteSvc(svc.id as string)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Staff chips — all staff shown, click to toggle */}
                        {allStaff.length > 0 && (
                          <div className="mt-2.5">
                            <p className="text-[10px] font-semibold text-gray-400 mb-1.5 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {isSavingStaff ? 'Guardando...' : 'Estilistas — toca para asignar / quitar'}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {allStaff.map(staff => {
                                const assigned = assignedIds.includes(staff.id);
                                return (
                                  <button
                                    key={staff.id}
                                    type="button"
                                    disabled={isSavingStaff}
                                    onClick={() => toggleStaffInline(svc.id as string, staff.id, assignedIds)}
                                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all border-2 active:scale-95 disabled:opacity-60 ${
                                      assigned
                                        ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-primary-400 hover:text-primary-600'
                                    }`}
                                  >
                                    {assigned && <span className="mr-0.5">✓</span>}{staff.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
                        })()}
                      </div>
                    ))
                  )}
                </>
              );
            })()
          )
        )}

        {/* ── CATEGORÍAS TAB ────────────────────────────────────── */}
        {tab === 'categories' && (
          loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <Tag className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">No hay categorías creadas</p>
              <button onClick={openCreateCat} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-full text-sm hover:bg-primary-500 transition-colors">
                <Plus className="w-4 h-4" /> Crear primera categoría
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {categories.map((cat, i) => {
                const count = (cat._count as Record<string, number>)?.services ?? 0;
                return (
                  <div
                    key={cat.id as string}
                    className={`flex items-center gap-4 px-4 py-4 ${i < categories.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <span className="text-2xl shrink-0">{safeCatIcon(cat.icon as string)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900">{cat.name as string}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{count} servicio{count !== 1 ? 's' : ''}</p>
                    </div>
                    {!cat.isActive && (
                      <span className="text-xs text-gray-400 font-medium px-2 py-0.5 bg-gray-100 rounded-full">Inactivo</span>
                    )}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openEditCat(cat)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteCat(cat.id as string)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* ── MODAL: Servicio ──────────────────────────────────────── */}
      {svcModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[95vh] sm:max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-lg text-gray-900">
                {svcModal === 'create' ? 'Nuevo servicio' : 'Editar servicio'}
              </h2>
              <button onClick={() => setSvcModal(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={svcForm.name}
                    onChange={e => setSvcForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: Maquillaje de novia"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción</label>
                  <textarea
                    value={svcForm.description}
                    onChange={e => setSvcForm(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                    placeholder="Descripción breve del servicio..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Precio (S/) *</label>
                  <input
                    type="number"
                    value={svcForm.pricePen}
                    onChange={e => setSvcForm(f => ({ ...f, pricePen: e.target.value }))}
                    min="0"
                    step="0.50"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1" title="Precio anterior (tachado en la web cuando hay oferta)">Antes <span className="text-gray-400 normal-case">opc.</span></label>
                  <input
                    type="number"
                    value={svcForm.comparePricePen}
                    onChange={e => setSvcForm(f => ({ ...f, comparePricePen: e.target.value }))}
                    min="0"
                    step="0.50"
                    placeholder="—"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 line-through focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Duración (min) *</label>
                  <input
                    type="number"
                    value={svcForm.duration}
                    onChange={e => setSvcForm(f => ({ ...f, duration: e.target.value }))}
                    min="15"
                    step="15"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Categoría</label>
                <select
                  value={svcForm.categoryId}
                  onChange={e => setSvcForm(f => ({ ...f, categoryId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Sin categoría</option>
                  {categories.map(c => (
                    <option key={c.id as string} value={c.id as string}>
                      {safeCatIcon(c.icon as string)} {c.name as string}
                    </option>
                  ))}
                </select>
                {categories.length === 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    No hay categorías.{' '}
                    <button type="button" onClick={() => { setSvcModal(null); setTab('categories'); openCreateCat(); }} className="text-primary-600 underline">
                      Crear una
                    </button>
                  </p>
                )}
              </div>

              <ImageUploader
                value={svcForm.imageUrl}
                onChange={(url) => setSvcForm(f => ({ ...f, imageUrl: url || '' }))}
                folder="servicios"
                label="Imagen del servicio (opcional)"
                helpText="Aparece en la lista de servicios y en el catálogo"
                aspect="4/3"
                onError={(msg) => setToast({ type: 'error', msg })}
              />

              {/* ─── Catálogo visual asociado (aplica a individual + paquete) ── */}
              <div className="rounded-xl border border-gray-200 p-3 bg-white">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    Catálogo visual asociado
                  </label>
                  <span
                    className="cursor-help text-xs text-gray-400 hover:text-gray-700"
                    title="Vincula este servicio a un catálogo (ej. 'Peinados', 'Cortes', 'Colores'). El cliente verá un chip 'Ver opciones' que abre un popup con las fotos — tanto al reservar el servicio individual como cuando viene dentro de un paquete."
                  >ⓘ</span>
                </div>
                <select
                  value={svcForm.catalogSlug}
                  onChange={e => setSvcForm(f => ({ ...f, catalogSlug: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"
                >
                  <option value="">— Sin catálogo asociado —</option>
                  {catalogs.map(c => (
                    <option key={c.id} value={c.slug}>{c.name} (/{c.slug})</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  {catalogs.length === 0
                    ? <>Aún no hay catálogos. <Link href="/admin/catalogos" className="text-primary-600 underline">Crear uno</Link></>
                    : 'Visible en /servicios y en el wizard de reserva como popup "Ver opciones".'}
                </p>
              </div>

              {/* ─── Servicios simultáneos (aplica a individual + paquete) ──── */}
              <div className="rounded-xl border border-gray-200 p-3 bg-white">
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    Se puede hacer simultáneo con
                  </label>
                  <span
                    className="cursor-help text-xs text-gray-400 hover:text-gray-700"
                    title="Marca otros servicios que se pueden ejecutar AL MISMO TIEMPO que éste (por personal distinto). El cálculo de horas se aplica tanto cuando un cliente reserva varios servicios sueltos como cuando vienen dentro de un paquete. Si los hace la misma estilista, las duraciones se suman; si son distintas, solo cuenta el más largo del grupo."
                  >ⓘ</span>
                </div>
                <p className="text-[11px] text-gray-500 mb-2.5">
                  Esta relación se configura en cada servicio y vale por igual para reservas individuales y paquetes.
                </p>
                {(() => {
                  const others = services.filter(s => s.id !== editingSvc?.id);
                  const selectedIds = new Set(svcForm.parallelWithIds);
                  const selectedOnes = others.filter(s => selectedIds.has(s.id as string));
                  const q = parallelSearch.trim().toLowerCase();
                  const available = others
                    .filter(s => !selectedIds.has(s.id as string))
                    .filter(s => !q || (s.name as string).toLowerCase().includes(q));

                  if (others.length === 0) {
                    return (
                      <p className="text-[11px] text-gray-400 italic px-1 py-3 border border-dashed border-gray-200 rounded-lg text-center">
                        {editingSvc
                          ? 'No hay otros servicios todavía. Crea más servicios para poder marcarlos como simultáneos.'
                          : 'Primero guarda este servicio. Luego edítalo para marcar paralelos.'}
                      </p>
                    );
                  }

                  return (
                    <>
                      {/* Bloque de seleccionados */}
                      <div className="rounded-lg border border-primary-100 bg-primary-50/40 p-2 mb-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700">
                            En paralelo con ({selectedOnes.length})
                          </span>
                          {selectedOnes.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSvcForm(f => ({ ...f, parallelWithIds: [] }))}
                              className="text-[10px] text-primary-600 hover:text-primary-700 underline"
                            >
                              Quitar todos
                            </button>
                          )}
                        </div>
                        {selectedOnes.length === 0 ? (
                          <p className="text-[11px] text-gray-400 italic px-1 py-1">
                            Aún no marcas ningún servicio. Selecciona abajo.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedOnes.map(s => {
                              const id = s.id as string;
                              const cat = s.category as Cat | null;
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold pl-2 pr-1 py-0.5 rounded-full bg-primary-600 text-white shadow-sm"
                                >
                                  {cat && <span className="text-[10px]">{safeCatIcon(cat.icon as string)}</span>}
                                  {s.name as string}
                                  <button
                                    type="button"
                                    onClick={() => setSvcForm(f => ({
                                      ...f,
                                      parallelWithIds: f.parallelWithIds.filter(x => x !== id),
                                    }))}
                                    className="w-4 h-4 rounded-full hover:bg-white/20 flex items-center justify-center"
                                    aria-label={`Quitar ${s.name}`}
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Búsqueda */}
                      {others.length > 6 && (
                        <div className="relative mb-1.5">
                          <input
                            type="text"
                            value={parallelSearch}
                            onChange={e => setParallelSearch(e.target.value)}
                            placeholder="Buscar servicio…"
                            className="w-full pl-7 pr-7 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                          />
                          <Scissors className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                          {parallelSearch && (
                            <button type="button" onClick={() => setParallelSearch('')}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100 text-gray-400">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Lista disponible */}
                      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 border border-gray-100 rounded-lg bg-gray-50">
                        {available.length === 0 ? (
                          <p className="text-[11px] text-gray-400 italic px-1 py-1">
                            {q ? 'Ningún servicio coincide con la búsqueda.' : 'Todos los servicios ya están seleccionados.'}
                          </p>
                        ) : (
                          available.map(s => {
                            const id = s.id as string;
                            const cat = s.category as Cat | null;
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => setSvcForm(f => ({
                                  ...f,
                                  parallelWithIds: [...f.parallelWithIds, id],
                                }))}
                                className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all border-2 border-gray-200 bg-white text-gray-600 hover:border-primary-400 hover:text-primary-600 active:scale-95 inline-flex items-center gap-1"
                                title={s.description as string || ''}
                              >
                                <Plus className="w-3 h-3" />
                                {cat && <span className="text-[10px]">{safeCatIcon(cat.icon as string)}</span>}
                                {s.name as string}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* ─── Modificadores dinámicos (solo en edición — necesita id del servicio) ─── */}
              {svcModal === 'edit' && editingSvc && (
                <div className="rounded-2xl border-2 border-violet-100 bg-gradient-to-br from-white to-violet-50/30 p-4">
                  <ServiceModifiersBuilder
                    serviceId={editingSvc.id as string}
                    servicePricePen={Number(svcForm.pricePen) || 0}
                    serviceDuration={Number(svcForm.duration) || 0}
                    initialGroups={(editingSvc.modifierGroups as ModifierGroup[] | undefined) || []}
                    onSaved={(groups) => {
                      // Refrescamos editingSvc en memoria para no perder los IDs reales
                      setEditingSvc((prev) => prev ? { ...prev, modifierGroups: groups } : prev);
                      // Y actualizamos la lista principal de servicios
                      setServices((all) =>
                        all.map((s) => (s.id === editingSvc.id ? { ...s, modifierGroups: groups } : s))
                      );
                    }}
                  />
                </div>
              )}
              {svcModal === 'create' && (
                <div className="rounded-xl border border-dashed border-gray-200 p-3 bg-gray-50/40">
                  <p className="text-xs text-gray-500">
                    💡 <strong>Modificadores dinámicos:</strong> después de crear el servicio,
                    podrás configurar opciones como "Largo del cabello", "Aerógrafo", etc.
                    que cambian el precio en tiempo real cuando el cliente reserva.
                  </p>
                </div>
              )}

              {/* ─── Configuración avanzada (sólo para paquetes) ─── */}
              <details className="rounded-xl border border-gray-200 p-3" open={!!(svcForm.daysBeforeMain || svcForm.longDescriptionMd || svcForm.recommendationMd || svcForm.scheduleInfoMd)}>
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-gray-700">
                  Información extendida para paquetes
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="block text-xs font-semibold text-gray-600">Días antes del evento</label>
                      <span
                        className="cursor-help text-xs text-gray-400 hover:text-gray-700"
                        title="Si este servicio se debe hacer ANTES del día principal, pon cuántos días. Ej. 15 = la 'Prueba de maquillaje' se programa 15 días antes de la boda. 1 = manicura/pedicura un día antes. Déjalo vacío o 0 si va el mismo día."
                      >ⓘ</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={svcForm.daysBeforeMain}
                      onChange={e => setSvcForm(f => ({ ...f, daysBeforeMain: e.target.value }))}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">15 = prueba 15 días antes del evento principal</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="block text-xs font-semibold text-gray-600">Descripción larga</label>
                      <span
                        className="cursor-help text-xs text-gray-400 hover:text-gray-700"
                        title="Texto que se muestra en el acordeón '¿En qué consiste?' de la web. Acepta formato: **negrita**, listas con guión -, encabezados con ###. Si no usas formato, se muestra como texto plano normal."
                      >ⓘ</span>
                    </div>
                    <textarea
                      value={svcForm.longDescriptionMd}
                      onChange={e => setSvcForm(f => ({ ...f, longDescriptionMd: e.target.value }))}
                      rows={3}
                      placeholder="Texto explicativo que aparece en el acordeón…"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-900 resize-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="block text-xs font-semibold text-gray-600">Recomendación / tips</label>
                      <span className="cursor-help text-xs text-gray-400 hover:text-gray-700"
                        title="Tips para el cliente (ej. 'lava tu cabello la noche anterior'). Acepta **negrita** y listas con -.">ⓘ</span>
                    </div>
                    <textarea
                      value={svcForm.recommendationMd}
                      onChange={e => setSvcForm(f => ({ ...f, recommendationMd: e.target.value }))}
                      rows={2}
                      placeholder="Tips para el cliente…"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-900 resize-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="block text-xs font-semibold text-gray-600">Por qué se necesita anticipación</label>
                      <span className="cursor-help text-xs text-gray-400 hover:text-gray-700"
                        title="Explicación para el cliente de POR QUÉ este servicio debe hacerse N días antes (ej. 'la prueba de maquillaje nos permite probar tonos antes del día de tu boda'). Solo aplica si pusiste 'Días antes' > 0.">ⓘ</span>
                    </div>
                    <textarea
                      value={svcForm.scheduleInfoMd}
                      onChange={e => setSvcForm(f => ({ ...f, scheduleInfoMd: e.target.value }))}
                      rows={2}
                      placeholder="La prueba de maquillaje nos permite probar tonos y peinado antes del día central…"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-900 resize-none"
                    />
                  </div>
                </div>
              </details>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={svcForm.isActive}
                  onChange={e => setSvcForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-primary-600"
                />
                <span className="text-sm font-medium text-gray-700">Servicio activo (visible para clientes)</span>
              </label>

              {svcError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-100 px-3 py-2 rounded-xl">{svcError}</p>
              )}

              {svcModal === 'create' && (
                <p className="text-[11px] text-gray-400">
                  Después de crear el servicio, asigna las estilistas directamente desde la tabla.
                </p>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button
                onClick={() => setSvcModal(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveSvc}
                disabled={svcSaving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {svcSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Categoría ─────────────────────────────────────── */}
      {catModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-lg text-gray-900">
                {catModal === 'create' ? 'Nueva categoría' : 'Editar categoría'}
              </h2>
              <button onClick={() => setCatModal(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={catForm.name}
                  onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Maquillaje, Cabello, Uñas..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Ícono</label>
                <div className="grid grid-cols-8 gap-1.5 mb-3">
                  {ICON_OPTIONS.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setCatForm(f => ({ ...f, icon }))}
                      className={`h-9 text-xl rounded-xl transition-all flex items-center justify-center ${
                        catForm.icon === icon
                          ? 'bg-primary-100 ring-2 ring-primary-500'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={catForm.icon}
                  onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}
                  placeholder="O escribe / pega cualquier emoji..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-gray-400"
                />
              </div>

              {catForm.name && (
                <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-xl">
                  <span className="text-xl">{safeCatIcon(catForm.icon) || '✨'}</span>
                  <span className="text-sm font-semibold text-gray-800">{catForm.name}</span>
                </div>
              )}

              {catError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-100 px-3 py-2 rounded-xl">{catError}</p>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button
                onClick={() => setCatModal(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveCat}
                disabled={catSaving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {catSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
