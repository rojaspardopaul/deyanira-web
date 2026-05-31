import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, Clock, Star, ArrowRight, Award, CalendarCheck } from 'lucide-react';
import { api } from '@/lib/api';
import HeroCarousel from '@/components/home/HeroCarousel';
import LocationSection from '@/components/home/LocationSection';
import PopularServices, { type PopularService } from '@/components/home/PopularServices';
import FeaturedPackages, { type FeaturedPackage } from '@/components/home/FeaturedPackages';
import { JsonLd } from '@/components/seo/JsonLd';
import { beautySalonLd, faqLd } from '@/lib/jsonld';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Salón de Belleza en Lima — Maquillaje, Uñas, Cabello y Cejas',
  description: 'Deyanira Makeup Beauty: salón profesional en Surco, Lima. Maquillaje, uñas, cabello y cejas. Reserva tu cita online en 1 minuto con confirmación inmediata por WhatsApp.',
  path: '/',
});

// FAQs ricas — Google las muestra como rich snippets bajo el resultado
const HOME_FAQS = [
  { q: '¿Dónde queda Deyanira Makeup Beauty?',
    a: 'Estamos en Surco, Lima. Atendemos a clientas de Surco, San Borja, La Molina, Miraflores, San Isidro y todo Lima Metropolitana.' },
  { q: '¿Hacen servicios a domicilio en Lima?',
    a: 'Sí, ofrecemos maquillaje y peinado a domicilio en toda Lima Metropolitana con recargo por movilidad según distrito.' },
  { q: '¿Cuánto cuesta un maquillaje profesional?',
    a: 'Nuestros maquillajes profesionales van desde S/ 80 (maquillaje social) hasta S/ 300 (maquillaje de novia con prueba). Consulta cada servicio en la página de servicios.' },
  { q: '¿Cómo reservo una cita?',
    a: 'Puedes reservar online 24/7 desde la página de Reservar — elige servicio, estilista, fecha y hora. Recibes confirmación inmediata por email y WhatsApp.' },
  { q: '¿Qué métodos de pago aceptan?',
    a: 'Aceptamos efectivo, tarjeta de crédito/débito (Visa, MasterCard) vía Culqi y transferencias por Yape o Plin.' },
];

const SERVICE_CATEGORIES = [
  { icon: '💄', name: 'Maquillaje', slug: 'maquillaje', desc: 'Novia, social, artístico', color: 'rgba(255,79,162,0.12)', border: 'rgba(255,79,162,0.2)' },
  { icon: '💇', name: 'Cabello',    slug: 'cabello',    desc: 'Corte, tinte, peinado',     color: 'rgba(212,175,55,0.1)',  border: 'rgba(212,175,55,0.2)' },
  { icon: '💅', name: 'Uñas',      slug: 'unas',       desc: 'Acrílicas, semipermanente', color: 'rgba(255,79,162,0.09)', border: 'rgba(255,79,162,0.18)' },
  { icon: '✨', name: 'Cejas',     slug: 'cejas',      desc: 'Diseño, depilación, laminado', color: 'rgba(212,175,55,0.09)', border: 'rgba(212,175,55,0.18)' },
];

const REASONS = [
  { icon: Award,        title: 'Profesionales certificadas', desc: 'Equipo con formación profesional y años de experiencia en Lima.' },
  { icon: Sparkles,     title: 'Productos premium',          desc: 'Solo trabajamos con marcas profesionales para resultados duraderos.' },
  { icon: CalendarCheck, title: 'Agenda 24/7',               desc: 'Reserva tu cita cuando quieras, confirmación inmediata por WhatsApp.' },
];

const TESTIMONIALS = [
  { name: 'María G.', initials: 'MG', review: 'Quedé encantada con mi maquillaje de novia. ¡Profesionales de verdad!', stars: 5 },
  { name: 'Lucía R.', initials: 'LR', review: 'El diseño de cejas me cambió la cara. Muy precisas y atentas.', stars: 5 },
  { name: 'Carla M.', initials: 'CM', review: 'Reservé por la app y fue súper fácil. Llegué y me atendieron perfecto.', stars: 5 },
];

const STATS = [
  { value: '+500', label: 'Clientas satisfechas' },
  { value: '5★',   label: 'Calificación promedio' },
  { value: '+6',   label: 'Años de experiencia' },
  { value: '24/7', label: 'Reservas online' },
];

function SectionLabel({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p className="section-label" style={{ color: dark ? 'rgba(212,175,55,0.8)' : '#b8962e' }}>
      {children}
    </p>
  );
}

