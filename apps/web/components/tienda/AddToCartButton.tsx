'use client';

import { useState } from 'react';
import { ShoppingBag, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Product = Record<string, unknown>;

export default function AddToCartButton({ product }: { product: Product }) {
  const [added, setAdded] = useState(false);
  const router = useRouter();
  const inStock = Number(product.stock) > 0;

  function handleAdd() {
    if (!inStock) return;
    const images = (product.images as string[]) || [];
    const item = {
      id: product.id as string,
      slug: product.slug as string,
      name: product.name as string,
      pricePen: Number(product.pricePen),
      image: images[0] || null,
      qty: 1,
    };

    const raw = localStorage.getItem('cart');
    const cart: typeof item[] = raw ? JSON.parse(raw) : [];
    const existing = cart.find((c) => c.id === item.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push(item);
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cart-updated'));

    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  if (!inStock) {
    return (
      <button
        disabled
        className="w-full py-3.5 bg-gray-200 text-gray-500 font-semibold rounded-full cursor-not-allowed text-sm"
      >
        Sin stock
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleAdd}
        className={`flex-1 flex items-center justify-center gap-2 py-3.5 font-bold rounded-full text-sm transition-all ${
          added
            ? 'bg-green-500 text-white'
            : 'bg-primary-600 hover:bg-primary-500 text-white active:scale-95'
        }`}
        style={added ? undefined : { boxShadow: '0 4px 20px rgba(219,39,119,0.4)' }}
      >
        {added ? (
          <>
            <Check className="w-4 h-4" strokeWidth={2.5} />
            ¡Agregado!
          </>
        ) : (
          <>
            <ShoppingBag className="w-4 h-4" />
            Agregar al carrito
          </>
        )}
      </button>
      {added && (
        <button
          onClick={() => router.push('/carrito')}
          className="px-4 py-3.5 border-2 border-primary-300 text-primary-600 font-semibold rounded-full text-sm hover:bg-primary-50 transition-colors"
        >
          Ver carrito
        </button>
      )}
    </div>
  );
}
