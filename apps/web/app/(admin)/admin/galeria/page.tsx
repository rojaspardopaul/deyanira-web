'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Plus, Trash2, X, Save, Eye, EyeOff } from 'lucide-react';

type GalleryItem = Record<string, unknown>;

const CATEGORIES = ['maquillaje', 'cabello', 'unas', 'cejas', 'general'];
const EMPTY = { imageUrl: '', caption: '', category: 'general', isPublished: true };

export default function AdminGaleriaPage() {
  const router = useRouter();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (token: string) => {
    const data = await adminApi(token).gallery.list().catch(() => []);
    setItems(data as GalleryItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/admin/login'); return; }
    load(token);
  }, [router, load]);

  async function handleSave() {
    if (!form.imageUrl.trim()) { setError('La URL de imagen es obligatoria'); return; }
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setSaving(true); setError('');
    try {
      await adminApi(token).gallery.upload({
        imageUrl: form.imageUrl.trim(),
        caption: form.caption.trim(),
        category: form.category,
        isPublished: form.isPublished,
      });
      await load(token);
      setModal(false);
      setForm(EMPTY);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(item: GalleryItem) {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    try {
      await adminApi(token).gallery.update(item.id as string, { isPublished: !item.isPublished });
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isPublished: !item.isPublished } : i));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta foto de la galería?')) return;
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    try {
      await adminApi(token).gallery.delete(id);
      setItems((prev) => prev.filter(i => i.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin" className="text-gray-500 hover:text-primary-600"><ChevronLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold text-2xl text-gray-900">Galería</h1>
          <button onClick={() => { setForm(EMPTY); setError(''); setModal(true); }}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-semibold rounded-xl text-sm hover:bg-primary-500 transition-colors">
            <Plus className="w-4 h-4" /> Agregar foto
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square bg-white rounded-2xl animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <p className="text-5xl mb-3">📸</p>
            <p className="text-gray-400 mb-4">No hay fotos en la galería</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((item) => (
              <div key={item.id as string} className={`relative group rounded-2xl overflow-hidden bg-gray-100 aspect-square ${!item.isPublished ? 'opacity-50' : ''}`}>
                <Image
                  src={item.imageUrl as string}
                  alt={(item.caption as string) || 'Foto'}
                  fill
                  className="object-cover"
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => togglePublished(item)}
                    className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors"
                    title={item.isPublished ? 'Ocultar' : 'Publicar'}
                  >
                    {item.isPublished
                      ? <EyeOff className="w-4 h-4 text-gray-700" />
                      : <Eye className="w-4 h-4 text-gray-700" />
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(item.id as string)}
                    className="w-9 h-9 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
                {/* Category badge */}
                <span className="absolute bottom-2 left-2 text-[10px] font-semibold bg-black/50 text-white px-2 py-0.5 rounded-full">
                  {item.category as string}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal agregar foto */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-display font-bold text-lg">Agregar foto</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">URL de la imagen (Cloudinary) *</label>
                <input type="url" value={form.imageUrl} onChange={set('imageUrl')} placeholder="https://res.cloudinary.com/..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción (opcional)</label>
                <input type="text" value={form.caption} onChange={set('caption')} placeholder="Ej: Maquillaje de novia"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Categoría</label>
                <select value={form.category} onChange={set('category')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm(f => ({ ...f, isPublished: e.target.checked }))}
                  className="w-4 h-4 accent-primary-600" />
                <span className="text-sm font-medium text-gray-700">Publicar inmediatamente</span>
              </label>
              {form.imageUrl && (
                <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden relative">
                  <Image src={form.imageUrl} alt="Preview" fill className="object-cover" onError={() => {}} />
                </div>
              )}
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
