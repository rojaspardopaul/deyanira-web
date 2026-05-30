'use client';

import { useRef, useState } from 'react';
import { Upload, X, Loader2, ImagePlus, RotateCw, Film } from 'lucide-react';
import { adminApi } from '@/lib/api';

type Folder = 'galeria' | 'productos' | 'servicios' | 'staff' | 'blog' | 'general' | 'logos' | 'eventos' | 'paquetes' | 'catalogos' | 'addons' | 'carrusel';

const ACCEPTED_IMAGE = 'image/jpeg,image/jpg,image/png,image/webp,image/gif';
const ACCEPTED_VIDEO = 'video/mp4,video/webm,video/quicktime,video/x-matroska';

export function ImageUploader({
  value,
  onChange,
  folder = 'general',
  label,
  helpText,
  aspect = '16/9',
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
  /** CSS aspect-ratio for the preview area, e.g. '16/9', '1/1', '4/3' */
  aspect?: string;
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

  const isVideoUrl = !!value && /\.(mp4|webm|mov|mkv)(\?|$)/i.test(value);

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
        // ── Con imagen/video: preview + acciones ──
        <div
          className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 group"
          style={{ aspectRatio: aspect }}
        >
          {isVideoUrl ? (
            <video src={value} muted loop autoPlay playsInline className="w-full h-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="w-full h-full object-contain bg-black/5" />
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
            aspectRatio: aspect,
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
                    : 'JPG, PNG, WebP — máx. 8 MB'}
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
