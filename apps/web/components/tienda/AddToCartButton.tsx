'use client';

import { useState } from 'react';
import { ShoppingBag, Check } from 'lucide-react';
import { useCart } from '@/components/shop/CartProvider';

type Product = Record<string, unknown>;

export default function AddToCartButton({ product, qty = 1 }: { product: Product; qty?: number }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const stock = Number(product.stock) || 0;
  const inStock = stock > 0;

  function handleAdd() {
    if (!inStock) return;
    const images = (product.images as string[]) || [];
    add(
      {
        id: product.id as string,
        slug: product.slug as string,
        name: product.name as string,
        pricePen: Number(product.pricePen),
        image: images[0] || null,
        stock,
      },
      qty,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  if (!inStock) {
    return (
      <button disabled className="w-full py-3.5 bg-gray-200 text-gray-500 font-semibold rounded-full cursor-not-allowed text-sm">
        Sin stock
      </button>
    );
  }

  return (
    <button
      onClick={handleAdd}
      className={`w-full flex items-center justify-center gap-2 py-3.5 font-bold rounded-full text-sm transition-all ${
        added ? 'bg-green-500 text-white' : 'bg-primary-600 hover:bg-primary-500 text-white active:scale-95'
      }`}
      style={added ? undefined : { boxShadow: '0 4px 20px rgba(219,39,119,0.4)' }}
    >
      {added ? (
        <><Check className="w-4 h-4" strokeWidth={2.5} /> ¡Agregado!</>
      ) : (
        <><ShoppingBag className="w-4 h-4" /> Agregar al carrito</>
      )}
    </button>
  );
}
