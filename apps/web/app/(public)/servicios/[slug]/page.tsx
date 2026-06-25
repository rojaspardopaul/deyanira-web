import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Sparkles, ChevronLeft, Calendar, Phone, MapPin,
  Shield, Clock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { SimpleMarkdown } from '@/components/ui/SimpleMarkdown';
import PackagesComparison, { type Package } from '@/components/eventos/PackagesComparison';
import { focalImg } from '@/lib/cloudinary-client';

type EventTypeDetail = {
  id: string;
  name: string;
  slug: string;
  tagline?: string | null;
  shortDesc?: string | null;
  heroImageUrl?: string | null;
  accentColor?: string | null;
  icon?: string | null;
  presentationMd?: string | null;
  policiesMd?: string | null;
  packages: Package[];
  benefits: Array<{ id: string; title: string; description: string | null; icon: string | null }>;
  addons: Array<{ id: string; name: string; description: string | null; pricePen: number; icon: string | null; global: boolean }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const et = (await api.eventTypes.get(slug)) as EventTypeDetail;
    return buildMetadata({
      title: `${et.name} — Paquetes de belleza | Deyanira Makeup Beauty`,
      description: et.shortDesc || `Paquetes de ${et.name.toLowerCase()} en Lima — maquillaje, peinado y uñas con productos profesionales.`,
      path: `/servicios/${et.slug}`,
    });
  } catch {
    return buildMetadata({ title: 'Evento no encontrado', path: `/servicios/${slug}` });
  }
}

