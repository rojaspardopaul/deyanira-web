import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Servicios',
  description: 'Catálogo completo de servicios: maquillaje, cabello, uñas y cejas. Precios y duración.',
};

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [services, categories] = await Promise.all([
    api.services.list(category ? `category=${category}` : undefined) as Promise<Record<string, unknown>[]>,
    api.services.categories() as Promise<Record<string, unknown>[]>,
  ]);

  return (
    <div className="min-h-screen bg-white pt-20">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="section-title">Nuestros Servicios</h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Todos nuestros servicios se realizan con productos profesionales de alta calidad.
          </p>
        </div>

        {/* Filtros por categoría */}
        <div className="flex flex-wrap gap-3 justify-center mb-12">
          <Link
            href="/servicios"
            className={`px-5 py-2 rounded-full text-sm font-medium border transition-colors ${
              !category ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 hover:border-primary-400'
            }`}
          >
            Todos
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id as string}
              href={`/servicios?category=${cat.slug}`}
              className={`px-5 py-2 rounded-full text-sm font-medium border transition-colors ${
                category === cat.slug
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-gray-300 hover:border-primary-400'
              }`}
            >
              {cat.name as string}
            </Link>
          ))}
        </div>

        {/* Grid de servicios */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div key={service.id as string} className="card p-6 flex flex-col">
              <div className="flex-1">
                <h3 className="font-display font-bold text-xl mb-2">{service.name as string}</h3>
                {service.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {service.description as string}
                  </p>
                )}
                <p className="text-sm text-gray-500">{service.duration as number} minutos</p>
              </div>
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                <span className="text-2xl font-bold text-primary-600">
                  S/ {Number(service.pricePen).toFixed(2)}
                </span>
                <Link
                  href={`/reservar?service=${service.id}`}
                  className="btn-primary text-sm px-4 py-2"
                >
                  Reservar
                </Link>
              </div>
            </div>
          ))}
        </div>

        {services.length === 0 && (
          <p className="text-center text-gray-500 py-20">No hay servicios en esta categoría.</p>
        )}
      </div>
    </div>
  );
}
