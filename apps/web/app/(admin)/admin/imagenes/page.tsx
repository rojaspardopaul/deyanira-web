'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { invalidateSalonSettingsCache } from '@/lib/useSalonSettings';
import { Save, Check, Upload, X, Plus, ArrowUp, ArrowDown, Trash2, Pencil, Images } from 'lucide-react';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { confirmAction } from '@/lib/confirm';
import { HL, Danger } from '@/components/ui/highlight';
import ImagenesTabs from '@/components/admin/imagenes/ImagenesTabs';

// "Marca y portada": todas las imágenes de marca/contenido del salón (logos,
// fotos de Nosotros y carrusel del home). Comparte el mismo store de settings
// que Configuración (`settings.get()/update()`), pero edita solo estos campos.

type Slide = {
  badge?: string;
  line1: string;
  line2: string;
  bullets?: string[];
  cta?: string;
  ctaHref?: string;
  tag?: string | null;
  image?: string;
  video?: string;
  gravity?: 'auto' | 'face' | 'faces' | 'center';
};
type Settings = Record<string, string | number | boolean | null | Slide[] | unknown[]>;

export default function AdminMarcaPortadaPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [slideIdx, setSlideIdx] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/admin/login'); return; }
    adminApi(token).settings.get()
      .then((data) => { setSettings(data as Settings); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  async function handleSave() {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await adminApi(token).settings.update(settings);
      invalidateSalonSettingsCache();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const setVal = (k: string, v: string) => setSettings(s => ({ ...s, [k]: v }));

  // ── Slides del carrusel ───────────────────────────────────────
  const slides = (Array.isArray(settings.homeSlides) ? settings.homeSlides : []) as Slide[];
  function setSlides(next: Slide[]) { setSettings(s => ({ ...s, homeSlides: next })); }
  function updateSlide(idx: number, patch: Partial<Slide>) {
    const next = [...slides];
    next[idx] = { ...next[idx], ...patch };
    setSlides(next);
  }
  function addSlide() {
    const next = [...slides, {
      badge: 'Nuevo · Servicio', line1: 'Título', line2: 'línea 2',
      bullets: ['Punto 1', 'Punto 2'], cta: 'Reservar ahora', ctaHref: '/reservar', gravity: 'auto' as const,
    }];
    setSlides(next);
    setSlideIdx(next.length - 1);
  }
  async function removeSlide(idx: number) {
    if (!(await confirmAction({
      title: '¿Eliminar slide?',
      message: <>Se eliminará el <HL>slide #{idx + 1}</HL> del carrusel. <Danger>Esta acción no se puede deshacer.</Danger></>,
      danger: true,
    }))) return;
    setSlides(slides.filter((_, i) => i !== idx));
    setSlideIdx(null);
  }
  function moveSlide(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[idx], next[target]] = [next[target], next[idx]];
    setSlides(next);
  }

  async function uploadLogo(file: File, field: string) {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target?.result as string;
        const result = await adminApi(token).upload(base64, 'logos') as { url: string };
        setVal(field, result.url);
      } catch {
        setError('Error al subir imagen. Verifica la configuración de Cloudinary.');
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold flex items-center gap-2 mb-1">
          <Images className="w-7 h-7" /> Imágenes
        </h1>
        <p className="text-sm text-gray-500 mb-5">Catálogos visuales, galería de fotos y marca/portada del salón.</p>

        <ImagenesTabs active="marca" />

        {loading ? (
          <p className="text-gray-400 text-sm py-10 text-center">Cargando…</p>
        ) : (
          <>
            <div className="flex items-center justify-end mb-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className={`flex items-center gap-2 px-4 py-2 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 ${
                  saved ? 'bg-green-500 text-white' : 'bg-primary-600 text-white hover:bg-primary-500'
                }`}
              >
                {saved ? <><Check className="w-4 h-4" /> Guardado</> : <><Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Guardar'}</>}
              </button>
            </div>

            <div className="space-y-5">
              {/* Identidad visual (logos) */}
              <Section title="Identidad visual (logos)">
                <p className="text-xs text-gray-400 -mt-1 mb-2">
                  Sube las versiones del logo o pega URLs directamente. Se usan en la web y en los emails.
                </p>
                <LogoField
                  label="Logo para fondo oscuro (header web, emails)"
                  hint="Versión blanca/dorada del logo — se ve sobre fondos oscuros"
                  value={settings.logoDarkUrl as string || ''}
                  onChange={(v) => setVal('logoDarkUrl', v)}
                  onUpload={(f) => uploadLogo(f, 'logoDarkUrl')}
                  darkPreview
                />
                <LogoField
                  label="Logo para fondo claro (panel admin, documentos)"
                  hint="Versión oscura del logo — se ve sobre fondos blancos"
                  value={settings.logoUrl as string || ''}
                  onChange={(v) => setVal('logoUrl', v)}
                  onUpload={(f) => uploadLogo(f, 'logoUrl')}
                />
                <LogoField
                  label="Ícono cuadrado (favicon, apps)"
                  hint="Versión cuadrada compacta del logo"
                  value={settings.logoIconUrl as string || ''}
                  onChange={(v) => setVal('logoIconUrl', v)}
                  onUpload={(f) => uploadLogo(f, 'logoIconUrl')}
                  accept="image/*,.ico,image/x-icon,image/vnd.microsoft.icon"
                />
              </Section>

              {/* Página Nosotros */}
              <Section title="Página Nosotros">
                <p className="text-xs text-gray-400 -mt-1 mb-2">
                  Imágenes de la página Nosotros. La foto del salón va de fondo en la cabecera y la foto grupal en “¿Quiénes somos?”.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <ImageUploader
                    value={(settings.salonPhotoUrl as string) || ''}
                    onChange={(url) => setVal('salonPhotoUrl', url || '')}
                    folder="equipo"
                    label="Foto del salón (fondo de la cabecera)"
                    aspect="16/9"
                    recommendedSize="Foto horizontal del interior del salón (ej. 1920×1080). Va de fondo en la cabecera de Nosotros."
                    onError={(msg) => setError(msg)}
                  />
                  <ImageUploader
                    value={(settings.teamPhotoUrl as string) || ''}
                    onChange={(url) => setVal('teamPhotoUrl', url || '')}
                    folder="equipo"
                    label="Foto grupal del equipo"
                    aspect="4/3"
                    recommendedSize="Foto del equipo completo (ej. 1600×1200). Se muestra en “¿Quiénes somos?”."
                    onError={(msg) => setError(msg)}
                  />
                </div>
              </Section>

              {/* Carrusel del home */}
              <Section title="Carrusel del inicio (slides del home)">
                <p className="text-xs text-gray-500 -mt-1 mb-3">
                  Sube imágenes <strong>horizontales</strong> idealmente <strong>1920×1080 px (16:9)</strong> o videos <strong>MP4/WebM</strong>. Si la imagen es vertical (retrato), el sistema usa Cloudinary para enfocar automáticamente el rostro o el punto importante — no se cortan caras.
                </p>

                {slides.length === 0 && (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 mb-3">
                    <p className="text-sm text-gray-500 mb-2">No hay slides personalizados.</p>
                    <p className="text-xs text-gray-400">Se está mostrando el carrusel por defecto.</p>
                  </div>
                )}

                <div className="space-y-2">
                  {slides.map((s, idx) => {
                    const isVideo = !!s.video;
                    const previewUrl = s.video || s.image;
                    return (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white">
                        <div className="w-20 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          {previewUrl ? (
                            isVideo
                              ? <video src={previewUrl} muted className="w-full h-full object-cover" />
                              // eslint-disable-next-line @next/next/no-img-element
                              : <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">—</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{s.line1} <span className="text-pink-600">{s.line2}</span></p>
                          <p className="text-[11px] text-gray-500 truncate">{s.badge}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => moveSlide(idx, -1)} disabled={idx === 0}
                            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => moveSlide(idx, 1)} disabled={idx === slides.length - 1}
                            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => setSlideIdx(idx)}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => removeSlide(idx)}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button type="button" onClick={addSlide}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600">
                  <Plus className="w-4 h-4" /> Nuevo slide
                </button>
              </Section>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className={`mt-6 w-full flex items-center justify-center gap-2 py-3.5 font-bold rounded-full text-sm transition-all disabled:opacity-50 ${
                saved ? 'bg-green-500 text-white' : 'bg-primary-600 text-white hover:bg-primary-500'
              }`}
              style={saved ? undefined : { boxShadow: '0 4px 20px rgba(219,39,119,0.35)' }}
            >
              {saved ? <><Check className="w-4 h-4" /> Imágenes guardadas</> : <><Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Guardar imágenes'}</>}
            </button>
          </>
        )}
      </div>

      {/* Modal: editar slide */}
      {slideIdx !== null && slides[slideIdx] && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4" onClick={() => setSlideIdx(null)}>
          <div className="bg-white w-full md:max-w-2xl rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-lg">Editar slide #{slideIdx + 1}</h3>
              <button onClick={() => setSlideIdx(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <ImageUploader
                  value={slides[slideIdx].image || ''}
                  onChange={(url) => updateSlide(slideIdx, { image: url || undefined, video: url ? undefined : slides[slideIdx].video })}
                  folder="carrusel"
                  label="Imagen del slide"
                  aspect="16/9"
                  recommendedSize="Recomendado: 1920×1080 (16:9). Imágenes verticales también funcionan — se enfocan automáticamente."
                  onError={(msg) => setError(msg)}
                />
                <ImageUploader
                  value={slides[slideIdx].video || ''}
                  onChange={(url) => updateSlide(slideIdx, { video: url || undefined, image: url ? undefined : slides[slideIdx].image })}
                  folder="carrusel"
                  label="O video del slide"
                  accept="video"
                  aspect="16/9"
                  recommendedSize="MP4 ≤ 50 MB. El video reemplaza la imagen."
                  onError={(msg) => setError(msg)}
                />
              </div>

              {slides[slideIdx].image && !slides[slideIdx].video && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Punto focal (cuando es imagen)</label>
                  <select
                    value={slides[slideIdx].gravity || 'auto'}
                    onChange={(e) => updateSlide(slideIdx, { gravity: e.target.value as Slide['gravity'] })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"
                  >
                    <option value="auto">Automático (Cloudinary decide)</option>
                    <option value="face">Rostro detectado (recomendado para retratos)</option>
                    <option value="faces">Varios rostros (para fotos grupales)</option>
                    <option value="center">Centro de la imagen</option>
                  </select>
                  <p className="text-[10px] text-gray-400 mt-0.5">Solo se aplica si la imagen es de Cloudinary. Evita que se corten caras al recortar.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Línea 1 (título)</label>
                  <input type="text" value={slides[slideIdx].line1}
                    onChange={(e) => updateSlide(slideIdx, { line1: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Línea 2 (rosado)</label>
                  <input type="text" value={slides[slideIdx].line2}
                    onChange={(e) => updateSlide(slideIdx, { line2: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Badge (arriba del título)</label>
                <input type="text" value={slides[slideIdx].badge || ''}
                  onChange={(e) => updateSlide(slideIdx, { badge: e.target.value })}
                  placeholder="Ej. Reserva online · Confirmación inmediata"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Bullets (1 por línea)</label>
                <textarea
                  value={(slides[slideIdx].bullets || []).join('\n')}
                  onChange={(e) => updateSlide(slideIdx, { bullets: e.target.value.split('\n') })}
                  onBlur={() => updateSlide(slideIdx, { bullets: (slides[slideIdx].bullets || []).map((s) => s.trim()).filter(Boolean) })}
                  rows={4}
                  placeholder={'Punto 1\nPunto 2'}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-y leading-relaxed focus:outline-none focus:ring-2 focus:ring-gold-400"
                />
                <p className="mt-1 text-[11px] text-gray-400">Una línea por viñeta. Presiona Enter para agregar otra.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Texto del botón</label>
                  <input type="text" value={slides[slideIdx].cta || ''}
                    onChange={(e) => updateSlide(slideIdx, { cta: e.target.value })}
                    placeholder="Reserva ahora"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">URL del botón</label>
                  <input type="text" value={slides[slideIdx].ctaHref || ''}
                    onChange={(e) => updateSlide(slideIdx, { ctaHref: e.target.value })}
                    placeholder="/reservar"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Etiqueta extra (opcional)</label>
                <input type="text" value={slides[slideIdx].tag || ''}
                  onChange={(e) => updateSlide(slideIdx, { tag: e.target.value || null })}
                  placeholder="-15%, NUEVO, etc."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setSlideIdx(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="font-semibold text-sm text-gray-700">{title}</h2>
      </div>
      <div className="p-5 space-y-3">{children}</div>
    </div>
  );
}

function LogoField({ label, hint, value, onChange, onUpload, darkPreview, accept = 'image/*' }: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  onUpload: (f: File) => void;
  darkPreview?: boolean;
  accept?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-medium transition-colors"
          title="Subir desde dispositivo"
        >
          <Upload className="w-3.5 h-3.5" />
          Subir
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex items-center px-2.5 py-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-colors"
            title="Quitar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {value && (
        <div className={`mt-2 inline-flex items-center justify-center rounded-xl p-3 ${darkPreview ? 'bg-gray-900' : 'bg-gray-50 border border-gray-200'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="max-h-12 w-auto object-contain" />
        </div>
      )}
      <input ref={fileRef} type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
    </div>
  );
}
