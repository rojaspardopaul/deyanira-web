import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, Crown, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbsLd } from '@/lib/jsonld';
import { clImage } from '@/lib/cloudinary-client';
import CategoryFilterBar from '@/components/servicios/CategoryFilterBar';
import ServiceCard, { type ServiceCardData } from '@/components/servicios/ServiceCard';

type EventTypeSummary = {
  id: string;
  name: string;
  slug: string;
  tagline?: string | null;
  shortDesc?: string | null;
  heroImageUrl?: string | null;
  accentColor?: string | null;
  icon?: string | null;
  highlight?: boolean;
  packagesCount?: number;
  fromPricePen?: number;
};

export const metadata: Metadata = buildMetadata({
  title: 'Servicios de Belleza en Lima — Maquillaje, Uñas, Cabello, Cejas',
  description: 'Catálogo de servicios de belleza profesional en Lima: maquillaje (novia, social, artístico), uñas (acrílicas, gel, semipermanente), cabello (corte, balayage, keratina) y diseño de cejas. Precios desde S/ 30.',
  path: '/servicios',
  keywords: [
    'servicios de belleza Lima',
    'salón de belleza precios',
    'maquillaje novia Lima precio',
    'uñas acrílicas Lima',
    'manicure semipermanente Surco',
    'balayage Lima precio',
    'diseño de cejas Lima',
    'extensión de pestañas Lima',
  ],
});

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [services, categories, eventTypes, popular] = await Promise.all([
    api.services.list(category ? `category=${category}` : undefined).catch(() => []) as Promise<Record<string, unknown>[]>,
    api.services.categories().catch(() => []) as Promise<Record<string, unknown>[]>,
    api.eventTypes.list().catch(() => []) as Promise<EventTypeSummary[]>,
    api.services.popular(8).catch(() => []) as Promise<Record<string, unknown>[]>,
  ]);

  // Ids de los servicios más reservados → badge "POPULAR"
  const popularIds = new Set(popular.map((p) => p.id as string));

  return (
    <div className="min-h-screen pt-16" style={{ background: '#FAFAFA' }}>

      {/* Hero de sección */}
      <div className="relative overflow-hidden py-14 md:py-20 px-4" style={{ background: '#0F0F0F' }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(232,192,64,0.15) 0%, transparent 70%)' }} />
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(232,192,64,0.5), transparent)' }} />

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <p className="section-label mb-3" style={{ color: 'rgba(232,192,64,0.8)' }}>
            <Sparkles className="w-3.5 h-3.5 inline mr-1" /> Catálogo completo
          </p>
          <h1 className="font-display font-bold italic text-4xl md:text-5xl text-white mb-3">
            Nuestros <span style={{ color: '#E8C040' }}>Servicios</span>
          </h1>
          <p className="text-sm md:text-base max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Realizados con productos profesionales de alta calidad
          </p>
        </div>
      </div>

      {/* ── Eventos especiales (paquetes) ────────────────── */}
      {eventTypes.length > 0 && (
        <section className="py-12 md:py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between mb-6 md:mb-8 flex-wrap gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-1.5" style={{ color: '#E8C040' }}>
                  <Crown className="w-3.5 h-3.5 inline mr-1" /> Eventos especiales
                </p>
                <h2 className="font-display font-bold italic text-3xl md:text-4xl" style={{ color: '#0F0F0F' }}>
                  Paquetes para tu día más importante
                </h2>
                <p className="text-sm mt-2 max-w-xl" style={{ color: '#6b4d5a' }}>
                  Diseños pensados para novias, quinceañeras y momentos únicos. Maquillaje, peinado y uñas en un solo paquete.
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              {eventTypes.map((et) => {
                const accent = et.accentColor || '#E8C040';
                return (
                  <Link
                    key={et.id}
                    href={`/servicios/${et.slug}`}
                    className="group relative overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1"
                    style={{
                      background: '#0F0F0F',
                      border: `1px solid ${accent}33`,
                      boxShadow: `0 4px 32px ${accent}11`,
                      minHeight: 260,
                    }}
                  >
                    {et.heroImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={clImage(et.heroImageUrl, { w: 800, h: 520, crop: 'pad', background: 'auto:predominant' }) || et.heroImageUrl}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-55 transition-opacity duration-500"
                      />
                    )}
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(135deg, rgba(15,15,15,0.85) 0%, rgba(15,15,15,0.5) 50%, ${accent}22 100%)`,
                      }}
                    />
                    <div
                      className="absolute top-0 left-0 right-0 h-px"
                      style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
                    />
                    <div className="relative p-6 md:p-8 h-full flex flex-col justify-end" style={{ minHeight: 260 }}>
                      {et.icon && <div className="text-4xl mb-3">{et.icon}</div>}
                      <h3 className="font-display font-bold italic text-3xl md:text-4xl text-white mb-1.5 leading-tight">
                        {et.name}
                      </h3>
                      {et.tagline && (
                        <p className="text-sm italic mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
                          &ldquo;{et.tagline}&rdquo;
                        </p>
                      )}
                      {et.shortDesc && (
                        <p className="text-sm mb-5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
                          {et.shortDesc}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-baseline gap-2">
                          {et.fromPricePen != null && (
                            <>
                              <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                Desde
                              </span>
                              <span className="font-display font-bold text-2xl" style={{ color: accent }}>
                                S/{et.fromPricePen}
                              </span>
                            </>
                          )}
                          {et.packagesCount != null && et.packagesCount > 0 && (
                            <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                              · {et.packagesCount} paquete{et.packagesCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <span
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition-all duration-200 group-hover:gap-2.5"
                          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
                        >
                          Ver paquetes <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Catálogo individual — ancla para mantener la vista al filtrar */}
      <div id="catalogo" className="px-4 max-w-6xl mx-auto pb-2 pt-2 scroll-mt-20">
        <div className="flex items-end justify-between mb-2 flex-wrap gap-2">
          <h2 className="font-display font-bold italic text-2xl md:text-3xl" style={{ color: '#0F0F0F' }}>
            Servicios individuales
          </h2>
          <p className="text-xs" style={{ color: '#8a6a78' }}>
            ¿Solo necesitas un servicio? Reserva por separado.
          </p>
        </div>
      </div>

      {/* Filtros por categoría — fila deslizable de cards con icono (estilo app) */}
      <CategoryFilterBar
        categories={categories.map((c) => ({ id: c.id as string, name: c.name as string, slug: c.slug as string }))}
        active={category}
      />

      {/* Grid de servicios */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        {services.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">🔍</p>
            <p className="font-semibold text-lg mb-2" style={{ color: '#0F0F0F' }}>No hay servicios en esta categoría</p>
            <Link href="/servicios" className="text-sm font-medium transition-colors" style={{ color: '#E8C040' }}>
              Ver todos los servicios
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {services.map((service) => (
              <ServiceCard
                key={service.id as string}
                service={service as unknown as ServiceCardData}
                popular={popularIds.has(service.id as string)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="py-12 px-4 text-center" style={{ background: '#F5E6DA', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <p className="text-sm mb-4" style={{ color: '#8a6a78' }}>¿Tienes alguna duda sobre nuestros servicios?</p>
        <a
          href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, quiero consultar sobre sus servicios')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full font-semibold text-sm text-white transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
          style={{ background: '#25D366', boxShadow: '0 4px 20px rgba(37,211,102,0.35)' }}
        >
          💬 Consultar por WhatsApp
        </a>
      </div>
    </div>
  );
}
