'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import Pagination from '@/components/ui/Pagination';
import {
  ChevronLeft, Users, Search, Plus, Pencil, Trash2,
  ToggleLeft, ToggleRight, X, Check, Phone, Mail, Calendar, ShoppingBag, MapPin,
} from 'lucide-react';
import { LIMA_DISTRICTS } from '@/lib/districts';

const PAGE_SIZE = 25;

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  district: string | null;
  reference: string | null;
  isActive: boolean;
  loyaltyPoints: number;
  createdAt: string;
  _count: { appointments: number; orders: number };
};

type ModalMode = 'create' | 'edit' | null;

const EMPTY_FORM = { name: '', email: '', phone: '', address: '', district: '', reference: '' };

export default function AdminClientesPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [token, setToken]         = useState('');
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]         = useState(0);

  // Modal state
  const [modal, setModal]       = useState<ModalMode>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [modalError, setModalError] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const load = useCallback(async (tk: string, q?: string, pageArg = 1) => {
    try {
      const data = await adminApi(tk).customers.listPaged({ page: pageArg, pageSize: PAGE_SIZE, search: q || undefined });
      setCustomers(data.items as Customer[]);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('401') || msg.includes('token')) {
        localStorage.removeItem('admin_token');
        router.push('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const tk = localStorage.getItem('admin_token') || '';
    if (!tk) { router.push('/admin/login'); return; }
    setToken(tk);
  }, [router]);

  // Reinicia a la página 1 al cambiar la búsqueda.
  useEffect(() => { setPage(1); }, [search]);

  // Carga con debounce (búsqueda) y al cambiar de página.
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => load(token, search || undefined, page), 350);
    return () => clearTimeout(t);
  }, [search, token, page, load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setModalError('');
    setModal('create');
  }

  function openEdit(c: Customer) {
    setSelected(c);
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '', district: c.district || '', reference: c.reference || '' });
    setModalError('');
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setSelected(null);
    setModalError('');
  }

  async function handleSave() {
    if (!form.name.trim()) { setModalError('El nombre es obligatorio'); return; }
    setSaving(true);
    setModalError('');
    try {
      const addressData = {
        address: form.address.trim() || null,
        district: form.district || null,
        reference: form.reference.trim() || null,
      };
      if (modal === 'create') {
        await adminApi(token).customers.create({ name: form.name.trim(), email: form.email || undefined, phone: form.phone || undefined, ...addressData });
      } else if (modal === 'edit' && selected) {
        await adminApi(token).customers.update(selected.id, { name: form.name.trim(), email: form.email || undefined, phone: form.phone || undefined, ...addressData });
      }
      closeModal();
      await load(token, search || undefined, page);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(c: Customer) {
    try {
      await adminApi(token).customers.update(c.id, { isActive: !c.isActive });
      setCustomers(prev => prev.map(x => x.id === c.id ? { ...x, isActive: !c.isActive } : x));
    } catch {
      // silently fail — will re-load next cycle
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi(token).customers.delete(deleteTarget.id);
      setCustomers(prev => prev.filter(x => x.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin" className="text-gray-500 hover:text-primary-600">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display font-bold text-2xl text-gray-900">Clientes</h1>
          <span className="ml-auto text-sm text-gray-500">{total} registrados</span>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo cliente
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">{search ? 'Sin resultados' : 'No hay clientes registrados'}</p>
            {!search && (
              <button onClick={openCreate}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-500 transition-colors">
                <Plus className="w-4 h-4" /> Registrar primer cliente
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {customers.map((c, i) => (
              <div key={c.id}
                className={`flex items-center gap-4 px-4 py-4 ${i < customers.length - 1 ? 'border-b border-gray-100' : ''} ${!c.isActive ? 'opacity-50' : ''}`}>

                {/* Avatar */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm text-white"
                  style={{ background: c.isActive ? 'linear-gradient(135deg,#FF4FA2,#e6368a)' : '#9ca3af' }}>
                  {(c.name || '?').charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-gray-900 truncate">{c.name || 'Sin nombre'}</p>
                    {!c.isActive && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {c.email && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Mail className="w-3 h-3" />{c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Phone className="w-3 h-3" />{c.phone}
                      </span>
                    )}
                    {(c.address || c.district) && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <MapPin className="w-3 h-3" />
                        {[c.address, c.district].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-4 shrink-0 text-right">
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-xs text-gray-500 justify-center">
                      <Calendar className="w-3 h-3" />
                      <span className="font-semibold text-gray-700">{c._count?.appointments ?? 0}</span>
                    </div>
                    <p className="text-xs text-gray-400">citas</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-xs text-gray-500 justify-center">
                      <ShoppingBag className="w-3 h-3" />
                      <span className="font-semibold text-gray-700">{c._count?.orders ?? 0}</span>
                    </div>
                    <p className="text-xs text-gray-400">pedidos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-gray-700">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                    </p>
                    <p className="text-xs text-gray-400">registro</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(c)}
                    className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleToggleActive(c)}
                    className={`p-2 rounded-lg transition-colors ${c.isActive ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                    title={c.isActive ? 'Desactivar cliente' : 'Activar cliente'}>
                    {c.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setDeleteTarget(c)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && customers.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={setPage}
            className="mt-5"
          />
        )}
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{modal === 'create' ? 'Nuevo cliente' : 'Editar cliente'}</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nombre completo"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="987654321"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Dirección
                </label>
                <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Av. / Calle, número"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Distrito</label>
                  <select value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">—</option>
                    {LIMA_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                  <input type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                    placeholder="Piso, interior…"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{modalError}</div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? 'Guardando...' : <><Check className="w-4 h-4" /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="font-bold text-gray-900 mb-2">¿Eliminar cliente?</h2>
              <p className="text-sm text-gray-500 mb-1">
                Se eliminará <strong>{deleteTarget.name}</strong> permanentemente.
              </p>
              {(deleteTarget._count?.appointments ?? 0) > 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                  Tiene {deleteTarget._count.appointments} cita(s). Considera desactivarlo en su lugar.
                </p>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
