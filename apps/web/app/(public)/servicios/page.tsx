import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, Crown, ArrowRight, Star, Clock, Flame, Heart, CalendarCheck, ShieldCheck, Quote } from 'lucide-react';
import { api } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { focalImg, clImage } from '@/lib/cloudinary-client';
import { type ServiceCardData } from '@/components/servicios/ServiceCard';
import ServicesCatalog from '@/components/servicios/ServicesCatalog';
import Reveal from '@/components/ui/Reveal';

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

type Svc = {
  id: string;
  name: string;
  description?: string | null;
  duration: number;
  pricePen: number | string;
  comparePricePen?: number | string | null;
  imageUrl?: string | null;
  category?: { name?: string | null; slug?: string | null } | null;
};

type GalleryItem = { imageUrl: string; category?: string | null; caption?: string | null };

export const metadata: Metadata = buildMetadata({
  title: 'Servicios de Belleza en Lima — Maquillaje, Uñas, Cabello, Cejas',
  description: 'Catálogo de servicios de belleza profesional en Lima: maquillaje (novia, social, artístico), uñas (acrílicas, gel, semipermanente), cabello (corte, balayage, keratina) y diseño de cejas. Precios desde S/ 30.',
  path: '/servicios',
  keywords: [
    'servicios de belleza Lima',
    'salón de belleza precios',
    'maquillaje novia Lima precio',
    'uñas acrílicas Lima',
    'manicure semipermanente Cieneguilla',
    'balayage Lima precio',
    'diseño de cejas Lima',
    'extensión de pestañas Lima',
  ],
});

const TRUST = [
  { icon: Star, value: '4.9', label: 'Valoración promedio' },
  { icon: Heart, value: '+500', label: 'Clientas felices' },
  { icon: Crown, value: '5+', label: 'Años de experiencia' },
  { icon: CalendarCheck, value: 'Online', label: 'Reserva inmediata' },
];

const FEATURED_BADGES = [
  { icon: Flame, label: 'Más solicitado', cls: 'bg-rose-500/90' },
  { icon: Star, label: 'Recomendado', cls: 'bg-gold-500/90' },
  { icon: Heart, label: 'Favorito de clientas', cls: 'bg-primary-500/90' },
  { icon: Star, label: 'Recomendado', cls: 'bg-gold-500/90' },
];

const TESTIMONIALS = [
  { name: 'Andrea M.', tag: 'Maquillaje de novia', text: 'El maquillaje quedó exactamente como soñaba para mi boda. Duró impecable toda la noche.' },
  { name: 'Camila R.', tag: 'Balayage', text: 'Excelente atención y resultados impecables. Mi cabello nunca se vio tan natural y luminoso.' },
  { name: 'Lucía V.', tag: 'Uñas acrílicas', text: 'Súper profesionales y detallistas. Salí encantada, ya soy clienta fija del salón.' },
];

