import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import AddToCartButton from '@/components/tienda/AddToCartButton';
import ProductGallery from '@/components/tienda/ProductGallery';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await api.products.get(slug).catch(() => null) as Record<string, unknown> | null;
  if (!product) return { title: 'Producto no encontrado' };
  const description = (product.description as string) || 'Producto de belleza profesional. Envíos en Lima, Perú.';
  const imageUrl = product.imageUrl as string | undefined;
  return {
    title: `${product.name} | Tienda Deyanira`,
    description,
    openGraph: {
      title: String(product.name),
      description,
      ...(imageUrl && { images: [{ url: imageUrl, width: 800, height: 800, alt: String(product.name) }] }),
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await api.products.get(slug).catch(() => null) as Record<string, unknown> | null;

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex flex-col items-center justify-center text-center px-4">
        <p className="text-6xl mb-4">🔍</p>
        <h1 className="text-2xl font-display font-bold text-gray-900 mb-2">Producto no encontrado</h1>
        <p className="text-gray-500 mb-6">Este producto no existe o ya no está disponible.</p>
        <Link href="/tienda" className="inline-flex items-center gap-2 text-primary-600 hover:underline font-medium">
          <ChevronLeft className="w-4 h-4" /> Volver a la tienda
        </Link>
      </div>
    );
  }

  const images = (product.images as string[]) || [];
  const hasDiscount = !!product.comparePrice;
  const discountPct = hasDiscount
    ? Math.round((1 - Number(product.pricePen) / Number(product.comparePrice)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-2 text-sm text-gray-500">
          <Link href="/tienda" className="hover:text-primary-600 flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Tienda
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium truncate">{product.name as string}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">

          {/* Imágenes */}
          <ProductGallery images={images} name={String(product.name ?? '')} discountPct={hasDiscount ? discountPct : 0} />

          {/* Info del producto */}
          <div className="flex flex-col">
            {product.brand != null && (
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-500 mb-1">
                {String(product.brand)}
              </p>
            )}
            <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900 mb-3 leading-tight">
              {String(product.name ?? '')}
            </h1>

            {/* Precio */}
            <div className="flex items-baseline gap-3 mb-5">
              <span className="text-3xl font-black text-primary-600">
                S/ {Number(product.pricePen).toFixed(2)}
              </span>
              {hasDiscount && (
                <span className="text-lg text-gray-400 line-through">
                  S/ {Number(product.comparePrice).toFixed(2)}
                </span>
              )}
            </div>

            {/* Stock */}
            <div className="flex items-center gap-2 mb-5">
              {Number(product.stock) > 0 ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-700 font-medium">
                    {Number(product.stock) <= 5 ? `¡Solo quedan ${Number(product.stock)}!` : 'En stock'}
                  </span>
                </>
              ) : (
                <span className="text-sm text-red-600 font-medium">Sin stock</span>
              )}
            </div>

            {/* Descripción */}
            {product.description != null && (
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                {String(product.description)}
              </p>
            )}

            {/* CTA */}
            <div className="space-y-3 mt-auto">
              <AddToCartButton product={product} />
            </div>

            {/* Badges de confianza */}
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                { icon: '🚚', label: 'Envío a Lima' },
                { icon: '✅', label: 'Producto original' },
                { icon: '💬', label: 'Soporte WhatsApp' },
              ].map(({ icon, label }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <span className="text-xl block mb-1">{icon}</span>
                  <span className="text-xs text-gray-500 font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
