'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Plus, Pencil, Trash2, X, Save, Upload, Star, Loader2 } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import { confirmAction } from '@/lib/confirm';
import { HL, Danger } from '@/components/ui/highlight';

const PAGE_SIZE = 24;
const IMG_MAX = 8 * 1024 * 1024; // 8 MB

type Product = Record<string, unknown>;

const EMPTY = {
  name: '', description: '', pricePen: '', comparePrice: '', stock: '', brand: '',
  images: [] as string[], isActive: true, categoryId: '',
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target?.result as string);
    r.onerror = () => rej(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });
}

export default function AdminProductosPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (token: string, pageArg = 1) => {
    const [prods, cats] = await Promise.all([
      adminApi(token).products.listPaged({ page: pageArg, pageSize: PAGE_SIZE }).catch(() => null),
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/products/categories`).then(r => r.json()).catch(() => []),
    ]);
    if (prods) {
      setProducts(prods.items as Product[]);
      setTotalPages(prods.totalPages);
      setTotal(prods.total);
    } else {
      setProducts([]); setTotalPages(1); setTotal(0);
    }
    setCategories(cats as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/admin/login'); return; }
    load(token, page);
  }, [router, load, page]);

  function openCreate() {
    setForm(EMPTY); setEditing(null); setError(''); setModal('create');
  }

  function openEdit(p: Product) {
    setForm({
      name: p.name as string || '',
      description: p.description as string || '',
      pricePen: String(p.pricePen || ''),
      comparePrice: String(p.comparePrice || ''),
      stock: String(p.stock || ''),
      brand: p.brand as string || '',
      images: (p.images as string[]) || [],
      isActive: p.isActive as boolean ?? true,
      categoryId: p.categoryId as string || '',
    });
    setEditing(p); setError(''); setModal('edit');
  }

  async function handleSave() {
    if (!form.name.trim() || !form.pricePen) { setError('Nombre y precio son obligatorios'); return; }
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setSaving(true); setError('');
    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      pricePen: parseFloat(form.pricePen),
      comparePrice: form.comparePrice ? parseFloat(form.comparePrice) : null,
      stock: parseInt(form.stock) || 0,
      brand: form.brand.trim(),
      images: form.images.filter(Boolean),
      isActive: form.isActive,
      categoryId: form.categoryId || null,
    };
    try {
      if (modal === 'edit' && editing) {
        await adminApi(token).products.update(editing.id as string, body);
      } else {
        await adminApi(token).products.create(body);
      }
      await load(token, page);
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name?: string) {
    if (!(await confirmAction({
      title: '¿Eliminar producto?',
      message: <>Se eliminará el producto <HL>{name || 'seleccionado'}</HL>. <Danger>Esta acción no se puede deshacer.</Danger></>,
      danger: true,
    }))) return;
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    try {
      await adminApi(token).products.delete(id);
      setProducts((prev) => prev.filter(p => p.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const setImages = useCallback((updater: string[] | ((prev: string[]) => string[])) =>
    setForm(f => ({ ...f, images: typeof updater === 'function' ? updater(f.images) : updater })), []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin" className="text-gray-500 hover:text-primary-600"><ChevronLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold text-2xl text-gray-900">Productos</h1>
          <button onClick={openCreate}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-semibold rounded-xl text-sm hover:bg-primary-500 transition-colors">
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-400 mb-4">No hay productos creados</p>
            <button onClick={openCreate} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-full text-sm hover:bg-primary-500 transition-colors">
              <Plus className="w-4 h-4" /> Crear primer producto
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => {
              const images = p.images as string[] || [];
              return (
                <div key={p.id as string} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${p.isActive ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
                  <div className="aspect-video bg-gray-100 relative">
                    {images[0] ? (
                      <Image src={images[0]} alt={p.name as string} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🧴</div>
                    )}
                    {!p.isActive && (
                      <span className="absolute top-2 right-2 bg-gray-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Inactivo</span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-sm text-gray-900 line-clamp-1">{p.name as string}</h3>
                    {p.brand != null && <p className="text-xs text-gray-400 mb-1">{String(p.brand)}</p>}
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="font-black text-primary-600">S/ {Number(p.pricePen).toFixed(2)}</span>
                      {p.comparePrice != null && (
                        <span className="text-xs text-gray-400 line-through">S/ {Number(p.comparePrice).toFixed(2)}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-3">Stock: <span className={Number(p.stock) === 0 ? 'text-red-500 font-bold' : 'font-medium'}>{Number(p.stock)}</span></p>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>
                      <button onClick={() => handleDelete(p.id as string, p.name as string)} className="p-1.5 border border-red-100 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && products.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={setPage}
            className="mt-6"
          />
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-display font-bold text-lg">{modal === 'create' ? 'Nuevo producto' : 'Editar producto'}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Nombre *" value={form.name} onChange={set('name')} />
              <Field label="Descripción" value={form.description} onChange={set('description')} textarea />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Precio (S/) *" type="number" value={form.pricePen} onChange={set('pricePen')} />
                <Field label="Precio tachado" type="number" value={form.comparePrice} onChange={set('comparePrice')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Stock" type="number" value={form.stock} onChange={set('stock')} />
                <Field label="Marca" value={form.brand} onChange={set('brand')} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Categoría</label>
                <select value={form.categoryId} onChange={set('categoryId')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Sin categoría</option>
                  {categories.map((c) => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}
                </select>
              </div>
              <ImageManager images={form.images} setImages={setImages} />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-primary-600" />
                <span className="text-sm font-medium text-gray-700">Producto activo</span>
              </label>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', textarea = false }: {
  label: string; value: string; onChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>; type?: string; textarea?: boolean;
}) {
  const cls = "w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500";
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {textarea
        ? <textarea value={value} onChange={onChange} rows={3} className={cls} />
        : <input type={type} value={value} onChange={onChange} className={cls} />
      }
    </div>
  );
}

function ImageManager({ images, setImages }: {
  images: string[];
  setImages: (updater: string[] | ((prev: string[]) => string[])) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const token = localStorage.getItem('admin_token') || '';
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!arr.length) { setErr('Solo se permiten imágenes'); return; }
    setErr('');
    for (const file of arr) {
      if (file.size > IMG_MAX) { setErr(`"${file.name}" supera 8 MB`); continue; }
      setBusy(b => b + 1);
      try {
        const base64 = await fileToBase64(file);
        const up = await adminApi(token).upload(base64, 'productos') as { url: string };
        if (up?.url) setImages(prev => [...prev, up.url]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Error al subir la imagen');
      } finally {
        setBusy(b => b - 1);
      }
    }
  }, [setImages]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
  }

  const makePrimary = (idx: number) => setImages(prev => {
    if (idx <= 0 || idx >= prev.length) return prev;
    const next = [...prev];
    const [x] = next.splice(idx, 1);
    next.unshift(x);
    return next;
  });
  const remove = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx));

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">Imágenes</label>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {images.map((url, i) => (
            <div key={url + i}
              className={`relative group aspect-square rounded-xl overflow-hidden border ${i === 0 ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-200'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Imagen ${i + 1}`} className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1 left-1 bg-primary-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-current" /> Principal
                </span>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                {i !== 0 && (
                  <button type="button" onClick={() => makePrimary(i)} title="Marcar como principal"
                    className="bg-white text-gray-800 rounded-full p-1.5 hover:bg-primary-600 hover:text-white transition-colors">
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button type="button" onClick={() => remove(i)} title="Quitar"
                  className="bg-white text-red-600 rounded-full p-1.5 hover:bg-red-600 hover:text-white transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`cursor-pointer rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-5 px-4 text-center transition-colors ${dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
        {busy > 0 ? (
          <span className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Subiendo {busy} imagen(es)…</span>
        ) : (
          <>
            <Upload className="w-6 h-6 text-gray-400 mb-1" />
            <p className="text-sm font-medium text-gray-600">Arrastra imágenes aquí o haz clic para adjuntar</p>
            <p className="text-xs text-gray-400 mt-0.5">JPG, PNG o WebP · máx. 8 MB · la primera es la principal</p>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) void uploadFiles(e.target.files); e.target.value = ''; }} />
      </div>
      {err && <p className="text-red-600 text-xs mt-1">{err}</p>}
    </div>
  );
}
