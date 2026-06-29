'use client';

import { useState } from 'react';
import Image from 'next/image';

// Galería de imágenes del producto: imagen principal + miniaturas clickeables.
// Al seleccionar una miniatura se muestra esa imagen en grande.
export default function ProductGallery({
  images,
  name,
  discountPct = 0,
}: {
  images: string[];
  name: string;
  discountPct?: number;
}) {
  const gallery = images.filter(Boolean);
  const [selected, setSelected] = useState(0);
  const current = gallery[selected] ?? gallery[0];

  return (
    <div>
      <div className="aspect-square bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 relative">
        {current ? (
          <Image src={current} alt={name} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" priority />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-8xl">🧴</div>
        )}
        {discountPct > 0 && (
          <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-black px-3 py-1.5 rounded-full">
            -{discountPct}% OFF
          </span>
        )}
      </div>

      {gallery.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
          {gallery.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={`Ver imagen ${i + 1} de ${name}`}
              aria-current={i === selected}
              className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                i === selected ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Image src={img} alt={`${name} ${i + 1}`} width={64} height={64} className="object-cover w-full h-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
