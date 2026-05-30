'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, ChevronLeft } from 'lucide-react';

type CartItem = {
  id: string;
  slug: string;
  name: string;
  pricePen: number;
  image: string | null;
  qty: number;
};

export default function CarritoPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState('');
  const [couponMsg, setCouponMsg] = useState('');
  const [discount, setDiscount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem('cart');
    if (raw) setCart(JSON.parse(raw));

    const handler = () => {
      const r = localStorage.getItem('cart');
      setCart(r ? JSON.parse(r) : []);
    };
    window.addEventListener('cart-updated', handler);
    return () => window.removeEventListener('cart-updated', handler);
  }, []);

  function save(updated: CartItem[]) {
    setCart(updated);
    localStorage.setItem('cart', JSON.stringify(updated));
    window.dispatchEvent(new Event('cart-updated'));
  }

  function changeQty(id: string, delta: number) {
    const updated = cart
      .map((item) => item.id === id ? { ...item, qty: item.qty + delta } : item)
      .filter((item) => item.qty > 0);
    save(updated);
  }

  function remove(id: string) {
    save(cart.filter((item) => item.id !== id));
  }

  async function validateCoupon() {
    if (!coupon.trim()) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/promotions/validate?code=${coupon}&total=${subtotal}`
      );
      const data = await res.json();
      if (res.ok && data.discountAmount) {
        setDiscount(data.discountAmount);
        setCouponMsg(`✅ Descuento aplicado: -S/ ${data.discountAmount.toFixed(2)}`);
      } else {
        setDiscount(0);
        setCouponMsg('❌ Cupón inválido o expirado');
      }
    } catch {
      setCouponMsg('❌ Error al validar el cupón');
    }
  }

  const subtotal = cart.reduce((acc, item) => acc + item.pricePen * item.qty, 0);
  const shipping = subtotal > 100 ? 0 : 10;
  const total = Math.max(0, subtotal - discount) + shipping;

  if (!mounted) return null;

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex flex-col items-center justify-center text-center px-4">
        <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-display font-bold text-gray-800 mb-2">Tu carrito está vacío</h1>
        <p className="text-gray-500 mb-6 text-sm">Explora nuestros productos y agrega lo que te guste.</p>
        <Link href="/tienda"
          className="inline-flex items-center gap-2 bg-primary-600 text-white font-semibold px-6 py-3 rounded-full hover:bg-primary-500 transition-all text-sm"
          style={{ boxShadow: '0 4px 20px rgba(219,39,119,0.35)' }}
        >
          Ir a la tienda <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/tienda" className="text-gray-500 hover:text-primary-600 flex items-center gap-1 text-sm">
            <ChevronLeft className="w-4 h-4" /> Tienda
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="font-display font-bold text-gray-900">Carrito ({cart.length})</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 grid md:grid-cols-[1fr_320px] gap-6">

        {/* Items */}
        <div className="space-y-3">
          {cart.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4 items-start shadow-sm">
              {/* Imagen */}
              <div className="w-20 h-20 shrink-0 bg-gray-100 rounded-xl overflow-hidden">
                {item.image ? (
                  <Image src={item.image} alt={item.name} width={80} height={80} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🧴</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-1">{item.name}</h3>
                <p className="text-primary-600 font-bold">S/ {item.pricePen.toFixed(2)}</p>

                {/* Cantidad */}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => changeQty(item.id, -1)}
                    className="w-7 h-7 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-primary-400 transition-colors"
                  >
                    <Minus className="w-3 h-3 text-gray-600" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
                  <button
                    onClick={() => changeQty(item.id, 1)}
                    className="w-7 h-7 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-primary-400 transition-colors"
                  >
                    <Plus className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Subtotal + eliminar */}
              <div className="text-right shrink-0">
                <p className="font-bold text-gray-900 text-sm">S/ {(item.pricePen * item.qty).toFixed(2)}</p>
                <button
                  onClick={() => remove(item.id)}
                  className="mt-2 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Resumen */}
        <div className="space-y-4">
          {/* Cupón */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="font-semibold text-sm text-gray-800 mb-3">Cupón de descuento</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="CÓDIGO"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase"
              />
              <button
                onClick={validateCoupon}
                className="px-4 py-2 bg-gray-900 text-white font-semibold rounded-xl text-xs hover:bg-gray-700 transition-colors"
              >
                Aplicar
              </button>
            </div>
            {couponMsg && (
              <p className="text-xs mt-2 text-gray-600">{couponMsg}</p>
            )}
          </div>

          {/* Total */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="font-semibold text-sm text-gray-800 mb-4">Resumen del pedido</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>S/ {subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Descuento</span>
                  <span>-S/ {discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Envío Lima</span>
                <span>{shipping === 0 ? <span className="text-green-600">Gratis</span> : `S/ ${shipping.toFixed(2)}`}</span>
              </div>
              {subtotal <= 100 && (
                <p className="text-xs text-gray-400">Envío gratis en pedidos mayores a S/ 100</p>
              )}
              <div className="flex justify-between font-bold text-base text-gray-900 border-t border-gray-100 pt-2 mt-2">
                <span>Total</span>
                <span>S/ {total.toFixed(2)}</span>
              </div>
            </div>

            <Link
              href={`/checkout?discount=${discount}`}
              className="mt-4 flex items-center justify-center gap-2 w-full py-3.5 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-full transition-all text-sm active:scale-95"
              style={{ boxShadow: '0 4px 20px rgba(219,39,119,0.4)' }}
            >
              Proceder al pago <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