export default async function EventTypePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let et: EventTypeDetail;
  try {
    et = (await api.eventTypes.get(slug)) as EventTypeDetail;
  } catch {
    notFound();
  }

  const settings = await api.settings.public().catch(() => null) as { whatsapp?: string } | null;

  const accent = et!.accentColor || '#E8C040';
  const fromPrice = et!.packages.length > 0
    ? Math.min(...et!.packages.map((p) => p.pricePen))
    : null;

  // Portada: imagen a pantalla (object-cover) con foco editable desde el admin.
  const hero = et!.heroImageUrl ? focalImg(et!.heroImageUrl, 2000, '50% 32%') : null;

  return (
    <div className="min-h-screen" style={{ background: '#FAFAFA' }}>
      {/* ── Hero — portada alta con la imagen a pantalla y la presentación dentro ── */}
      <section
        className="relative overflow-hidden min-h-[92vh] flex flex-col justify-center px-4 py-24 md:py-28"
        style={{ background: '#0F0F0F' }}
      >
        {/* Imagen de fondo: cubre todo el alto; el foco se ajusta desde el admin */}
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero.src}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: hero.objectPosition }}
          />
        )}
        {/* Degradado para que el texto se lea sobre la imagen */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(15,15,15,0.30) 0%, rgba(15,15,15,0.45) 32%, rgba(15,15,15,0.62) 60%, rgba(15,15,15,0.95) 100%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 36%, ${accent}22 0%, transparent 60%)` }}
        />
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }} />

        <div
          className="relative z-10 max-w-3xl mx-auto text-center w-full"
          style={{ textShadow: '0 2px 16px rgba(0,0,0,0.55)' }}
        >
          <Link
            href="/servicios"
            className="inline-flex items-center gap-1 text-xs font-medium mb-6 transition-colors hover:text-white"
            style={{ color: 'rgba(255,255,255,0.75)' }}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Volver a servicios
          </Link>

          {et!.icon && (
            <div className="text-5xl md:text-6xl mb-3">{et!.icon}</div>
          )}

          <p
            className="text-xs md:text-sm uppercase tracking-[0.2em] font-semibold mb-3"
            style={{ color: accent }}
          >
            <Sparkles className="w-3.5 h-3.5 inline mr-1.5" /> Paquetes
          </p>

          <h1 className="font-display font-bold italic text-5xl md:text-7xl text-white mb-4 leading-tight">
            {et!.name}
          </h1>

          {et!.tagline && (
            <p className="font-display italic text-lg md:text-2xl mb-5" style={{ color: 'rgba(255,255,255,0.9)' }}>
              &ldquo;{et!.tagline}&rdquo;
            </p>
          )}

          {et!.shortDesc && (
            <p className="max-w-2xl mx-auto text-sm md:text-base mb-8" style={{ color: 'rgba(255,255,255,0.78)' }}>
              {et!.shortDesc}
            </p>
          )}

          {fromPrice !== null && (
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.10)', border: `1px solid ${accent}66`, backdropFilter: 'blur(4px)' }}>
              <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Desde
              </span>
              <span className="font-display font-bold text-2xl" style={{ color: accent }}>
                S/{fromPrice}
              </span>
            </div>
          )}

          {/* ── Presentación, dentro de la portada ── */}
          {et!.presentationMd && (
            <div
              className="mt-10 md:mt-14 pt-8 md:pt-10 border-t max-w-2xl mx-auto"
              style={{ borderColor: 'rgba(255,255,255,0.16)' }}
            >
              <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: accent }}>
                Presentación
              </p>
              <div style={{ color: 'rgba(255,255,255,0.92)' }}>
                <SimpleMarkdown className="text-sm md:text-base leading-relaxed">
                  {et!.presentationMd}
                </SimpleMarkdown>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Paquetes — cards + comparativa selectiva ──── */}
      <section id="paquetes" className="py-12 md:py-16 px-4 pb-24" style={{ background: '#fff', borderTop: '1px solid rgba(0,0,0,0.04)', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: accent }}>
              Elige tu paquete
            </p>
            <h2 className="font-display font-bold italic text-3xl md:text-5xl" style={{ color: '#0F0F0F' }}>
              Diseñados para ti
            </h2>
            <p className="text-sm md:text-base mt-3 max-w-xl mx-auto" style={{ color: '#6b4d5a' }}>
              Marca <strong>&ldquo;Comparar&rdquo;</strong> en los paquetes que te interesen para verlos lado a lado y elegir el ideal.
            </p>
          </div>

          <PackagesComparison packages={et!.packages} accent={accent} />
        </div>
      </section>

      {/* ── Ventajas / Beneficios ─────────────────────────── */}
      {et!.benefits.length > 0 && (
        <section className="py-12 md:py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: accent }}>
                Por qué elegirnos
              </p>
              <h2 className="font-display font-bold italic text-3xl md:text-4xl" style={{ color: '#0F0F0F' }}>
                Ventajas exclusivas
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {et!.benefits.map((b) => (
                <div
                  key={b.id}
                  className="p-5 rounded-2xl transition-all hover:-translate-y-1"
                  style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
                >
                  {b.icon && <div className="text-2xl mb-2">{b.icon}</div>}
                  <h3 className="font-bold text-sm mb-1.5" style={{ color: '#0F0F0F' }}>{b.title}</h3>
                  {b.description && (
                    <p className="text-xs leading-relaxed" style={{ color: '#6b4d5a' }}>{b.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Add-ons ──────────────────────────────────────── */}
      {et!.addons.length > 0 && (
        <section className="py-12 md:py-16 px-4" style={{ background: '#fff', borderTop: '1px solid rgba(0,0,0,0.04)', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: accent }}>
                Complementos
              </p>
              <h2 className="font-display font-bold italic text-3xl md:text-4xl" style={{ color: '#0F0F0F' }}>
                Add-ons disponibles
              </h2>
              <p className="text-sm mt-2" style={{ color: '#6b4d5a' }}>
                Personaliza tu paquete con servicios adicionales.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {et!.addons.map((a) => (
                <div
                  key={a.id}
                  className="p-5 rounded-2xl flex items-start gap-4"
                  style={{ background: '#FAFAFA', border: `1px solid ${accent}22` }}
                >
                  <div className="text-3xl shrink-0">{a.icon || '✨'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-bold text-base" style={{ color: '#0F0F0F' }}>{a.name}</h3>
                      <span className="font-display font-bold text-lg whitespace-nowrap" style={{ color: accent }}>
                        +S/{a.pricePen}
                      </span>
                    </div>
                    {a.description && (
                      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#6b4d5a' }}>{a.description}</p>
                    )}
                    {a.global && (
                      <span className="inline-block mt-2 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(0,0,0,0.05)', color: '#6b4d5a' }}>
                        Aplica a todos los servicios
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Datos a tomar en cuenta ──────────────────────── */}
      {et!.policiesMd && (
        <section className="py-12 md:py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: accent }}>
                Información importante
              </p>
              <h2 className="font-display font-bold italic text-3xl md:text-4xl" style={{ color: '#0F0F0F' }}>
                Datos a tomar en cuenta
              </h2>
            </div>
            <div className="rounded-2xl p-6 md:p-8" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }}>
              <SimpleMarkdown className="text-sm md:text-base" >
                {et!.policiesMd}
              </SimpleMarkdown>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 mt-6">
              <div className="flex items-center gap-2 p-3 rounded-xl text-xs" style={{ background: 'rgba(0,0,0,0.03)' }}>
                <Shield className="w-4 h-4" style={{ color: accent }} />
                <span style={{ color: '#3a2630' }}>Reserva con 50% de depósito</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl text-xs" style={{ background: 'rgba(0,0,0,0.03)' }}>
                <Clock className="w-4 h-4" style={{ color: accent }} />
                <span style={{ color: '#3a2630' }}>Prueba 10 días antes</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl text-xs" style={{ background: 'rgba(0,0,0,0.03)' }}>
                <MapPin className="w-4 h-4" style={{ color: accent }} />
                <span style={{ color: '#3a2630' }}>A domicilio en Cieneguilla</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── CTA final ────────────────────────────────────── */}
      <section className="py-14 px-4 text-center" style={{ background: '#0F0F0F' }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display font-bold italic text-3xl md:text-4xl text-white mb-3">
            ¿Lista para tu día especial?
          </h2>
          <p className="text-sm md:text-base mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Reserva tu fecha con un depósito del 50 %. Te confirmamos por WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="#paquetes"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm text-white transition-all hover:-translate-y-0.5"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, boxShadow: `0 6px 24px ${accent}55` }}
            >
              <Calendar className="w-4 h-4" /> Ver paquetes
            </Link>
            <a
              href={`https://wa.me/${(settings?.whatsapp || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, quiero consultar sobre los paquetes de ${et!.name}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold text-sm text-white transition-all hover:-translate-y-0.5"
              style={{ background: '#25D366', boxShadow: '0 4px 20px rgba(37,211,102,0.35)' }}
            >
              <Phone className="w-4 h-4" /> Consultar por WhatsApp
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
