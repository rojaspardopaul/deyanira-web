import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, Sparkles, Truck, Shield, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Tienda de Productos de Belleza en Lima — Maquillaje, Cuidado Capilar',
  description: 'Productos de belleza profesionales originales: maquillaje, cuidado capilar, esmaltes, accesorios. Envío a todo Lima en 24-48 h. Pago con tarjeta, Yape o Plin.',
  path: '/tienda',
  keywords: [
    'productos de belleza Lima',
    'maquillaje profesional Perú',
    'comprar maquillaje online Lima',
    'esmaltes semipermanentes Perú',
    'cosméticos profesionales Lima',
    'tienda online belleza Lima',
  ],
});

const PERKS = [
  { icon: Truck,      label: 'Envío a Lima' },
  { icon: Shield,     label: 'Productos originales' },
  { icon: RotateCcw,  label: 'Devoluciones fáciles' },
];

export default async function TiendaPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [products, categories] = await Promise.all([
    api.products.list(category ? `category=${category}` : undefined).catch(() => []) as Promise<Record<string, unknown>[]>,
    api.products.categories().catch(() => []) as Promise<Record<string, unknown>[]>,
  ]);

  return (
    <div className="min-h-screen pt-16" style={{ background: '#FAFAFA' }}>

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden py-14 md:py-20 px-4" style={{ background: '#0F0F0F' }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(212,175,55,0.15) 0%, transparent 70%)' }} />
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)' }} />

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <p className="section-label mb-3" style={{ color: 'rgba(212,175,55,0.8)' }}>
            <Sparkles className="w-3.5 h-3.5 inline mr-1" /> Beauty Shop
          </p>
          <h1 className="font-display font-bold italic text-4xl md:text-5xl text-white mb-3">
            Tienda <span style={{ color: '#D4AF37' }}>Premium</span>
          </h1>
          <p className="text-sm md:text-base mb-8 max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Productos profesionales de belleza con envío a Lima
          </p>

          {/* Perks */}
          <div className="flex flex-wrap items-center justify-center gap-5">
            {PERKS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="w-4 h-4 shrink-0" style={{ color: '#D4AF37' }} />
                <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filtros ──────────────────────────────────────── */}
      <div className="sticky top-16 z-30" style={{ background: 'rgba(250,250,250,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-3 px-4">
            <Link href="/tienda"
              className="shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200"
              style={!category ? {
                background: 'linear-gradient(135deg, #D4AF37, #b8962e)',
                color: '#ffffff',
                boxShadow: '0 4px 14px rgba(212,175,55,0.35)',
              } : {
                background: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(0,0,0,0.1)',
                color: '#6b4d5a',
              }}>
              Todos
            </Link>
            {categories.map((cat) => (
              <Link key={cat.id as string} href={`/tienda?category=${cat.slug}`}
                className="shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200"
                style={category === cat.slug ? {
                  background: 'linear-gradient(135deg, #D4AF37, #b8962e)',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(212,175,55,0.35)',
                } : {
                  background: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  color: '#6b4d5a',
                }}>
                {cat.name as string}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Grid de productos ────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        {products.length === 0 ? (
          <div className="text-center py-24">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4" style={{ color: '#D4AF37' }} />
            <p className="font-semibold text-lg mb-2" style={{ color: '#0F0F0F' }}>No hay productos disponibles</p>
            <Link href="/tienda" className="text-sm font-medium" style={{ color: '#D4AF37' }}>Ver todos los productos</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {products.map((product) => {
              const images = product.images as string[];
              const hasDiscount = product.comparePrice != null;
              const discount = hasDiscount
                ? Math.round((1 - Number(product.pricePen) / Number(product.comparePrice)) * 100)
                : 0;

              return (
                <Link
                  key={product.id as string}
                  href={`/tienda/${product.slug}`}
                  className="group rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2 flex flex-col"
                  style={{
                    background: '#fff',
                    border: '1px solid rgba(0,0,0,0.07)',
                    boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
                  }}
                >
                  {/* Image */}
                  <div className="relative aspect-square overflow-hidden" style={{ background: '#f5f0ed' }}>
                    {images?.[0] ? (
                      <Image
                        src={images[0]}
                        alt={product.name as string}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-5xl">🧴</span>
                      </div>
                    )}

                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                      {hasDiscount && (
                        <span className="text-[10px] font-black px-2 py-1 rounded-full text-white"
                          style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)' }}>
                          -{discount}%
                        </span>
                      )}
                    </div>

                    {/* Quick add overlay */}
                    <div className="absolute inset-0 flex items-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)' }}>
                      <span className="w-full text-center py-2 rounded-xl text-xs font-bold text-white"
                        style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                        Ver producto
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-poppins font-semibold text-sm line-clamp-2 mb-3 leading-snug" style={{ color: '#0F0F0F' }}>
                      {String(product.name ?? '')}
                    </h3>
                    <div className="mt-auto flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold" style={{ color: '#FF4FA2' }}>
                          S/ {Number(product.pricePen).toFixed(2)}
                        </span>
                        {hasDiscount && (
                          <p className="text-xs line-through" style={{ color: '#b09aa5' }}>
                            S/ {Number(product.comparePrice).toFixed(2)}
                          </p>
                        )}
                      </div>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-110"
                        style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)', boxShadow: '0 4px 12px rgba(255,79,162,0.3)' }}>
                        <ShoppingBag className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
