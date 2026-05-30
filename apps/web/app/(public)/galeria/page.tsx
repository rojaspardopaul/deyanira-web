import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import GalleryGrid from '@/components/gallery/GalleryGrid';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Galería de Trabajos — Maquillaje, Uñas y Cabello en Lima',
  description: 'Portafolio real de trabajos: maquillaje de novia, looks sociales, uñas decoradas, balayage y diseño de cejas en Deyanira Makeup Beauty, Surco - Lima.',
  path: '/galeria',
  keywords: [
    'galería maquillaje Lima',
    'fotos uñas Lima',
    'trabajos balayage Lima',
    'portafolio salón belleza',
    'maquillaje novia fotos Lima',
  ],
});

const CATEGORIES = [
  { slug: '', label: '✦ Todo' },
  { slug: 'maquillaje', label: '💄 Maquillaje' },
  { slug: 'cabello', label: '💇 Cabello' },
  { slug: 'unas', label: '💅 Uñas' },
  { slug: 'cejas', label: '✨ Cejas' },
];

export default async function GaleriaPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const photos = await api.gallery
    .list(category)
    .catch(() => []) as { id: string; imageUrl: string; caption?: string | null; category?: string | null }[];

  return (
    <div className="min-h-screen bg-white pt-16">

      {/* Hero */}
      <div className="bg-gradient-to-br from-primary-50 via-white to-amber-50 border-b border-gray-100 px-4 py-10 text-center">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900 mb-2">
          Nuestros trabajos
        </h1>
        <p className="text-gray-500">
          Transformaciones reales de nuestras clientas en Lima
        </p>
      </div>

      {/* Category filter — horizontal scroll on mobile */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-3">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={cat.slug ? `/galeria?category=${cat.slug}` : '/galeria'}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                  (category || '') === cat.slug
                    ? 'bg-primary-400 text-gray-900 border-primary-400'
                    : 'border-gray-200 text-gray-600 hover:border-primary-400 bg-white'
                }`}
              >
                {cat.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <GalleryGrid photos={photos} />
      </div>

      {/* Bottom CTA */}
      {photos.length > 0 && (
        <div className="bg-primary-50 border-t border-primary-100 px-4 py-10 text-center">
          <p className="text-gray-600 mb-3">¿Te gustó lo que ves? ¡Agenda tu cita!</p>
          <Link
            href="/reservar"
            className="btn-primary inline-flex"
          >
            Reservar mi cita
          </Link>
        </div>
      )}
    </div>
  );
}
