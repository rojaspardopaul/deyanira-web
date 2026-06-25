'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Upload, X, Loader2, ImagePlus, RotateCw, Film, Move } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { clImage, getFocal, withFocal, stripFocal, isCloudinaryUrl } from '@/lib/cloudinary-client';
import { IMAGE_SLOTS, type ImageSlotKey } from '@/lib/imagePresets';

type Folder = 'galeria' | 'productos' | 'servicios' | 'staff' | 'blog' | 'general' | 'logos' | 'eventos' | 'paquetes' | 'catalogos' | 'addons' | 'carrusel' | 'equipo';

const ACCEPTED_IMAGE = 'image/jpeg,image/jpg,image/png,image/webp,image/gif';
const ACCEPTED_VIDEO = 'video/mp4,video/webm,video/quicktime,video/x-matroska';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function ImageUploader({
  value,
  onChange,
  folder = 'general',
  label,
  helpText,
  aspect = '16/9',
  slot,
  className = '',
  onError,
  accept = 'image',
  recommendedSize,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  folder?: Folder;
  label?: string;
  helpText?: string;
  /** CSS aspect-ratio for the preview area, e.g. '16/9', '1/1', '4/3'. Lo sobreescribe `slot`. */
  aspect?: string;
  /**
   * Slot de imagen (ver `lib/imagePresets.ts`). Si se pasa, el preview muestra la
   * imagen EXACTAMENTE como saldrá en la web (mismo recorte que el público) y,
   * si el slot recorta, habilita un punto focal arrastrable.
   */
  slot?: ImageSlotKey;
  className?: string;
  onError?: (msg: string) => void;
  /** 'image' (default), 'video', o 'both' para permitir ambos. */
  accept?: 'image' | 'video' | 'both';
  /** Texto adicional indicando tamaño recomendado, ej. "Recomendado: 1920×800 (apaisado)". */
  recommendedSize?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const slotDef = slot ? IMAGE_SLOTS[slot] : null;
  const effAspect = slotDef?.aspect ?? aspect;

  const base = stripFocal(value);
  const isVideoUrl = !!base && /\.(mp4|webm|mov|mkv)(\?|$)/i.test(base);
  const isCloud = isCloudinaryUrl(base);
  // El punto focal aplica solo a slots que recortan, sobre una imagen (no video).
  const focalEnabled = !!slotDef?.crops && !!value && !isVideoUrl;

  // ── Punto focal (x,y normalizados) ──────────────────────────
  const [focal, setFocal] = useState<{ x: number; y: number }>(() => getFocal(value) ?? { x: 0.5, y: 0.5 });
  const focalRef = useRef(focal);
  const setFocalBoth = useCallback((f: { x: number; y: number }) => { focalRef.current = f; setFocal(f); }, []);
  // Resetea el focal SOLO cuando cambia la imagen de fondo (no al editar el fragmento).
  useEffect(() => {
    const f = getFocal(value) ?? { x: 0.5, y: 0.5 };
    focalRef.current = f;
    setFocal(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [draggingFocal, setDraggingFocal] = useState(false);

  const focalFromEvent = useCallback((clientX: number, clientY: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setFocalBoth({
      x: clamp01((clientX - r.left) / r.width),
      y: clamp01((clientY - r.top) / r.height),
    });
  }, [setFocalBoth]);

  function onFocalPointerDown(e: React.PointerEvent) {
    if (!focalEnabled) return;
    if ((e.target as HTMLElement).closest('button')) return; // no interferir con Cambiar/Quitar
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingFocal(true);
    focalFromEvent(e.clientX, e.clientY);
  }
  function onFocalPointerMove(e: React.PointerEvent) {
    if (!draggingFocal) return;
    focalFromEvent(e.clientX, e.clientY);
  }
  function commitFocal() {
    if (!draggingFocal) return;
    setDraggingFocal(false);
    if (value) onChange(withFocal(value, focalRef.current.x, focalRef.current.y));
  }

  // ── Subida ──────────────────────────────────────────────────
  async function handleFile(file: File) {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (accept === 'image' && !isImage) {
      onError?.('Solo se permiten imágenes (JPG, PNG, WebP, GIF)');
      return;
    }
    if (accept === 'video' && !isVideo) {
      onError?.('Solo se permiten videos (MP4, WebM)');
      return;
    }
    if (accept === 'both' && !isImage && !isVideo) {
      onError?.('Sube una imagen o un video');
      return;
    }
    const maxBytes = isVideo ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      onError?.(isVideo ? 'El video no puede superar 50MB' : 'La imagen no puede superar 8MB');
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = (e) => res(e.target?.result as string);
        reader.onerror = () => rej(new Error('No se pudo leer el archivo'));
        reader.readAsDataURL(file);
      });
      const result = isVideo
        ? await adminApi().uploadVideo(base64, folder)
        : (await adminApi().upload(base64, folder)) as { url: string };
      onChange(result.url);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  // ── Fuentes de imagen para el preview ───────────────────────
  // Imagen base optimizada (sin recorte) para previews tipo cover con object-position.
  const coverSrc = isCloud ? clImage(base, { w: 1280, crop: 'limit' }) : (base || '');
  // Imagen ya recortada/padded por Cloudinary (slots que NO recortan).
  const renderedSrc = slotDef ? slotDef.render(value) : '';
  const objPos = `${(focal.x * 100).toFixed(1)}% ${(focal.y * 100).toFixed(1)}%`;

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept === 'video' ? ACCEPTED_VIDEO : accept === 'both' ? `${ACCEPTED_IMAGE},${ACCEPTED_VIDEO}` : ACCEPTED_IMAGE}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />

      {value ? (
        slotDef ? (
          // ── WYSIWYG: se ve como en la web ──
          <>
            <div
              ref={wrapRef}
              className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 select-none"
              style={{ aspectRatio: effAspect, cursor: focalEnabled ? (draggingFocal ? 'grabbing' : 'grab') : 'default', touchAction: focalEnabled ? 'none' : undefined }}
              onPointerDown={onFocalPointerDown}
              onPointerMove={onFocalPointerMove}
              onPointerUp={commitFocal}
              onPointerCancel={commitFocal}
            >
              {isVideoUrl ? (
                <video src={base} muted loop autoPlay playsInline className="w-full h-full object-cover" />
              ) : slotDef.crops ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverSrc} alt="" draggable={false} className="w-full h-full object-cover" style={{ objectPosition: objPos }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={renderedSrc} alt="" draggable={false} className="w-full h-full object-contain bg-black/5" />
              )}

              {/* Punto focal */}
              {focalEnabled && (
                <div
                  className="absolute z-20 pointer-events-none"
                  style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <span className="block w-7 h-7 rounded-full border-2 border-white bg-amber-500/40 shadow-[0_0_0_2px_rgba(0,0,0,0.35)] backdrop-blur-[1px]" />
                  <Move className="w-3.5 h-3.5 text-white absolute inset-0 m-auto drop-shadow" />
                </div>
              )}

              {/* Acciones (esquina, fuera del centro de arrastre) */}
              <div className="absolute top-2 right-2 z-30 flex gap-1.5">
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={uploading}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/95 rounded-full text-[11px] font-semibold text-gray-800 shadow disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  disabled={uploading}
                  className="inline-flex items-center justify-center w-7 h-7 bg-red-500 rounded-full text-white shadow disabled:opacity-50"
                  title="Quitar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {uploading && (
                <div className="absolute inset-0 z-40 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                </div>
              )}
            </div>

            {focalEnabled && (
              <p className="text-[10px] text-amber-700 mt-1 font-semibold flex items-center gap-1">
                <Move className="w-3 h-3" /> Arrastra el punto para elegir qué parte se ve en la web
              </p>
            )}

            {/* Tiles de otras superficies del mismo archivo */}
            {slotDef.also && slotDef.also.length > 0 && !isVideoUrl && (
              <div className="flex flex-wrap gap-3 mt-2">
                {slotDef.also.map((key) => {
                  const s = IMAGE_SLOTS[key];
                  return (
                    <div key={key} className="text-center">
                      <div
                        className="rounded-lg overflow-hidden border border-gray-200 bg-gray-100"
                        style={{ aspectRatio: s.aspect, width: 96 }}
                      >
                        {s.crops ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={coverSrc} alt="" className="w-full h-full object-cover" style={{ objectPosition: objPos }} />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.render(value)} alt="" className="w-full h-full object-contain bg-black/5" />
                        )}
                      </div>
                      <p className="text-[9px] text-gray-400 mt-0.5">{s.label}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          // ── Modo clásico (sin slot): imagen completa + acciones al hover ──
          <div
            className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 group"
            style={{ aspectRatio: effAspect }}
          >
            {isVideoUrl ? (
              <video src={base} muted loop autoPlay playsInline className="w-full h-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={base} alt="" className="w-full h-full object-contain bg-black/5" />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={openPicker}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-semibold text-gray-800 shadow disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                Cambiar
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 rounded-full text-xs font-semibold text-white shadow disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> Quitar
              </button>
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
            )}
          </div>
        )
      ) : (
        // ── Sin imagen: dropzone ──
        <button
          type="button"
          onClick={openPicker}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          disabled={uploading}
          className="w-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors disabled:opacity-50"
          style={{
            aspectRatio: effAspect,
            background: dragOver ? 'rgba(245,158,11,0.05)' : '#fafafa',
            borderColor: dragOver ? '#f59e0b' : '#e5e7eb',
          }}
        >
          {uploading ? (
            <>
              <Loader2 className="w-7 h-7 text-amber-500 animate-spin mb-2" />
              <p className="text-xs text-gray-500">Subiendo…</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                {accept === 'video' ? <Film className="w-6 h-6 text-amber-600" /> : <ImagePlus className="w-6 h-6 text-amber-600" />}
              </div>
              <p className="text-sm font-semibold text-gray-700">
                <Upload className="w-3.5 h-3.5 inline mr-1" />
                Subir {accept === 'video' ? 'video' : accept === 'both' ? 'imagen o video' : 'imagen'}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Arrastra aquí o haz clic para elegir
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {accept === 'video'
                  ? 'MP4, WebM — máx. 50 MB'
                  : accept === 'both'
                    ? 'Imagen (8MB) o video MP4/WebM (50MB)'
                    : 'JPG, PNG, WebP — máx. 8 MB · se guarda en WebP'}
              </p>
              {recommendedSize && (
                <p className="text-[10px] text-amber-700 mt-1 px-3 text-center font-semibold">
                  ✦ {recommendedSize}
                </p>
              )}
            </>
          )}
        </button>
      )}
      {recommendedSize && value && (
        <p className="text-[10px] text-amber-700 mt-1 font-semibold">
          ✦ {recommendedSize}
        </p>
      )}
      {helpText && <p className="text-[10px] text-gray-400 mt-1">{helpText}</p>}
    </div>
  );
}
