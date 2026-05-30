'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

// Fila deslizable de categorías (cards con icono). Al cambiar de categoría
// navega sin saltar al top y mantiene al usuario en la sección de servicios
// (hace scroll al ancla #catalogo solo cuando la categoría cambia, no al cargar).

type Category = { id: string; name: string; slug: string };

const CATEGORY_ICONS: Record<string, string> = {
  maquillaje: '💄', cabello: '💇', unas: '💅', cejas: '✨',
};
const ACCENTS: Record<string, string> = {
  maquillaje: '#FF4FA2', unas: '#FF4FA2', cabello: '#E8C040', cejas: '#E8C040',
};

export default function CategoryFilterBar({
  categories, active,
}: {
  categories: Category[];
  active?: string;
}) {
  const firstRun = useRef(true);

  // Mantiene la vista en la sección de servicios al cambiar de categoría.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [active]);

  const cardStyle = (selected: boolean, accent: string) => selected
    ? {
        background: accent === '#FF4FA2'
          ? 'linear-gradient(135deg, #FF4FA2, #e6368a)'
          : 'linear-gradient(135deg, #E8C040, #C9A030)',
        boxShadow: `0 4px 14px ${accent === '#FF4FA2' ? 'rgba(255,79,162,0.35)' : 'rgba(232,192,64,0.35)'}`,
      }
    : { background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.08)' };

  return (
    <div className="sticky top-16 z-30" style={{ background: 'rgba(250,250,250,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="relative">
          <div className="flex gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar py-3 pr-8">
            {/* Card "Todos" */}
            <Link
              href="/servicios"
              scroll={false}
              className="shrink-0 flex flex-col items-center justify-center gap-1.5 w-[68px] sm:w-[78px] py-2.5 rounded-2xl transition-all duration-200"
              style={cardStyle(!active, '#E8C040')}
            >
              <span className="text-xl sm:text-2xl">✦</span>
              <span className="text-[10px] sm:text-xs font-semibold leading-none"
                style={{ color: !active ? '#fff' : '#6b4d5a' }}>
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
                  className="shrink-0 flex flex-col items-center justify-center gap-1.5 w-[68px] sm:w-[78px] py-2.5 rounded-2xl transition-all duration-200"
                  style={cardStyle(isActive, accent)}
                >
                  <span className="text-xl sm:text-2xl">{CATEGORY_ICONS[cat.slug] || '◆'}</span>
                  <span className="text-[10px] sm:text-xs font-semibold leading-none text-center px-1 truncate max-w-full"
                    style={{ color: isActive ? '#fff' : '#6b4d5a' }}>
                    {cat.name}
                  </span>
                </Link>
              );
            })}
          </div>
          {/* Fade derecho — indica scroll en móvil */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 md:hidden"
            style={{ background: 'linear-gradient(to right, transparent, rgba(250,250,250,0.98))' }} />
        </div>
      </div>
    </div>
  );
}
