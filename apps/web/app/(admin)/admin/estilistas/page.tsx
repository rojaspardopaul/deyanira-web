'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Upload, User, ToggleLeft, ToggleRight } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface Staff {
  id: string;
  name: string;
  role: string | null;
  bio: string | null;
  photoUrl: string | null;
  isActive: boolean;
}

const EMPTY: Omit<Staff, 'id'> = { name: '', role: '', bio: '', photoUrl: null, isActive: true };

export default function EstilistasPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState<Omit<Staff, 'id'>>(EMPTY);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchStaff(); }, []);

  async function fetchStaff() {
    setLoading(true);
    try {
      const data = await adminApi().staff.list();
      setStaff(data as Staff[]);
    } catch { /* empty */ } finally { setLoading(false); }
  }

  function openCreate() {
    setForm(EMPTY); setPhotoPreview(null); setPhotoBase64(null);
    setError(''); setModal('create');
  }

  function openEdit(s: Staff) {
    setEditing(s);
    setForm({ name: s.name, role: s.role || '', bio: s.bio || '', photoUrl: s.photoUrl, isActive: s.isActive });
    setPhotoPreview(s.photoUrl);
    setPhotoBase64(null);
    setError(''); setModal('edit');
  }

  function closeModal() { setModal(null); setEditing(null); setError(''); }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('La foto debe ser menor a 5MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      setPhotoPreview(b64);
      setPhotoBase64(b64);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('El nombre es requerido'); return; }
    setSaving(true); setError('');
    try {
      let photoUrl = form.photoUrl;
      if (photoBase64) {
        const uploaded = await adminApi().upload(photoBase64, 'staff') as { url: string };
        photoUrl = uploaded.url;
      }
      const body = { ...form, photoUrl, name: form.name.trim() };

      if (modal === 'edit' && editing) {
        await adminApi().staff.update(editing.id, body);
      } else {
        await adminApi().staff.create(body);
      }
      await fetchStaff();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally { setSaving(false); }
  }

  async function handleToggle(s: Staff) {
    await adminApi().staff.update(s.id, { isActive: !s.isActive });
    fetchStaff();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await adminApi().staff.delete(deleteId);
    setDeleteId(null);
    fetchStaff();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Estilistas</h1>
            <p className="text-gray-500 text-sm mt-1">Gestiona el equipo del salón</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors">
            <Plus className="w-4 h-4" /> Nueva estilista
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-52 animate-pulse" />)}
          </div>
        ) : staff.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay estilistas registradas</p>
            <button onClick={openCreate} className="mt-3 text-primary-600 text-sm hover:underline">
              Agregar la primera
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {staff.map((s) => (
              <div key={s.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${!s.isActive ? 'opacity-60' : ''}`}>
                <div className="h-40 bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center relative">
                  {s.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.photoUrl} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-20 h-20 bg-primary-200 rounded-full flex items-center justify-center">
                      <span className="text-3xl font-bold text-primary-700">{s.name.charAt(0)}</span>
                    </div>
                  )}
                  {!s.isActive && (
                    <span className="absolute top-2 right-2 bg-gray-700 text-white text-xs px-2 py-0.5 rounded-full">
                      Inactiva
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-900">{s.name}</h3>
                  {s.role && <p className="text-sm text-gray-500">{s.role}</p>}
                  {s.bio && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{s.bio}</p>}
                  <div className="flex items-center gap-2 mt-4">
                    <button onClick={() => openEdit(s)} className="flex-1 flex items-center justify-center gap-1.5 text-sm border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition-colors">
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button onClick={() => handleToggle(s)} className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors" title={s.isActive ? 'Desactivar' : 'Activar'}>
                      {s.isActive ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button onClick={() => setDeleteId(s.id)} className="p-2 border border-red-100 rounded-xl hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-lg">{modal === 'create' ? 'Nueva estilista' : 'Editar estilista'}</h2>
              <button onClick={closeModal}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary-400 transition-colors bg-gray-50"
                  onClick={() => fileRef.current?.click()}
                >
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <button onClick={() => fileRef.current?.click()} className="text-xs text-primary-600 hover:underline">
                  {photoPreview ? 'Cambiar foto' : 'Subir foto'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Nombre completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" placeholder="Ej: María García"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cargo / Especialidad</label>
                <input
                  type="text" placeholder="Ej: Maquilladora profesional"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  value={form.role || ''}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Descripción / Bio</label>
                <textarea
                  rows={3} placeholder="Breve descripción de experiencia y especialidades..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                  value={form.bio || ''}
                  onChange={e => setForm({ ...form, bio: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`w-11 h-6 rounded-full transition-colors ${form.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow m-0.5 transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {form.isActive ? 'Activa' : 'Inactiva'}
                </span>
              </label>

              {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-xl">{error}</p>}
            </div>
            <div className="p-5 border-t flex gap-3">
              <button onClick={closeModal} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-primary-600 hover:bg-primary-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="font-bold text-lg mb-2">¿Eliminar estilista?</h3>
            <p className="text-gray-500 text-sm mb-6">Esta acción no se puede deshacer. Se eliminarán también sus horarios.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
