'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import ServiceCard, { type ServiceCardData } from './ServiceCard';

// Catálogo de servicios con barra de herramientas STICKY (buscador + categorías)
// en un solo bloque fijo, para que en móvil no se pierda de vista lo escrito ni la
// categoría activa al hacer scroll por los resultados. La búsqueda es instantánea
// (filtra por nombre, descripción o categoría) sobre los servicios ya filtrados
// por categoría desde el server.

type Category = { id: string; name: string; slug: string };

const CATEGORY_ICONS: Record<string, string> = {
  maquillaje: '💄', cabello: '💇', unas: '💅', cejas: '✨',
};
const ACCENTS: Record<string, string> = {
  maquillaje: '#FF4FA2', unas: '#FF4FA2', cabello: '#E8C040', cejas: '#E8C040',
};

export default function ServicesCatalog({
  services,
  popularIds,
  categories,
  active,
}: {
  services: ServiceCardData[];
  popularIds: string[];
  categories: Category[];
  active?: string;
}) {
  const [q, setQ] = useState('');
  const popular = useMemo(() => new Set(popularIds), [popularIds]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return services;
    return services.filter((s) =>
      [s.name, s.description, s.category?.name]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(term)),
    );
  }, [q, services]);

  const scrollToCatalog = () => {
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cardStyle = (selected: boolean, accent: string) => selected
    ? {
        background: accent === '#FF4FA2'
          ? 'linear-gradient(135deg, #FF4FA2, #e6368a)'
          : 'linear-gradient(135deg, #E8C040, #C9A030)',
        boxShadow: `0 4px 14px ${accent === '#FF4FA2' ? 'rgba(255,79,162,0.35)' : 'rgba(232,192,64,0.35)'}`,
      }
    : { background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.08)' };

  return (
    <>
      {/* Barra fija: buscador + categorías (un solo bloque sticky) */}
      <div
        className="sticky top-16 z-30"
        style={{ background: 'rgba(250,250,250,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.07)' }}
      >
        <div className="max-w-6xl mx-auto px-4 pt-3 pb-2 space-y-2.5">
          {/* Buscador */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar servicio (maquillaje, uñas, balayage…)"
              aria-label="Buscar servicio"
              className="w-full pl-11 pr-10 py-2.5 rounded-full bg-white ring-1 ring-black/10 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 transition-shadow"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Categorías */}
          <div className="relative">
            <div className="flex gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar pr-8">
              <Link
                href="/servicios"
                scroll={false}
                onClick={scrollToCatalog}
                className="shrink-0 flex flex-col items-center justify-center gap-1 w-[62px] sm:w-[74px] py-2 rounded-2xl transition-all duration-200"
                style={cardStyle(!active, '#E8C040')}
              >
                <span className="text-lg sm:text-2xl">✦</span>
                <span className="text-[10px] sm:text-xs font-semibold leading-none" style={{ color: !active ? '#fff' : '#6b4d5a' }}>
                  Todos
                </span>
              </Link>
              {categories.map((cat) => {
                const isActive = active === cat.slug;
                const accent = ACCENTS[cat.slug] || '#E8C040';
                return (
                  <Link
                    key={cat.id}
                    href={`/servicios?category=${cat.slug}`}
                    scroll={false}
                    onClick={scrollToCatalog}
                    className="shrink-0 flex flex-col items-center justify-center gap-1 w-[62px] sm:w-[74px] py-2 rounded-2xl transition-all duration-200"
                    style={cardStyle(isActive, accent)}
                  >
                    <span className="text-lg sm:text-2xl">{CATEGORY_ICONS[cat.slug] || '◆'}</span>
                    <span className="text-[10px] sm:text-xs font-semibold leading-none text-center px-1 truncate max-w-full" style={{ color: isActive ? '#fff' : '#6b4d5a' }}>
                      {cat.name}
                    </span>
                  </Link>
                );
              })}
            </div>
            {/* Fade derecho — indica scroll horizontal en móvil */}
            <div
              className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 md:hidden"
              style={{ background: 'linear-gradient(to right, transparent, rgba(250,250,250,0.98))' }}
            />
          </div>
        </div>
      </div>

      {/* Grilla de resultados */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        {services.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">🔍</p>
            <p className="font-semibold text-lg mb-2 text-gray-900">No hay servicios en esta categoría</p>
            <Link href="/servicios" className="text-sm font-medium text-primary-600 hover:text-primary-700">Ver todos los servicios</Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold text-gray-900">No encontramos servicios para “{q}”</p>
            <button type="button" onClick={() => setQ('')} className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700">
              Ver todos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {filtered.map((service) => (
              <ServiceCard key={service.id} service={service} popular={popular.has(service.id)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
