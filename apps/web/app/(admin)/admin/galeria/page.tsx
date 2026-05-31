'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import Link from 'next/link';
import {
  ChevronLeft, Trash2, Eye, EyeOff, UploadCloud, Loader2, Film,
  Check, AlertCircle, Tag,
} from 'lucide-react';
import { confirmAction } from '@/lib/confirm';
import { HL, Danger } from '@/components/ui/highlight';
import { getCategoryTheme } from '@/lib/categoryTheme';

type GalleryItem = {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  category?: string | null;
  isPublished?: boolean;
};

const CATEGORIES = [
  { slug: 'general', label: 'General' },
  { slug: 'maquillaje', label: 'Maquillaje' },
  { slug: 'cabello', label: 'Cabello' },
  { slug: 'unas', label: 'Uñas' },
  { slug: 'cejas', label: 'Cejas' },
];

const IMG_MAX = 8 * 1024 * 1024;
const VIDEO_MAX = 40 * 1024 * 1024;
const isVideoFile = (f: File) => f.type.startsWith('video/');
const isVideoUrl = (u: string) => /\.(mp4|webm|mov|mkv|m3u8)(\?|$)/i.test(u);

// Poster de un video de Cloudinary (primer frame, recortado cuadrado).
function videoPoster(url: string) {
  return url
    .replace('/upload/', '/upload/so_0,c_fill,w_700,h_700,q_auto/')
    .replace(/\.(mp4|webm|mov|mkv)$/i, '.jpg');
}

type UploadJob = {
  key: string;
  name: string;
  previewUrl: string;
  isVideo: boolean;
  status: 'uploading' | 'done' | 'error';
  error?: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target?.result as string);
    r.onerror = () => rej(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });
}