const money = (n: unknown) => `S/${Number(n || 0).toFixed(0)}`;

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [services, categories, eventTypes, popular, gallery, settings] = await Promise.all([
    api.services.list(category ? `category=${category}` : undefined).catch(() => []) as Promise<Record<string, unknown>[]>,
    api.services.categories().catch(() => []) as Promise<Record<string, unknown>[]>,
    api.eventTypes.list().catch(() => []) as Promise<EventTypeSummary[]>,
    api.services.popular(8).catch(() => []) as Promise<Record<string, unknown>[]>,
    api.gallery.list().catch(() => []) as Promise<GalleryItem[]>,
    api.settings.public().catch(() => null) as Promise<{ whatsapp?: string } | null>,
  ]);

  const popularIds = new Set(popular.map((p) => p.id as string));
  const featured = (popular as unknown as Svc[]).slice(0, 4);
  const galleryImgs = (gallery || [])
    .filter((g) => g.imageUrl && !/\/video\/upload\/|\.(mp4|webm|mov)(\?|$)/i.test(g.imageUrl))
    .slice(0, 8);
  const whatsapp = (settings?.whatsapp || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');

  return (
    <div className="min-h-screen pt-16" style={{ background: '#FCFAF7' }}>

      {/* ── SECCIÓN 1 · Hero ─────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-16 md:py-24" style={{ background: 'linear-gradient(180deg,#FCFAF7 0%,#F6EEE6 100%)' }}>
        <div className="pointer-events-none absolute -top-20 right-0 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-50" style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.20), transparent 70%)' }} />
        <div className="pointer-events-none absolute -bottom-24 -left-20 w-[26rem] h-[26rem] rounded-full blur-3xl opacity-40" style={{ background: 'radial-gradient(circle, rgba(219,39,119,0.12), transparent 70%)' }} />

        <div className="relative max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-600 bg-white/70 ring-1 ring-gold-200 px-3 py-1.5 rounded-full mb-5">
            <Sparkles className="w-3.5 h-3.5" /> Belleza redefinida
          </span>
          <h1 className="font-display font-bold text-4xl md:text-6xl text-gray-900 leading-[1.05] mb-5">
            Realza tu belleza con <span className="text-primary-600">profesionales certificadas</span>
          </h1>
          <p className="text-base md:text-lg text-gray-500 leading-relaxed max-w-2xl mx-auto mb-8">
            Maquillaje, peinados, uñas y tratamientos diseñados para resaltar tu mejor versión.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/reservar" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-sm text-white bg-primary-600 hover:bg-primary-500 active:scale-95 transition-all shadow-lg shadow-primary-500/25">
              <CalendarCheck className="w-4 h-4" /> Reservar cita
            </Link>
            <a href="#catalogo" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-sm text-gray-800 bg-white ring-1 ring-black/10 hover:ring-gold-300 hover:-translate-y-0.5 transition-all">
              Ver servicios <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Indicadores de confianza */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
            {TRUST.map(({ icon: Icon, value, label }) => (
              <div key={label} className="rounded-2xl bg-white/80 backdrop-blur-sm ring-1 ring-black/5 px-3 py-4 flex flex-col items-center gap-1">
                <Icon className="w-4 h-4 text-gold-500" />
                <p className="font-display font-bold text-lg text-gray-900 leading-none">{value}</p>
                <p className="text-[10.5px] text-gray-500 text-center leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 2 · Servicios más reservados ─────────────────── */}
      {featured.length > 0 && (
        <section className="px-4 py-14 md:py-20">
          <div className="max-w-6xl mx-auto">
            <Reveal className="text-center max-w-xl mx-auto mb-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-600 mb-2">Los favoritos</p>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-gray-900">Servicios más reservados</h2>
              <p className="text-gray-500 mt-2">Los preferidos de nuestras clientas, listos para reservar.</p>
            </Reveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {featured.map((s, i) => {
                const im = s.imageUrl ? focalImg(s.imageUrl, 600) : null;
                const badge = FEATURED_BADGES[i] || FEATURED_BADGES[1];
                const BadgeIcon = badge.icon;
                return (
                  <Reveal key={s.id} delay={i * 80}>
                    <Link
                      href={`/reservar?service=${s.id}`}
                      className="group flex flex-col h-full rounded-3xl overflow-hidden bg-white ring-1 ring-black/5 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-amber-50 to-primary-50">
                        {im ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={im.src} alt={s.name} loading="lazy" style={{ objectPosition: im.objectPosition }} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-4xl">✨</div>
                        )}
                        <span className={`absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white backdrop-blur-sm ${badge.cls}`}>
                          <BadgeIcon className="w-3 h-3" /> {badge.label}
                        </span>
                      </div>
                      <div className="p-4 flex flex-col flex-1">
                        {s.category?.name && (
                          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-gold-600 mb-1">{s.category.name}</span>
                        )}
                        <h3 className="font-display font-bold text-lg text-gray-900 leading-tight">{s.name}</h3>
                        {s.description && (
                          <p className="text-[13px] text-gray-500 leading-relaxed mt-1.5 line-clamp-2">{s.description}</p>
                        )}
                        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-gray-500">
                          <Clock className="w-3.5 h-3.5 text-gold-500" /> {s.duration} min
                        </div>
                        <div className="mt-3 pt-3 border-t border-black/5 flex items-end justify-between gap-2">
                          <div className="flex flex-col leading-none">
                            <span className="text-[10px] uppercase tracking-wide text-gray-400">Desde</span>
                            <span className="font-display font-extrabold text-xl text-gray-900 mt-0.5">{money(s.pricePen)}</span>
                          </div>
                          <span className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-xs font-bold text-white bg-primary-600 group-hover:bg-primary-500 transition-colors">
                            Reservar <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── SECCIÓN 3 · Paquetes especiales (banners con imagen protagonista) ── */}
      {eventTypes.length > 0 && (
        <section className="px-4 py-14 md:py-20" style={{ background: 'linear-gradient(180deg,#F6EEE6 0%,#FCFAF7 100%)' }}>
          <div className="max-w-6xl mx-auto">
            <Reveal className="text-center max-w-xl mx-auto mb-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-600 mb-2">
                <Crown className="w-3.5 h-3.5 inline mr-1" /> Eventos especiales
              </p>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-gray-900">Paquetes para tu día más importante</h2>
              <p className="text-gray-500 mt-2">Maquillaje, peinado y uñas en un solo paquete pensado para novias, quinceañeras y momentos únicos.</p>
            </Reveal>

            <div className="grid md:grid-cols-2 gap-6">
              {eventTypes.map((et, i) => {
                const accent = et.accentColor || '#C9A030';
                const im = et.heroImageUrl ? focalImg(et.heroImageUrl, 1000) : null;
                return (
                  <Reveal key={et.id} delay={i * 90}>
                    <Link
                      href={`/servicios/${et.slug}`}
                      className="group relative block overflow-hidden rounded-[28px] shadow-lg hover:-translate-y-1 hover:shadow-2xl transition-all duration-300"
                      style={{ minHeight: 340 }}
                    >
                      {im ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={im.src} alt={et.name} loading="lazy" style={{ objectPosition: im.objectPosition }} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, #1a1014, ${accent})` }} />
                      )}
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,6,9,0.92) 0%, rgba(10,6,9,0.45) 45%, rgba(10,6,9,0.15) 100%)' }} />
                      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

                      <div className="relative h-full flex flex-col justify-end p-7 md:p-9" style={{ minHeight: 340 }}>
                        {et.icon && <div className="text-4xl mb-2 drop-shadow">{et.icon}</div>}
                        <h3 className="font-display font-bold italic text-3xl md:text-4xl text-white leading-tight" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
                          {et.name}
                        </h3>
                        {et.tagline && <p className="text-sm italic text-white/80 mt-1">&ldquo;{et.tagline}&rdquo;</p>}
                        {et.shortDesc && <p className="text-sm text-white/70 mt-2 line-clamp-2 max-w-md">{et.shortDesc}</p>}
                        <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-baseline gap-2">
                            {et.fromPricePen != null && (
                              <>
                                <span className="text-[11px] uppercase tracking-wider font-semibold text-white/60">Desde</span>
                                <span className="font-display font-bold text-2xl" style={{ color: '#F4D58A' }}>S/{et.fromPricePen}</span>
                              </>
                            )}
                            {et.packagesCount ? (
                              <span className="text-xs text-white/55 ml-1">· {et.packagesCount} paquete{et.packagesCount !== 1 ? 's' : ''}</span>
                            ) : null}
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold text-gray-900 bg-white group-hover:gap-2.5 transition-all">
                            Ver paquetes <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── SECCIÓN 4 · Catálogo completo ────────────────────────── */}
      <div id="catalogo" className="px-4 max-w-6xl mx-auto pt-14 md:pt-20 pb-2 scroll-mt-20">
        <Reveal className="text-center max-w-xl mx-auto mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-600 mb-2">Catálogo completo</p>
          <h2 className="font-display font-bold text-3xl md:text-4xl text-gray-900">Explora todos nuestros servicios</h2>
          <p className="text-gray-500 mt-2">Filtra por categoría y reserva el que más te guste.</p>
        </Reveal>
      </div>

      <ServicesCatalog
        services={services as unknown as ServiceCardData[]}
        popularIds={Array.from(popularIds)}
        categories={categories.map((c) => ({ id: c.id as string, name: c.name as string, slug: c.slug as string }))}
        active={category}
      />

      {/* ── SECCIÓN 5 · Galería de resultados ────────────────────── */}
      {galleryImgs.length >= 3 && (
        <section className="px-4 py-14 md:py-20" style={{ background: '#F6EEE6' }}>
          <div className="max-w-6xl mx-auto">
            <Reveal className="text-center max-w-xl mx-auto mb-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-600 mb-2">Resultados reales</p>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-gray-900">Trabajos que hablan por nosotras</h2>
              <p className="text-gray-500 mt-2">Una muestra de transformaciones reales de nuestras clientas.</p>
            </Reveal>
            <Reveal>
              <div className="columns-2 md:columns-3 lg:columns-4 gap-3 md:gap-4">
                {galleryImgs.map((g, i) => (
                  <div key={i} className="mb-3 md:mb-4 break-inside-avoid overflow-hidden rounded-2xl ring-1 ring-black/5 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={clImage(g.imageUrl, { w: 600, crop: 'limit' }) || g.imageUrl}
                      alt={g.caption || 'Resultado'}
                      loading="lazy"
                      className="w-full h-auto object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  </div>
                ))}
              </div>
            </Reveal>
            <div className="text-center mt-8">
              <Link href="/galeria" className="inline-flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700">
                Ver galería completa <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── SECCIÓN 6 · Opiniones ────────────────────────────────── */}
      <section className="px-4 py-14 md:py-20">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center max-w-xl mx-auto mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-600 mb-2">Lo que dicen</p>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-gray-900">Opiniones reales de clientas</h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 90}>
                <figure className="h-full flex flex-col rounded-3xl bg-white ring-1 ring-black/5 shadow-sm p-6">
                  <Quote className="w-7 h-7 text-gold-300" />
                  <div className="flex gap-0.5 mt-3 mb-3 text-gold-500">
                    {Array.from({ length: 5 }).map((_, j) => <Star key={j} className="w-4 h-4 fill-current" />)}
                  </div>
                  <blockquote className="text-gray-600 leading-relaxed text-[15px] flex-1">&ldquo;{t.text}&rdquo;</blockquote>
                  <figcaption className="mt-4 pt-4 border-t border-black/5">
                    <p className="font-display font-bold text-gray-900">{t.name}</p>
                    <p className="text-xs text-primary-600 font-semibold">{t.tag}</p>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 7 · CTA final ────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-20 md:py-28" style={{ background: 'linear-gradient(135deg,#1a1014 0%,#2a0f22 60%,#3a2218 100%)' }}>
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.18), transparent 60%)' }} />
        <div className="relative max-w-2xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300 bg-white/10 ring-1 ring-gold-300/30 px-3 py-1.5 rounded-full mb-5">
            <ShieldCheck className="w-3.5 h-3.5" /> Especialistas certificadas
          </span>
          <h2 className="font-display font-bold text-3xl md:text-5xl text-white leading-tight mb-4">
            ¿Lista para resaltar tu belleza?
          </h2>
          <p className="text-white/70 mb-9 max-w-lg mx-auto">
            Reserva tu cita y déjate atender por especialistas que cuidan cada detalle de tu transformación.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/reservar" className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base text-gray-900 bg-gradient-to-r from-gold-300 to-gold-400 hover:to-gold-500 active:scale-95 transition-all shadow-xl">
              <CalendarCheck className="w-5 h-5" /> Reservar ahora
            </Link>
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('Hola, quiero consultar sobre sus servicios')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-full font-semibold text-sm text-white bg-white/10 ring-1 ring-white/20 hover:bg-white/15 transition-all"
              >
                💬 Consultar por WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
