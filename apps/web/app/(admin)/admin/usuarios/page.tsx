'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import {
  ChevronLeft, UserCog, Plus, Pencil, Trash2, X, Check,
  ToggleLeft, ToggleRight, Shield, Scissors, User,
} from 'lucide-react';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  staffId: string | null;
  isActive: boolean;
  createdAt: string;
};
type StaffMember = { id: string; name: string };
type ModalMode = 'create' | 'edit' | null;

const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', bg: 'bg-purple-100 text-purple-700', icon: Shield },
  admin:       { label: 'Admin',       bg: 'bg-blue-100 text-blue-700',    icon: User     },
  estilista:   { label: 'Estilista',   bg: 'bg-amber-100 text-gold-600',    icon: Scissors },
};

const EMPTY_FORM = { name: '', email: '', password: '', role: 'admin', staffId: '', isActive: true };

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('admin_token') || '' : ''; }
function getAdminRole() {
  try { return JSON.parse(atob(getToken().split('.')[1])).role || ''; } catch { return ''; }
}

export default function AdminUsuariosPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (tk: string) => {
    try {
      const data = await adminApi(tk).users.list();
      setUsers(data as AdminUser[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('403')) router.push('/admin');
      if (msg.includes('401')) { localStorage.removeItem('admin_token'); router.push('/admin/login'); }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const tk = getToken();
    const role = getAdminRole();
    if (!tk) { router.push('/admin/login'); return; }
    if (role !== 'super_admin') { router.push('/admin'); return; }
    setToken(tk);
    load(tk);
    adminApi(tk).staff.list().then(d => setStaffList(d as StaffMember[])).catch(() => {});
  }, [router, load]);

  function openCreate() { setForm(EMPTY_FORM); setModalError(''); setModal('create'); }
  function openEdit(u: AdminUser) {
    setSelected(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, staffId: u.staffId || '', isActive: u.isActive });
    setModalError(''); setModal('edit');
  }
  function closeModal() { setModal(null); setSelected(null); setModalError(''); }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) { setModalError('Nombre y email son obligatorios'); return; }
    if (modal === 'create' && !form.password.trim()) { setModalError('La contraseña es obligatoria'); return; }
    setSaving(true); setModalError('');
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        staffId: form.role === 'estilista' ? form.staffId || undefined : undefined,
        isActive: form.isActive,
        ...(form.password ? { password: form.password } : {}),
      };
      if (modal === 'create') {
        await adminApi(token).users.create(payload);
      } else if (selected) {
        await adminApi(token).users.update(selected.id, payload);
      }
      closeModal();
      await load(token);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Error al guardar');
    } finally { setSaving(false); }
  }

  async function handleToggleActive(u: AdminUser) {
    try {
      await adminApi(token).users.update(u.id, { isActive: !u.isActive });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !u.isActive } : x));
    } catch { /* */ }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi(token).users.delete(deleteTarget.id);
      setUsers(prev => prev.filter(x => x.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    } finally { setDeleting(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin" className="text-gray-500 hover:text-gold-600 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <UserCog className="w-5 h-5 text-gold-600" />
          <h1 className="font-display font-bold text-2xl text-gray-900 flex-1">Usuarios del sistema</h1>
          <span className="text-sm text-gray-400">{users.length} usuarios</span>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gold-400 hover:bg-gold-500 text-gray-900 text-sm font-semibold rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Nuevo usuario
          </button>
        </div>

        {/* Role explanation */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {(Object.entries(ROLE_CONFIG) as [string, typeof ROLE_CONFIG.admin][]).map(([role, cfg]) => (
            <div key={role} className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold mb-1 ${cfg.bg}`}>
                <cfg.icon className="w-3 h-3" /> {cfg.label}
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                {role === 'super_admin' && 'Control total. Crea y gestiona usuarios y roles.'}
                {role === 'admin' && 'Gestión completa del salón, sin gestión de usuarios.'}
                {role === 'estilista' && 'Solo ve su propio calendario, citas y horarios.'}
              </p>
            </div>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse border border-gray-100" />)}</div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <UserCog className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">No hay usuarios registrados</p>
            <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gold-400 text-gray-900 text-sm rounded-xl font-medium hover:bg-gold-500">
              <Plus className="w-4 h-4" /> Crear primer usuario
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {users.map((u, i) => {
              const cfg = ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG] || { label: u.role, bg: 'bg-gray-100 text-gray-500', icon: User };
              const linkedStaff = staffList.find(s => s.id === u.staffId);
              return (
                <div key={u.id}
                  className={`flex items-center gap-4 px-4 py-4 ${i < users.length - 1 ? 'border-b border-gray-100' : ''} ${!u.isActive ? 'opacity-50' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm text-white ${u.isActive ? 'bg-gradient-to-br from-gold-400 to-gold-500' : 'bg-gray-300'}`}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-900">{u.name}</p>
                      {!u.isActive && <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inactivo</span>}
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${cfg.bg}`}>
                        <cfg.icon className="w-2.5 h-2.5" /> {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    {linkedStaff && <p className="text-[11px] text-purple-600">✂ Vinculada: {linkedStaff.name}</p>}
                  </div>
                  {/* Date */}
                  <div className="hidden sm:block text-right shrink-0">
                    <p className="text-xs text-gray-400">Creado</p>
                    <p className="text-xs font-semibold text-gray-600">
                      {new Date(u.createdAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </p>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(u)} title="Editar"
                      className="p-2 rounded-lg text-gray-400 hover:text-gold-600 hover:bg-amber-50 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleToggleActive(u)} title={u.isActive ? 'Desactivar' : 'Activar'}
                      className={`p-2 rounded-lg transition-colors ${u.isActive ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                      {u.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setDeleteTarget(u)} title="Eliminar"
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{modal === 'create' ? 'Nuevo usuario' : 'Editar usuario'}</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre *</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre completo"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@ejemplo.com"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {modal === 'edit' ? 'Contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}
                </label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Rol</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400 bg-white">
                  <option value="admin">Admin</option>
                  <option value="estilista">Estilista</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  {form.role === 'super_admin' && 'Control total del sistema, incluyendo gestión de usuarios.'}
                  {form.role === 'admin' && 'Gestión completa del salón. No puede crear usuarios.'}
                  {form.role === 'estilista' && 'Solo accede a su calendario, citas y horarios propios.'}
                </p>
              </div>

              {form.role === 'estilista' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Vincular a estilista del sistema</label>
                  <select value={form.staffId} onChange={e => setForm(f => ({ ...f, staffId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400 bg-white">
                    <option value="">Sin vincular</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">Vincula este usuario a un perfil de estilista para que vea sus citas.</p>
                </div>
              )}

              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{modalError}</div>
              )}
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
              <button onClick={closeModal} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-gold-400 hover:bg-gold-500 text-gray-900 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {saving ? 'Guardando...' : <><Check className="w-4 h-4" /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="font-bold text-gray-900 mb-2">¿Eliminar usuario?</h2>
            <p className="text-sm text-gray-500">Se eliminará <strong>{deleteTarget.name}</strong> permanentemente.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors">
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