export default function AdminGaleriaPage() {
  const router = useRouter();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('general');
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [editCat, setEditCat] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const uploadOne = useCallback(async (file: File, cat: string) => {
    const token = localStorage.getItem('admin_token') || '';
    const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
    const video = isVideoFile(file);
    const previewUrl = URL.createObjectURL(file);

    // Validación rápida
    if (video && file.size > VIDEO_MAX) {
      setJobs((j) => [{ key, name: file.name, previewUrl, isVideo: true, status: 'error', error: 'Video supera 40 MB' }, ...j]);
      return;
    }
    if (!video && !file.type.startsWith('image/')) {
      setJobs((j) => [{ key, name: file.name, previewUrl, isVideo: false, status: 'error', error: 'Formato no soportado' }, ...j]);
      return;
    }
    if (!video && file.size > IMG_MAX) {
      setJobs((j) => [{ key, name: file.name, previewUrl, isVideo: false, status: 'error', error: 'Imagen supera 8 MB' }, ...j]);
      return;
    }

    setJobs((j) => [{ key, name: file.name, previewUrl, isVideo: video, status: 'uploading' }, ...j]);
    try {
      const base64 = await fileToBase64(file);
      const up = video
        ? await adminApi(token).uploadVideo(base64, 'galeria')
        : (await adminApi(token).upload(base64, 'galeria')) as { url: string };
      const mediaUrl = up.url;
      const thumbnailUrl = video ? videoPoster(mediaUrl) : undefined;

      const created = await adminApi(token).gallery.upload({
        imageUrl: mediaUrl,
        thumbnailUrl,
        mediaType: video ? 'video' : 'image',
        category: cat,
      }) as GalleryItem;

      setItems((prev) => [created, ...prev]);
      setJobs((j) => j.map((x) => x.key === key ? { ...x, status: 'done' } : x));
      // Limpia el job “done” tras un momento
      setTimeout(() => setJobs((j) => j.filter((x) => x.key !== key)), 1500);
    } catch (e) {
      setJobs((j) => j.map((x) => x.key === key ? { ...x, status: 'error', error: e instanceof Error ? e.message : 'Error al subir' } : x));
    }
  }, []);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    arr.forEach((f) => { void uploadOne(f, category); });
  }, [uploadOne, category]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  async function togglePublished(item: GalleryItem) {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isPublished: !item.isPublished } : i));
    try {
      await adminApi(token).gallery.update(item.id, { isPublished: !item.isPublished });
    } catch {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isPublished: item.isPublished } : i));
    }
  }

  async function updateCategory(item: GalleryItem, slug: string) {
    setEditCat(null);
    if ((item.category || 'general') === slug) return;
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    const prevCat = item.category;
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, category: slug } : i));
    try {
      await adminApi(token).gallery.update(item.id, { category: slug });
    } catch {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, category: prevCat } : i));
    }
  }

  async function handleDelete(item: GalleryItem) {
    const kind = isVideoUrl(item.imageUrl) ? 'video' : 'foto';
    if (!(await confirmAction({
      title: `¿Eliminar ${kind}?`,
      message: <>Se eliminará este <HL>{kind} de la galería</HL>. <Danger>Esta acción no se puede deshacer.</Danger></>,
      danger: true,
    }))) return;
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await adminApi(token).gallery.delete(item.id);
    } catch {
      const data = await adminApi(token).gallery.list().catch(() => []);
      setItems(data as GalleryItem[]);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/admin" className="text-gray-500 hover:text-amber-600"><ChevronLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold text-2xl text-gray-900">Galería</h1>
          <span className="ml-auto text-xs text-gray-400 font-medium">{items.length} elemento{items.length !== 1 ? 's' : ''}</span>
        </div>

        {/* ── Categoría del lote + Dropzone ── */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">Subir a:</span>
          {CATEGORIES.map((c) => {
            const t = getCategoryTheme(c.slug);
            const active = category === c.slug;
            return (
              <button key={c.slug} onClick={() => setCategory(c.slug)}
                className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                style={active
                  ? { background: t.soft, color: t.chipText, border: `1.5px solid ${t.accent}` }
                  : { background: '#fff', color: '#9b8089', border: '1.5px solid #eee' }}>
                {t.emoji} {c.label}
              </button>
            );
          })}
        </div>

        <input ref={inputRef} type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime"
          className="hidden" onChange={(e) => { if (e.target.files) handleFiles(e.target.files); if (inputRef.current) inputRef.current.value = ''; }} />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className="w-full rounded-3xl border-2 border-dashed flex flex-col items-center justify-center py-10 px-4 mb-6 transition-all"
          style={{ background: dragOver ? 'rgba(245,158,11,0.06)' : '#fff', borderColor: dragOver ? '#f59e0b' : '#e5d9c3' }}
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mb-3">
            <UploadCloud className="w-7 h-7 text-amber-600" />
          </div>
          <p className="text-base font-bold text-gray-800">Arrastra y suelta tus fotos y videos</p>
          <p className="text-sm text-gray-400 mt-0.5">o haz clic para elegir varios a la vez</p>
          <p className="text-[11px] text-gray-400 mt-2">Imágenes JPG/PNG/WebP (8 MB) · Videos MP4/WebM (40 MB)</p>
        </button>

        {/* ── Jobs en progreso ── */}
        {jobs.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3 mb-6">
            {jobs.map((j) => (
              <div key={j.key} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-900 border border-gray-200">
                {j.isVideo
                  ? <video src={j.previewUrl} muted className="w-full h-full object-cover opacity-70" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={j.previewUrl} alt="" className="w-full h-full object-cover opacity-70" />}
                <div className="absolute inset-0 flex items-center justify-center"
                  style={{ background: j.status === 'error' ? 'rgba(127,29,29,0.6)' : 'rgba(0,0,0,0.45)' }}>
                  {j.status === 'uploading' && <Loader2 className="w-6 h-6 text-white animate-spin" />}
                  {j.status === 'done' && <span className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-4 h-4 text-white" strokeWidth={3} /></span>}
                  {j.status === 'error' && <div className="text-center px-1"><AlertCircle className="w-5 h-5 text-white mx-auto mb-1" /><p className="text-[9px] text-white leading-tight">{j.error}</p></div>}
                </div>
                {j.isVideo && <Film className="absolute top-1.5 left-1.5 w-3.5 h-3.5 text-white drop-shadow" />}
              </div>
            ))}
          </div>
        )}

        {/* ── Galería existente (collage) ── */}
        {loading ? (
          <div className="columns-2 sm:columns-3 md:columns-4 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="mb-3 rounded-2xl bg-white border border-gray-100 animate-pulse" style={{ height: 120 + (i % 3) * 60 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-gray-100">
            <p className="text-5xl mb-3">📸</p>
            <p className="text-gray-400">Aún no hay nada en la galería. ¡Sube tus primeros trabajos!</p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 md:columns-4 gap-3">
            {items.map((item) => {
              const t = getCategoryTheme(item.category);
              const video = isVideoUrl(item.imageUrl);
              const poster = item.thumbnailUrl || (video ? videoPoster(item.imageUrl) : item.imageUrl);
              return (
                <div key={item.id} className={`relative group mb-3 break-inside-avoid rounded-2xl overflow-hidden bg-gray-100 border border-gray-100 ${!item.isPublished ? 'opacity-50' : ''}`}>
                  {video ? (
                    <video src={item.imageUrl} poster={poster} muted loop playsInline
                      onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                      onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                      className="w-full object-cover block" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.caption || ''} loading="lazy" className="w-full object-cover block" />
                  )}

                  {/* Chips */}
                  <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: t.soft, color: t.chipText }}>{t.emoji} {item.category || 'general'}</span>
                  {video && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/55 text-white">
                      <Film className="w-3 h-3" /> Video
                    </span>
                  )}
                  {!item.isPublished && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-900/70 text-white">Oculto</span>
                  )}

                  {/* Acciones */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button onClick={() => setEditCat(editCat === item.id ? null : item.id)} title="Cambiar categoría"
                      className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors">
                      <Tag className="w-4 h-4 text-gray-700" />
                    </button>
                    <button onClick={() => togglePublished(item)} title={item.isPublished ? 'Ocultar' : 'Publicar'}
                      className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors">
                      {item.isPublished ? <EyeOff className="w-4 h-4 text-gray-700" /> : <Eye className="w-4 h-4 text-gray-700" />}
                    </button>
                    <button onClick={() => handleDelete(item)}
                      className="w-9 h-9 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  {/* Selector de categoría */}
                  {editCat === item.id && (
                    <div className="absolute inset-0 z-20 bg-black/75 backdrop-blur-sm p-2.5 flex flex-col justify-center gap-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/60 text-center mb-0.5">Categoría</p>
                      {CATEGORIES.map((c) => {
                        const ct = getCategoryTheme(c.slug);
                        const active = (item.category || 'general') === c.slug;
                        return (
                          <button key={c.slug} onClick={() => updateCategory(item, c.slug)}
                            className="w-full px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95"
                            style={active
                              ? { background: ct.accent, color: '#fff' }
                              : { background: ct.soft, color: ct.chipText }}>
                            {ct.emoji} {c.label} {active && <Check className="w-3 h-3" strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
