'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from './CartProvider';

const money = (n: number) => `S/ ${n.toFixed(2)}`;

export default function CartDrawer() {
  const { items, subtotal, count, setQty, remove, drawerOpen, closeDrawer } = useCart();

  // Cerrar con Esc + bloquear scroll del fondo mientras está abierto.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [drawerOpen, closeDrawer]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeDrawer}
        aria-hidden={!drawerOpen}
        className={`fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Carrito de compras"
        className={`fixed top-0 right-0 z-[61] h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100 shrink-0">
          <h2 className="font-display font-bold text-lg text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary-600" />
            Tu carrito {count > 0 && <span className="text-sm font-semibold text-gray-400">({count})</span>}
          </h2>
          <button onClick={closeDrawer} aria-label="Cerrar" className="p-2 -mr-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <ShoppingBag className="w-14 h-14 text-gray-200 mb-4" />
            <p className="font-semibold text-gray-700 mb-1">Tu carrito está vacío</p>
            <p className="text-sm text-gray-400 mb-6">Agrega productos y aparecerán aquí.</p>
            <Link href="/tienda" onClick={closeDrawer}
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white font-semibold px-6 py-3 rounded-full text-sm transition-all">
              Ir a la tienda <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 items-start bg-gray-50 rounded-2xl p-3">
                  <div className="w-16 h-16 shrink-0 bg-white rounded-xl overflow-hidden border border-gray-100">
                    {item.image
                      ? <Image src={item.image} alt={item.name} width={64} height={64} className="object-cover w-full h-full" unoptimized />
                      : <div className="w-full h-full flex items-center justify-center text-2xl">🧴</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 line-clamp-2 leading-tight">{item.name}</p>
                    <p className="text-primary-600 font-bold text-sm mt-0.5">{money(item.pricePen)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => setQty(item.id, item.qty - 1)} aria-label="Quitar uno"
                        className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:border-primary-400 transition-colors">
                        <Minus className="w-3 h-3 text-gray-600" />
                      </button>
                      <span className="w-7 text-center text-sm font-semibold">{item.qty}</span>
                      <button onClick={() => setQty(item.id, item.qty + 1)} aria-label="Agregar uno"
                        disabled={item.stock != null && item.qty >= item.stock}
                        className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:border-primary-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <Plus className="w-3 h-3 text-gray-600" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm text-gray-900">{money(item.pricePen * item.qty)}</p>
                    <button onClick={() => remove(item.id)} aria-label="Eliminar"
                      className="mt-2 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-5 py-4 shrink-0 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-bold text-gray-900 text-base">{money(subtotal)}</span>
              </div>
              <p className="text-[11px] text-gray-400">Envío y descuentos se calculan en el checkout.</p>
              <Link href="/checkout" onClick={closeDrawer}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-full text-sm transition-all active:scale-[0.98]"
                style={{ boxShadow: '0 4px 20px rgba(219,39,119,0.35)' }}>
                Ir al checkout <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/carrito" onClick={closeDrawer}
                className="block text-center text-sm text-gray-500 hover:text-gray-800 font-medium">
                Ver carrito completo
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