export default async function HomePage() {
  const [galleryPhotos, popularServices, eventTypes] = await Promise.all([
    api.gallery.list().catch(() => []) as Promise<Record<string, unknown>[]>,
    api.services.popular(6).catch(() => []) as Promise<PopularService[]>,
    api.eventTypes.list().catch(() => []) as Promise<FeaturedPackage[]>,
  ]);
  const preview = galleryPhotos.slice(0, 6);

  // Paquetes estrella (Novia / Quinceañera) — cards exclusivos arriba de "favoritas"
  const FEATURED_ORDER = ['novia', 'quinceanera'];
  const featuredPackages = FEATURED_ORDER
    .map((slug) => eventTypes.find((e) => e.slug === slug))
    .filter((e): e is FeaturedPackage => Boolean(e));

  return (
    <>
      <JsonLd data={[
        beautySalonLd({
          phone: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
          district: 'Surco',
          hoursWeekday: '9:00 - 19:00',
          hoursSaturday: '9:00 - 18:00',
          priceRange: 'S/ 30 - S/ 300',
          rating: { value: 5.0, count: 47 },
        }),
        faqLd(HOME_FAQS),
      ]} />

      {/* ── Hero ─────────────────────────────────────────── */}
      <HeroCarousel />

      {/* ── Stats ticker ─────────────────────────────────── */}
      <div style={{ background: '#0F0F0F', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto px-4 py-4 hidden md:grid grid-cols-4 divide-x divide-white/10">
          {STATS.map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center py-2 px-6">
              <span className="font-display font-bold text-2xl" style={{ color: '#D4AF37' }}>{value}</span>
              <span className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
            </div>
          ))}
        </div>
        {/* Mobile ticker */}
        <div className="md:hidden overflow-hidden py-3">
          <div className="flex animate-marquee whitespace-nowrap gap-12"
            style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className="flex items-center gap-12 shrink-0">
                <span className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <Sparkles className="w-3 h-3 shrink-0" style={{ color: '#D4AF37' }} /> Maquillaje Profesional
                </span>
                <span className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <Clock className="w-3 h-3 shrink-0" style={{ color: '#D4AF37' }} /> Agenda 24/7
                </span>
                <span className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <Star className="w-3 h-3 shrink-0" style={{ color: '#D4AF37' }} /> +500 Clientas
                </span>
                <span className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <Sparkles className="w-3 h-3 shrink-0" style={{ color: '#D4AF37' }} /> Envío a Lima
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Paquetes exclusivos (Novia / Quinceañera) ────── */}
      <FeaturedPackages packages={featuredPackages} />

      {/* ── Los más reservados ───────────────────────────── */}
      <PopularServices services={popularServices} />

      {/* ── Servicios ────────────────────────────────────── */}
      <section className="py-16 md:py-24 px-4" style={{ background: '#F5E6DA' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <SectionLabel>Nuestros servicios</SectionLabel>
            <h2 className="section-title-light mt-2 mb-3">
              Todo para tu <span style={{ color: '#b8962e' }}>Belleza</span>
            </h2>
            <p className="text-sm max-w-md mx-auto" style={{ color: '#8a6a78' }}>
              Servicios profesionales con productos de primera calidad
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {SERVICE_CATEGORIES.map((cat) => (
              <Link key={cat.slug} href={`/servicios?category=${cat.slug}`}
                className="group rounded-2xl p-5 md:p-7 text-center block transition-all duration-300 hover:-translate-y-2"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  border: `1px solid ${cat.border}`,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                }}>
                <span className="text-3xl md:text-4xl mb-3 md:mb-4 block group-hover:scale-115 transition-transform duration-300 group-hover:animate-float">
                  {cat.icon}
                </span>
                <h3 className="font-poppins font-bold text-sm md:text-base mb-1 transition-colors duration-200 group-hover:text-[#FF4FA2]"
                  style={{ color: '#0F0F0F' }}>
                  {cat.name}
                </h3>
                <p className="text-xs" style={{ color: '#b09aa5' }}>{cat.desc}</p>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/servicios" className="btn-outline inline-flex">
              Ver todos los servicios <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA Reservar ─────────────────────────────────── */}
      <section className="relative py-20 md:py-32 px-4 overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0F0F0F 0%, #1a0510 50%, #0F0F0F 100%)' }} />
        {/* Pink glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(255,79,162,0.18) 0%, transparent 70%)' }} />
        {/* Gold lines */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent)' }} />

        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-5" style={{ color: 'rgba(255,220,200,0.7)' }}>
            ¿Lista para brillar?
          </p>
          <h2 className="font-display font-bold italic text-4xl md:text-6xl text-white mb-5 leading-tight">
            Reserva tu cita<br />
            <span style={{ color: '#D4AF37' }}>hoy mismo</span>
          </h2>
          <p className="text-sm md:text-base mb-10 max-w-sm mx-auto" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Disponibilidad en tiempo real. Confirmación inmediata por WhatsApp.
          </p>
          <Link href="/reservar" className="btn-gold text-base px-10 py-4">
            <CalendarCheck className="w-5 h-5" />
            Reservar ahora
          </Link>
        </div>
      </section>

      {/* ── Galería preview ──────────────────────────────── */}
      <section className="py-16 md:py-24 px-4" style={{ background: '#FAFAFA' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <SectionLabel>Portafolio</SectionLabel>
            <h2 className="section-title-light mt-2 mb-3">
              Nuestros <span style={{ color: '#FF4FA2' }}>Trabajos</span>
            </h2>
            <p className="text-sm" style={{ color: '#8a6a78' }}>Transformaciones reales de nuestras clientas</p>
          </div>

          {preview.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {preview.map((photo, i) => (
                <div key={photo.id as string}
                  className="aspect-square rounded-2xl overflow-hidden group shadow-card relative">
                  <Image
                    src={photo.imageUrl as string}
                    alt={(photo.caption as string) || 'Trabajo de Deyanira Makeup Beauty'}
                    width={400} height={400}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    priority={i < 2}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <span className="text-white text-xs font-medium">{photo.caption as string || 'Ver trabajo'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {[
                { emoji: '💄', label: 'Maquillaje', bg: 'rgba(255,79,162,0.08)' },
                { emoji: '💇', label: 'Cabello',    bg: 'rgba(212,175,55,0.08)' },
                { emoji: '💅', label: 'Uñas',       bg: 'rgba(255,79,162,0.06)' },
                { emoji: '✨', label: 'Cejas',      bg: 'rgba(212,175,55,0.06)' },
                { emoji: '🌸', label: 'Novia',      bg: 'rgba(255,79,162,0.08)' },
                { emoji: '💖', label: 'Social',     bg: 'rgba(212,175,55,0.06)' },
              ].map(({ emoji, label, bg }, i) => (
                <div key={i}
                  className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-3 group transition-all duration-300 hover:-translate-y-2 hover:shadow-card-hover"
                  style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                  <span className="text-4xl md:text-5xl group-hover:scale-110 transition-transform duration-300">{emoji}</span>
                  <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#b8962e' }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-center mt-10">
            <Link href="/galeria" className="btn-outline inline-flex">
              Ver galería completa <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Por qué elegirnos ────────────────────────────── */}
      <section className="py-16 md:py-24 px-4" style={{ background: '#0F0F0F' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <SectionLabel dark>Nuestra diferencia</SectionLabel>
            <h2 className="section-title-dark mt-2">
              ¿Por qué <span style={{ color: '#FF4FA2' }}>elegirnos?</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {REASONS.map(({ icon: Icon, title, desc }) => (
              <div key={title}
                className="group rounded-2xl p-7 text-center transition-all duration-300 hover:-translate-y-2 cursor-default"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 transition-all duration-300 group-hover:scale-110"
                  style={{ background: 'linear-gradient(135deg, rgba(255,79,162,0.15), rgba(212,175,55,0.1))', border: '1px solid rgba(255,79,162,0.2)' }}>
                  <Icon className="w-6 h-6" style={{ color: '#FF4FA2' }} />
                </div>
                <h3 className="font-poppins font-bold text-base mb-3 text-white">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonios ──────────────────────────────────── */}
      <section className="py-16 md:py-24 px-4" style={{ background: '#F5E6DA' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <SectionLabel>Reseñas</SectionLabel>
            <h2 className="section-title-light mt-2">
              Lo que dicen nuestras <span style={{ color: '#b8962e' }}>clientas</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map(({ name, initials, review, stars }) => (
              <div key={name}
                className="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(0,0,0,0.07)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                }}>
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" style={{ color: '#D4AF37' }} />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-5 italic" style={{ color: '#6b4d5a' }}>
                  &ldquo;{review}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)' }}>
                    {initials}
                  </div>
                  <p className="font-semibold text-sm" style={{ color: '#0F0F0F' }}>{name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ubicación ─────────────────────────── */}
      <LocationSection />
    </>
  );
}
