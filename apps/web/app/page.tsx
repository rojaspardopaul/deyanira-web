import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Salón de Belleza Profesional en Lima, Perú',
  description:
    'Deyanira Makeup Beauty: maquillaje, cabello, uñas y cejas en Lima. Agenda tu cita online con descuentos exclusivos.',
};

// Schema.org LocalBusiness — importante para SEO local en Lima
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

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-pink-100 overflow-hidden">
        <div className="relative z-10 text-center px-4 py-20 max-w-3xl mx-auto">
          <p className="text-primary-600 font-semibold uppercase tracking-widest text-sm mb-4">
            Salón Profesional en Lima, Perú
          </p>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-gray-900 mb-6 leading-tight">
            Tu belleza,<br />
            <span className="text-primary-600">nuestra pasión</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-xl mx-auto">
            Maquillaje profesional, cabello, uñas y cejas.
            Agenda tu cita online y luce espectacular.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/reservar" className="btn-primary text-lg px-8 py-4">
              Reserva tu cita
            </Link>
            <Link href="/servicios" className="btn-outline text-lg px-8 py-4">
              Ver servicios
            </Link>
          </div>
        </div>
      </section>

      {/* ── Servicios destacados ──────────────────────────── */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-primary-600 font-semibold uppercase tracking-widest text-sm mb-3">
            Nuestros servicios
          </p>
          <h2 className="section-title">Todo para tu belleza</h2>
          <p className="section-subtitle text-center">
            Servicios profesionales con productos de primera calidad
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
            {[
              { icon: '💄', name: 'Maquillaje', slug: 'maquillaje' },
              { icon: '💇', name: 'Cabello', slug: 'cabello' },
              { icon: '💅', name: 'Uñas', slug: 'unas' },
              { icon: '✨', name: 'Cejas', slug: 'cejas' },
            ].map((cat) => (
              <Link
                key={cat.slug}
                href={`/servicios?category=${cat.slug}`}
                className="card p-8 text-center hover:border-primary-200 group"
              >
                <span className="text-5xl mb-4 block">{cat.icon}</span>
                <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                  {cat.name}
                </h3>
              </Link>
            ))}
          </div>
          <Link href="/servicios" className="btn-primary mt-12 inline-flex">
            Ver todos los servicios
          </Link>
        </div>
      </section>

      {/* ── CTA Reservar ─────────────────────────────────── */}
      <section className="py-24 px-4 bg-primary-600 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-display font-bold mb-6">
            ¿Lista para verte increíble?
          </h2>
          <p className="text-primary-100 text-lg mb-10">
            Agenda tu cita en minutos. Disponibilidad en tiempo real.
          </p>
          <Link
            href="/reservar"
            className="inline-flex items-center px-10 py-4 bg-white text-primary-600 font-bold rounded-full text-lg hover:bg-primary-50 transition-colors"
          >
            Reservar ahora
          </Link>
        </div>
      </section>

      {/* ── Galería preview ──────────────────────────────── */}
      <section className="py-24 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="section-title">Nuestros trabajos</h2>
          <p className="section-subtitle">
            Transformaciones reales de nuestras clientas
          </p>
          {/* Grid de galería — se carga dinámicamente */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-primary-100 rounded-2xl animate-pulse"
              />
            ))}
          </div>
          <Link href="/galeria" className="btn-outline mt-10 inline-flex">
            Ver galería completa
          </Link>
        </div>
      </section>

      {/* ── Por qué elegirnos ────────────────────────────── */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="section-title">¿Por qué elegirnos?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '🎓', title: 'Profesionales certificados', desc: 'Equipo con formación profesional y años de experiencia.' },
              { icon: '✨', title: 'Productos premium', desc: 'Utilizamos solo productos de alta calidad para los mejores resultados.' },
              { icon: '📅', title: 'Agenda online 24/7', desc: 'Reserva tu cita cuando quieras, desde donde estés.' },
            ].map((item) => (
              <div key={item.title} className="text-center p-8">
                <span className="text-5xl mb-6 block">{item.icon}</span>
                <h3 className="text-xl font-display font-bold mb-3">{item.title}</h3>
                <p className="text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
