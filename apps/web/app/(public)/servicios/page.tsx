import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Servicios',
  description: 'Catálogo completo de servicios de belleza: maquillaje, cabello, uñas y cejas. Precios y duración en Lima, Perú.',
};

const CATEGORY_ICONS: Record<string, string> = {
  maquillaje: '💄',
  cabello: '💇',
  unas: '💅',
  cejas: '✨',
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
    <div className="min-h-screen bg-gray-50 pt-16">

      {/* Hero de sección */}
      <div className="bg-white border-b border-gray-100 px-4 py-10">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900 mb-2">
            Nuestros Servicios
          </h1>
          <p className="text-gray-500">
            Realizados con productos profesionales de alta calidad
          </p>
        </div>
      </div>

      {/* Filtros por categoría — scroll horizontal en móvil */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-3">
            <Link
              href="/servicios"
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                !category
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-gray-200 text-gray-600 hover:border-primary-400 bg-white'
              }`}
            >
              ✦ Todos
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id as string}
                href={`/servicios?category=${cat.slug}`}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                  category === (cat.slug as string)
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-200 text-gray-600 hover:border-primary-400 bg-white'
                }`}
              >
                <span>{CATEGORY_ICONS[cat.slug as string] || '◆'}</span>
                {cat.name as string}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de servicios */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {services.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">🔍</p>
            <p className="font-medium">No hay servicios en esta categoría</p>
            <Link href="/servicios" className="text-primary-600 text-sm hover:underline mt-2 block">
              Ver todos los servicios
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div
                key={service.id as string}
                className="card group hover:-translate-y-1 transition-all duration-200"
              >
                {/* Top color strip based on category */}
                <div className="h-1.5 bg-gradient-to-r from-primary-400 to-primary-600" />

                <div className="p-5 flex flex-col h-full">
                  {/* Category icon + name */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-display font-bold text-lg text-gray-900 leading-snug">
                        {service.name as string}
                      </h3>
                      {service.description && (
                        <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                          {service.description as string}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Duration badge */}
                  <div className="flex items-center gap-1.5 mb-4">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500 font-medium">
                      {service.duration as number} minutos
                    </span>
                  </div>

                  {/* Price + CTA */}
                  <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Precio</p>
                      <span className="text-2xl font-bold text-primary-600">
                        S/ {Number(service.pricePen).toFixed(2)}
                      </span>
                    </div>
                    <Link
                      href={`/reservar?service=${service.id}`}
                      className="btn-primary text-sm px-5 py-2.5 gap-1"
                    >
                      Reservar
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="bg-primary-50 border-t border-primary-100 px-4 py-10 text-center">
        <p className="text-gray-600 mb-3">¿Tienes alguna duda sobre nuestros servicios?</p>
        <a
          href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, quiero consultar sobre sus servicios')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-green-500 text-white font-semibold px-6 py-3 rounded-full hover:bg-green-600 transition-colors"
        >
          💬 Consultar por WhatsApp
        </a>
      </div>
    </div>
  );
}
