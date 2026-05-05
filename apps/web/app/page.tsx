import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Salón de Belleza Profesional en Lima, Perú',
  description:
    'Deyanira Makeup Beauty: maquillaje, cabello, uñas y cejas en Lima. Agenda tu cita online y luce increíble.',
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'BeautySalon',
  name: 'Deyanira Makeup Beauty',
  url: 'https://deyanira.pe',
  telephone: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Lima',
    addressCountry: 'PE',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: -12.1109913,
    longitude: -76.8182017,
  },
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday'], opens: '09:00', closes: '19:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '09:00', closes: '17:00' },
  ],
  priceRange: 'S/S/',
  currenciesAccepted: 'PEN',
};

const SERVICE_CATEGORIES = [
  { icon: '💄', name: 'Maquillaje', slug: 'maquillaje', desc: 'Novia, social, artístico' },
  { icon: '💇', name: 'Cabello', slug: 'cabello', desc: 'Corte, tinte, peinado' },
  { icon: '💅', name: 'Uñas', slug: 'unas', desc: 'Acrílicas, semipermanente' },
  { icon: '✨', name: 'Cejas', slug: 'cejas', desc: 'Diseño, depilación, laminado' },
];

const REASONS = [
  { icon: '🎓', title: 'Profesionales certificadas', desc: 'Equipo con formación profesional y años de experiencia en Lima.' },
  { icon: '✨', title: 'Productos premium', desc: 'Solo trabajamos con marcas profesionales para garantizar resultados duraderos.' },
  { icon: '📅', title: 'Agenda 24/7', desc: 'Reserva tu cita cuando quieras, confirmación inmediata por WhatsApp.' },
];

export default async function HomePage() {
  // Fetch gallery preview — si la API no responde, mostramos alternativa
  const galleryPhotos = await api.gallery
    .list()
    .catch(() => []) as Record<string, unknown>[];
  const preview = galleryPhotos.slice(0, 6);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative min-h-[100svh] flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-pink-50 overflow-hidden pt-16">
        {/* Decorative blobs */}
        <div className="absolute top-20 -left-20 w-72 h-72 bg-primary-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
        <div className="absolute bottom-20 -right-10 w-56 h-56 bg-pink-100 rounded-full blur-3xl opacity-60 pointer-events-none" />

        <div className="relative z-10 text-center px-5 py-16 max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 bg-primary-50 border border-primary-100 text-primary-700 text-xs font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
            ✦ Salón Profesional en Lima, Perú
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-display font-bold text-gray-900 mb-5 leading-tight">
            Tu belleza,<br />
            <span className="text-primary-600">nuestra pasión</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-lg mx-auto leading-relaxed">
            Maquillaje profesional, cabello, uñas y cejas.<br className="hidden sm:block" />
            Agenda tu cita en línea y luce espectacular.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/reservar" className="btn-primary text-base px-8 py-4 shadow-lg shadow-primary-200">
              Reserva tu cita
            </Link>
            <Link href="/servicios" className="btn-outline text-base px-8 py-4">
              Ver servicios
            </Link>
          </div>
          {/* Social proof */}
          <p className="mt-8 text-sm text-gray-500">
            ⭐⭐⭐⭐⭐ &nbsp;+500 clientas felices en Lima
          </p>
        </div>
      </section>

      {/* ── Categorías de servicios ───────────────────────── */}
      <section className="py-16 md:py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-primary-600 font-semibold uppercase tracking-widest text-xs mb-2">
              Nuestros servicios
            </p>
            <h2 className="section-title">Todo para tu belleza</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Servicios profesionales con productos de primera calidad
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {SERVICE_CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/servicios?category=${cat.slug}`}
                className="group card p-6 text-center hover:border-primary-200 hover:-translate-y-1 transition-all duration-200 active:scale-[0.98]"
              >
                <span className="text-4xl mb-3 block">{cat.icon}</span>
                <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors mb-1">
                  {cat.name}
                </h3>
                <p className="text-xs text-gray-500">{cat.desc}</p>
              </Link>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/servicios" className="btn-primary">
              Ver todos los servicios
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA Reservar ─────────────────────────────────── */}
      <section className="py-16 md:py-20 px-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-primary-200 text-sm font-semibold uppercase tracking-widest mb-3">¿Lista?</p>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            ¿Lista para verte increíble?
          </h2>
          <p className="text-primary-100 text-lg mb-8">
            Agenda tu cita en minutos. Disponibilidad en tiempo real.
          </p>
          <Link
            href="/reservar"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-700 font-bold rounded-full text-base hover:bg-primary-50 active:scale-95 transition-all shadow-xl shadow-primary-900/20"
          >
            Reservar ahora →
          </Link>
        </div>
      </section>

      {/* ── Galería preview ──────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="section-title">Nuestros trabajos</h2>
            <p className="text-gray-500">Transformaciones reales de nuestras clientas</p>
          </div>

          {preview.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {preview.map((photo, i) => (
                <div
                  key={photo.id as string}
                  className="aspect-square rounded-2xl overflow-hidden bg-gray-200 group"
                >
                  <Image
                    src={photo.imageUrl as string}
                    alt={(photo.caption as string) || 'Trabajo de Deyanira Makeup Beauty'}
                    width={400}
                    height={400}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    priority={i < 2}
                  />
                </div>
              ))}
            </div>
          ) : (
            /* Si no hay fotos aún, mostrar placeholder elegante */
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-2xl flex items-center justify-center text-3xl ${
                    ['bg-primary-100', 'bg-pink-100', 'bg-rose-100', 'bg-primary-200', 'bg-pink-200', 'bg-rose-200'][i]
                  }`}
                >
                  {['💄', '💇', '💅', '✨', '🌸', '💖'][i]}
                </div>
              ))}
            </div>
          )}

          <div className="text-center mt-8">
            <Link href="/galeria" className="btn-outline">
              Ver galería completa
            </Link>
          </div>
        </div>
      </section>

      {/* ── Por qué elegirnos ────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="section-title">¿Por qué elegirnos?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {REASONS.map((item) => (
              <div
                key={item.title}
                className="text-center p-8 rounded-2xl bg-gray-50 hover:bg-primary-50 transition-colors duration-200"
              >
                <span className="text-5xl mb-4 block">{item.icon}</span>
                <h3 className="text-lg font-display font-bold mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonios ──────────────────────────────────── */}
      <section className="py-16 md:py-20 px-4 bg-primary-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="section-title">Lo que dicen nuestras clientas</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: 'María G.', review: 'Quedé encantada con mi maquillaje de novia. ¡Profesionales de verdad!', stars: 5 },
              { name: 'Lucía R.', review: 'El diseño de cejas me cambió la cara. Muy precisas y atentas.', stars: 5 },
              { name: 'Carla M.', review: 'Reservé por la app y fue súper fácil. Llegué y me atendieron perfecto.', stars: 5 },
            ].map(({ name, review, stars }) => (
              <div key={name} className="card p-6">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: stars }).map((_, i) => (
                    <span key={i} className="text-yellow-400 text-lg">★</span>
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-4">&ldquo;{review}&rdquo;</p>
                <p className="font-semibold text-sm text-gray-900">{name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
