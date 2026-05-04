import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Tienda',
  description: 'Compra productos de belleza profesionales. Envíos en Lima, Perú.',
};

export default async function TiendaPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [products, categories] = await Promise.all([
    api.products.list(category ? `category=${category}` : undefined) as Promise<Record<string, unknown>[]>,
    api.products.categories() as Promise<Record<string, unknown>[]>,
  ]);

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="section-title">Tienda</h1>
          <p className="text-gray-600">Productos profesionales de belleza con envío a Lima</p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 justify-center mb-12">
          <Link href="/tienda" className={`px-5 py-2 rounded-full text-sm font-medium border transition-colors ${!category ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 hover:border-primary-400'}`}>
            Todos
          </Link>
          {categories.map((cat) => (
            <Link key={cat.id as string} href={`/tienda?category=${cat.slug}`}
              className={`px-5 py-2 rounded-full text-sm font-medium border transition-colors ${category === cat.slug ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 hover:border-primary-400'}`}>
              {cat.name as string}
            </Link>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => {
            const images = product.images as string[];
            return (
              <Link key={product.id as string} href={`/tienda/${product.slug}`} className="card group">
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  {images?.[0] ? (
                    <Image
                      src={images[0]}
                      alt={product.name as string}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl">🧴</div>
                  )}
                  {product.comparePrice && (
                    <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      OFERTA
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm line-clamp-2 mb-2">{product.name as string}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-primary-600">
                      S/ {Number(product.pricePen).toFixed(2)}
                    </span>
                    {product.comparePrice && (
                      <span className="text-sm text-gray-400 line-through">
                        S/ {Number(product.comparePrice).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {products.length === 0 && (
          <p className="text-center text-gray-500 py-20">No hay productos disponibles.</p>
        )}
      </div>
    </div>
  );
}
