import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Sparkles, Clock, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { ZoomableImage } from '@/components/catalog/ZoomableImage';
import { clImage } from '@/lib/cloudinary-client';

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const cat = (await api.catalogs.get(slug)) as CatalogDetail;
    return buildMetadata({
      title: `${cat.name} — Catálogo | Deyanira Makeup Beauty`,
      description: cat.description || `Catálogo de ${cat.name.toLowerCase()} en Lima.`,
      path: `/catalogo/${cat.slug}`,
    });
  } catch {
    return buildMetadata({ title: 'Catálogo no encontrado', path: `/catalogo/${slug}` });
  }
}

export default async function CatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let cat: CatalogDetail;
  try {
    cat = (await api.catalogs.get(slug)) as CatalogDetail;
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAFAFA' }}>
      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-12 md:pt-24 md:pb-16 px-4" style={{ background: '#0F0F0F' }}>
        {cat!.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cat!.heroImageUrl} alt="" aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-30" />
        )}
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <Link href="/servicios" className="inline-flex items-center gap-1 text-xs font-medium mb-6 transition-colors"
            style={{ color: 'rgba(255,255,255,0.6)' }}>
            <ChevronLeft className="w-3.5 h-3.5" /> Volver
          </Link>
          <p className="text-xs md:text-sm uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: '#E8C040' }}>
            <Sparkles className="w-3.5 h-3.5 inline mr-1.5" /> Catálogo
          </p>
          <h1 className="font-display font-bold italic text-4xl md:text-6xl text-white mb-4 leading-tight">
            {cat!.name}
          </h1>
          {cat!.description && (
            <p className="max-w-2xl mx-auto text-sm md:text-base" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {cat!.description}
            </p>
          )}
        </div>
      </section>

      {/* Grupos */}
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
        {cat!.groups.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">📭</p>
            <p className="font-semibold mb-1">Aún no hay items en este catálogo</p>
          </div>
        ) : (
          cat!.groups.map((group) => (
            <section key={group.label} className="mb-10">
              <h2 className="font-display font-bold italic text-2xl md:text-3xl mb-4" style={{ color: '#0F0F0F' }}>
                {group.label}
              </h2>
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
                {group.items.map((it) => (
                  <article key={it.id} className="mb-4 break-inside-avoid bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-md transition-all">
                    {it.imageUrl ? (
                      <ZoomableImage
                        src={clImage(it.imageUrl, { w: 900, crop: 'limit' })}
                        full={clImage(it.imageUrl, { w: 1600, crop: 'limit' })}
                        alt={it.title}
                        className="w-full h-auto"
                      />
                    ) : (
                      <div className="w-full aspect-[4/3]" style={{ background: 'linear-gradient(135deg, #E8C04022, #FF4FA222)' }} />
                    )}
                    <div className="p-4">
                      <h3 className="font-bold text-base mb-1" style={{ color: '#0F0F0F' }}>{it.title}</h3>
                      {it.description && (
                        <p className="text-xs mb-3" style={{ color: '#6b4d5a' }}>{it.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs">
                        {it.extraPricePen != null && it.extraPricePen > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-semibold"
                            style={{ background: 'rgba(232,192,64,0.12)', color: '#C9A030' }}>
                            <Plus className="w-3 h-3" /> S/{it.extraPricePen}
                          </span>
                        )}
                        {it.extraMinutes != null && it.extraMinutes > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-semibold"
                            style={{ background: 'rgba(0,0,0,0.05)', color: '#6b4d5a' }}>
                            <Clock className="w-3 h-3" /> +{it.extraMinutes} min
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}

        <div className="mt-10 text-center">
          <Link href="/servicios"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #E8C040, #C9A030)', boxShadow: '0 4px 20px rgba(232,192,64,0.35)' }}>
            Ver servicios y paquetes
          </Link>
        </div>
      </div>
    </div>
  );
}
