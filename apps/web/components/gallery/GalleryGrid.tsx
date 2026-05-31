'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, Play } from 'lucide-react';

interface Photo {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  category?: string | null;
}

interface GalleryGridProps {
  photos: Photo[];
}

const isVideoUrl = (u: string) => /\.(mp4|webm|mov|mkv|m3u8)(\?|$)/i.test(u);
function videoPoster(p: Photo) {
  if (p.thumbnailUrl) return p.thumbnailUrl;
  return p.imageUrl
    .replace('/upload/', '/upload/so_0,c_fill,w_700,h_900,q_auto/')
    .replace(/\.(mp4|webm|mov|mkv)$/i, '.jpg');
}

export default function GalleryGrid({ photos }: GalleryGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const open = (index: number) => setLightboxIndex(index);
  const close = () => setLightboxIndex(null);

  const prev = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);

  const next = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex, prev, next]);

  if (photos.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">📷</p>
        <p className="text-gray-500">La galería estará disponible pronto.</p>
      </div>
    );
  }

  const current = lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <>
      {/* Collage tipo masonry */}
      <div className="columns-2 md:columns-3 lg:columns-4 gap-3 md:gap-4">
        {photos.map((photo, index) => {
          const video = isVideoUrl(photo.imageUrl);
          return (
            <button
              key={photo.id}
              onClick={() => open(index)}
              className="break-inside-avoid mb-3 md:mb-4 block w-full group relative overflow-hidden rounded-2xl bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {video ? (
                <video
                  src={photo.imageUrl}
                  poster={videoPoster(photo)}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                  onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                  className="w-full block object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <Image
                  src={photo.imageUrl}
                  alt={photo.caption || 'Trabajo de Deyanira Makeup Beauty'}
                  width={500}
                  height={600}
                  className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}

              {/* Indicador de video */}
              {video && (
                <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                  <Play className="h-3 w-3 fill-current" /> Video
                </span>
              )}

              {/* Overlay hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-300 flex items-center justify-center">
                {video
                  ? <Play className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-10 h-10 drop-shadow-lg fill-white" />
                  : <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-8 h-8 drop-shadow-lg" />}
              </div>
              {photo.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/65 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                  <p className="text-white text-xs font-medium truncate">{photo.caption}</p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      {current && lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={close}>
          <button onClick={close}
            className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
            aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>

          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {lightboxIndex + 1} / {photos.length}
          </div>

          {photos.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-2 md:left-6 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
              aria-label="Anterior">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <div className="relative max-w-[90vw] max-h-[85vh] mx-auto px-12" onClick={(e) => e.stopPropagation()}>
            {isVideoUrl(current.imageUrl) ? (
              <video
                src={current.imageUrl}
                poster={videoPoster(current)}
                controls
                autoPlay
                loop
                playsInline
                className="max-w-full max-h-[85vh] rounded-lg"
              />
            ) : (
              <Image
                src={current.imageUrl}
                alt={current.caption || 'Trabajo de Deyanira Makeup Beauty'}
                width={1000}
                height={1000}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
                priority
              />
            )}
            {current.caption && (
              <p className="text-white/70 text-sm text-center mt-3 px-2">{current.caption}</p>
            )}
          </div>

          {photos.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-2 md:right-6 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
              aria-label="Siguiente">
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Tira de miniaturas (desktop) */}
          {photos.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 hidden md:flex justify-center gap-2 px-6">
              {photos.map((photo, i) => (
                <button key={photo.id}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className={`relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                    i === lightboxIndex ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-80'
                  }`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={isVideoUrl(photo.imageUrl) ? videoPoster(photo) : photo.imageUrl} alt="" className="w-full h-full object-cover" />
                  {isVideoUrl(photo.imageUrl) && <Play className="absolute inset-0 m-auto w-4 h-4 text-white fill-white drop-shadow" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
