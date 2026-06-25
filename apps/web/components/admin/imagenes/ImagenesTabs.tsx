'use client';

import Link from 'next/link';
import { BookImage, Images, Sparkles } from 'lucide-react';

// Sub-navegación del módulo de Imágenes. Comparte las 3 páginas del cluster
// (rutas existentes, sin anidar) para dar el patrón "un menú con pestañas".

type TabKey = 'catalogos' | 'galeria' | 'marca';

const TABS: { key: TabKey; href: string; label: string; icon: typeof Images }[] = [
  { key: 'galeria',   href: '/admin/galeria',   label: 'Galería',   icon: Images },
  { key: 'marca',     href: '/admin/imagenes',  label: 'Marca y portada', icon: Sparkles },
  { key: 'catalogos', href: '/admin/catalogos', label: 'Catálogos', icon: BookImage },
];

export default function ImagenesTabs({ active }: { active: TabKey }) {
  return (
    <div className="flex gap-1 mb-6 bg-white border border-gray-100 rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
      {TABS.map(({ key, href, label, icon: Icon }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={href}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
