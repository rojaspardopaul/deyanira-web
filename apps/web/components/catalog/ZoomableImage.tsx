'use client';

import { useEffect, useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

// Imagen de catálogo que se muestra completa (sin recorte) y, al hacer clic,
// abre un visor a pantalla completa para apreciar el detalle. Sirve tanto en
// componentes cliente como dentro de páginas server (es un client component).

export function ZoomableImage({
  src,
  full,
  alt,
  className,
}: {
  src: string;
  /** Versión de mayor resolución para el visor (por defecto usa `src`). */
  full?: string;
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ampliar ${alt}`}
        className="group relative block w-full cursor-zoom-in"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" className={className} />
        <span className="absolute bottom-2 right-2 flex items-center justify-center w-8 h-8 rounded-full bg-black/45 text-white opacity-0 group-hover:opacity-100 transition-opacity">
          <ZoomIn className="w-4 h-4" />
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={full ?? src}
            alt={alt}
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg cursor-zoom-out"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
