'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, ChevronLeft, Truck } from 'lucide-react';
import { useCart } from '@/components/shop/CartProvider';
import { useSalonSettings } from '@/lib/useSalonSettings';

const money = (n: number) => `S/ ${n.toFixed(2)}`;
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function CarritoPage() {
  const { items, subtotal, count, setQty, remove } = useCart();
  const settings = useSalonSettings();
  const freeOver = Number((settings?.shipFreeOverPen as number) ?? 150);

  const [coupon, setCoupon] = useState('');
  const [couponMsg, setCouponMsg] = useState('');
  const [discount, setDiscount] = useState(0);

  async function validateCoupon() {
    if (!coupon.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/promotions/validate?code=${coupon}&total=${subtotal}`);
      const data = await res.json();
      if (res.ok && data.discountAmount) {
        setDiscount(data.discountAmount);
        setCouponMsg(`✅ Descuento aplicado: -${money(data.discountAmount)}`);
      } else {
        setDiscount(0);
        setCouponMsg('❌ Cupón inválido o expirado');
      }
    } catch {
      setCouponMsg('❌ Error al validar el cupón');
    }
  }

  const estimatedTotal = Math.max(0, subtotal - discount);
  const remainingForFree = Math.max(0, freeOver - subtotal);

  if (count === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 pb-24 flex flex-col items-center justify-center text-center px-4">
        <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-display font-bold text-gray-800 mb-2">Tu carrito está vacío</h1>
        <p className="text-gray-500 mb-6 text-sm">Explora nuestros productos y agrega lo que te guste.</p>
        <Link href="/tienda"
          className="inline-flex items-center gap-2 bg-primary-600 text-white font-semibold px-6 py-3 rounded-full hover:bg-primary-500 transition-all text-sm"
          style={{ boxShadow: '0 4px 20px rgba(219,39,119,0.35)' }}>
          Ir a la tienda <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-24 md:pb-10">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/tienda" className="text-gray-500 hover:text-primary-600 flex items-center gap-1 text-sm">
            <ChevronLeft className="w-4 h-4" /> Tienda
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="font-display font-bold text-gray-900">Carrito ({count})</h1>
        </div>
      </div>

      {/* Banner envío gratis */}
      {freeOver > 0 && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="bg-primary-50 border border-primary-100 rounded-2xl px-4 py-3 flex items-center gap-3">
            <Truck className="w-5 h-5 text-primary-600 shrink-0" />
            <p className="text-sm text-primary-800">
              {remainingForFree > 0
                ? <>Te faltan <strong>{money(remainingForFree)}</strong> para conseguir <strong>envío gratis</strong>.</>
                : <>🎉 ¡Tienes <strong>envío gratis</strong> en este pedido!</>}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-5 grid md:grid-cols-[1fr_320px] gap-6">
        {/* Items */}
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4 items-start shadow-sm">
              <div className="w-20 h-20 shrink-0 bg-gray-100 rounded-xl overflow-hidden">
                {item.image
                  ? <Image src={item.image} alt={item.name} width={80} height={80} className="object-cover w-full h-full" unoptimized />
                  : <div className="w-full h-full flex items-center justify-center text-2xl">🧴</div>}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/tienda/${item.slug}`} className="font-semibold text-sm text-gray-900 line-clamp-2 mb-1 hover:text-primary-600 transition-colors">{item.name}</Link>
                <p className="text-primary-600 font-bold">{money(item.pricePen)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => setQty(item.id, item.qty - 1)} aria-label="Quitar uno"
                    className="w-7 h-7 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-primary-400 transition-colors">
                    <Minus className="w-3 h-3 text-gray-600" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
                  <button onClick={() => setQty(item.id, item.qty + 1)} aria-label="Agregar uno"
                    disabled={item.stock != null && item.qty >= item.stock}
                    className="w-7 h-7 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-primary-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <Plus className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-gray-900 text-sm">{money(item.pricePen * item.qty)}</p>
                <button onClick={() => remove(item.id)} className="mt-2 text-gray-400 hover:text-red-500 transition-colors" aria-label="Eliminar">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Resumen */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="font-semibold text-sm text-gray-800 mb-3">Cupón de descuento</h3>
            <div className="flex gap-2">
              <input type="text" placeholder="CÓDIGO" value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase" />
              <button onClick={validateCoupon} className="px-4 py-2 bg-gray-900 text-white font-semibold rounded-xl text-xs hover:bg-gray-700 transition-colors">
                Aplicar
              </button>
            </div>
            {couponMsg && <p className="text-xs mt-2 text-gray-600">{couponMsg}</p>}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm md:sticky md:top-20">
            <h3 className="font-semibold text-sm text-gray-800 mb-4">Resumen del pedido</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{money(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-green-600"><span>Descuento</span><span>-{money(discount)}</span></div>}
              <div className="flex justify-between text-gray-400"><span>Envío</span><span>Se calcula en el checkout</span></div>
              <div className="flex justify-between font-bold text-base text-gray-900 border-t border-gray-100 pt-2 mt-2">
                <span>Total estimado</span><span>{money(estimatedTotal)}</span>
              </div>
            </div>
            <Link href={`/checkout${discount > 0 ? `?discount=${discount}&coupon=${coupon}` : ''}`}
              className="mt-4 flex items-center justify-center gap-2 w-full py-3.5 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-full transition-all text-sm active:scale-95"
              style={{ boxShadow: '0 4px 20px rgba(219,39,119,0.4)' }}>
              Proceder al pago <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/tienda" className="mt-2 block text-center text-sm text-gray-500 hover:text-gray-800 font-medium">
              Seguir comprando
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
