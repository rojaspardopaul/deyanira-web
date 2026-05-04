import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Galería',
  description: 'Trabajos de maquillaje, cabello y uñas. Transformaciones reales en Deyanira Makeup Beauty.',
};

const CATEGORIES = [
  { slug: '', label: 'Todo' },
  { slug: 'maquillaje', label: 'Maquillaje' },
  { slug: 'cabello', label: 'Cabello' },
  { slug: 'unas', label: 'Uñas' },
  { slug: 'cejas', label: 'Cejas' },
];

export default async function GaleriaPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const photos = await api.gallery.list(category) as Record<string, unknown>[];

  return (
    <div className="min-h-screen bg-white pt-20">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="section-title">Galería</h1>
          <p className="text-gray-600">Transformaciones reales de nuestras clientas</p>
        </div>

        <div className="flex flex-wrap gap-3 justify-center mb-12">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={cat.slug ? `/galeria?category=${cat.slug}` : '/galeria'}
              className={`px-5 py-2 rounded-full text-sm font-medium border transition-colors ${
                (category || '') === cat.slug
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-gray-300 hover:border-primary-400'
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </div>

        <div className="columns-2 md:columns-3 gap-4">
          {photos.map((photo) => (
            <div key={photo.id as string} className="break-inside-avoid mb-4">
              <div className="relative overflow-hidden rounded-xl bg-gray-100">
                <Image
                  src={photo.imageUrl as string}
                  alt={(photo.caption as string) || 'Trabajo de Deyanira Makeup Beauty'}
                  width={400}
                  height={400}
                  className="w-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>
              {photo.caption && (
                <p className="text-sm text-gray-500 mt-2 px-1">{photo.caption as string}</p>
              )}
            </div>
          ))}
        </div>

        {photos.length === 0 && (
          <p className="text-center text-gray-500 py-20">La galería estará disponible pronto.</p>
        )}
      </div>
    </div>
  );
}
