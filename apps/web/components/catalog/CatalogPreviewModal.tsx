'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Sparkles, Clock, Plus, ExternalLink, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

type CatalogItem = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  extraPricePen: number | null;
  extraMinutes: number | null;
};

type CatalogDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  heroImageUrl: string | null;
  groups: Array<{ label: string; items: CatalogItem[] }>;
};

export function CatalogPreviewModal({
  slug,
  accent = '#E8C040',
  onClose,
}: {
  slug: string;
  accent?: string;
  onClose: () => void;
}) {
  const [cat, setCat] = useState<CatalogDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setCat(null);
    api.catalogs.get(slug)
      .then((data) => { if (!cancelled) setCat(data as CatalogDetail); })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo');
      });
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-3xl md:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 md:px-7 py-4 md:py-5 flex items-center justify-between border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] font-semibold mb-1 flex items-center gap-1.5" style={{ color: accent }}>
              <Sparkles className="w-3.5 h-3.5" /> Catálogo
            </div>
            <h3 className="font-display font-bold italic text-xl md:text-2xl truncate" style={{ color: '#0F0F0F' }}>
              {cat?.name || 'Cargando…'}
            </h3>
            {cat?.description && (
              <p className="text-xs md:text-sm mt-1 line-clamp-2" style={{ color: '#6b4d5a' }}>{cat.description}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition shrink-0" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 md:p-7">
          {error && (
            <div className="text-center py-16">
              <p className="text-sm" style={{ color: '#a33' }}>{error}</p>
            </div>
          )}

          {!cat && !error && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: accent }} />
            </div>
          )}

          {cat && cat.groups.length === 0 && (
            <div className="text-center py-16">
              <p className="text-4xl mb-2">📭</p>
              <p className="text-sm" style={{ color: '#6b4d5a' }}>Aún no hay opciones en este catálogo</p>
            </div>
          )}

          {cat && cat.groups.map((group) => (
            <section key={group.label || 'default'} className="mb-7 last:mb-0">
              {group.label && (
                <h4 className="font-display font-bold italic text-lg mb-3" style={{ color: '#0F0F0F' }}>
                  {group.label}
                </h4>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {group.items.map((it) => (
                  <article key={it.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                    {it.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.imageUrl} alt={it.title} className="w-full aspect-[4/3] object-cover" />
                    ) : (
                      <div className="w-full aspect-[4/3]" style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}08)` }} />
                    )}
                    <div className="p-3">
                      <h5 className="font-bold text-sm mb-1 leading-tight" style={{ color: '#0F0F0F' }}>{it.title}</h5>
                      {it.description && (
                        <p className="text-[11px] mb-2 line-clamp-2" style={{ color: '#6b4d5a' }}>{it.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        {it.extraPricePen != null && it.extraPricePen > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: `${accent}18`, color: accent }}>
                            <Plus className="w-2.5 h-2.5" />S/{it.extraPricePen}
                          </span>
                        )}
                        {it.extraMinutes != null && it.extraMinutes > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ background: 'rgba(0,0,0,0.05)', color: '#6b4d5a' }}>
                            <Clock className="w-2.5 h-2.5" />+{it.extraMinutes}min
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        {cat && (
          <div className="px-5 md:px-7 py-3 md:py-4 border-t flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <p className="text-[11px]" style={{ color: '#6b4d5a' }}>
              Selecciona el estilo que te guste el día de tu cita.
            </p>
            <Link
              href={`/catalogo/${cat.slug}`}
              onClick={onClose}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition-all hover:-translate-y-0.5 self-start sm:self-auto"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, boxShadow: `0 4px 14px ${accent}44` }}
            >
              Ver catálogo completo <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
