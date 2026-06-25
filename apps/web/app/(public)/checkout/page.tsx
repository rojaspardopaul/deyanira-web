'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Check, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { useSalonSettings } from '@/lib/useSalonSettings';
import { LIMA_DISTRICTS } from '@/lib/districts';

type CartItem = { id: string; slug: string; name: string; pricePen: number; image: string | null; qty: number };

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const settings = useSalonSettings();
  const discountParam = parseFloat(searchParams.get('discount') || '0');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '',
    address: '', district: 'Cieneguilla',
  });
  const [payMethod, setPayMethod] = useState<'yape' | 'culqi'>('yape');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [fullOrderId, setFullOrderId] = useState('');
  const [error, setError] = useState('');
  const [proofBusy, setProofBusy] = useState(false);
  const [proofDone, setProofDone] = useState(false);
  const [proofError, setProofError] = useState('');

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem('cart');
    if (raw) setCart(JSON.parse(raw));
    else router.push('/carrito');
  }, [router]);

  // Autocompletar los datos de entrega con el perfil del usuario logueado.
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data: { session } } = await createClient().auth.getSession();
        if (!session?.user || cancel) return;
        const meta = session.user.user_metadata || {};
        let name = (meta.name as string) || (meta.full_name as string) || '';
        let phone = (meta.phone as string) || '';
        try {
          const me = await api.customers.me(session.access_token);
          name = me.name || name;
          phone = me.phone || phone;
        } catch { /* el perfil de cliente es opcional */ }
        if (cancel) return;
        setForm(f => ({
          ...f,
          name: f.name || name,
          phone: f.phone || phone,
          email: f.email || session.user.email || '',
        }));
      } catch { /* sin sesión: se deja el formulario vacío */ }
    })();
    return () => { cancel = true; };
  }, []);

  const subtotal = cart.reduce((acc, i) => acc + i.pricePen * i.qty, 0);
  const shipping = subtotal > 100 ? 0 : 10;
  const discount = discountParam;
  const total = Math.max(0, subtotal - discount) + shipping;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handlePlaceOrder() {
    if (!form.name || !form.phone || !form.address) {
      setError('Completa todos los campos obligatorios'); return;
    }
    setLoading(true); setError('');
    try {
      const orderData = {
        items: cart.map(i => ({ productId: i.id, qty: i.qty, pricePen: i.pricePen, name: i.name })),
        subtotalPen: subtotal,
        shippingPen: shipping,
        discountPen: discount,
        totalPen: total,
        paymentMethod: payMethod,
        shipName: form.name,
        shipPhone: form.phone,
        shipEmail: form.email || undefined,
        shipAddress: form.address,
        shipDistrict: form.district,
        shipCity: 'Lima',
      };

      const result = await api.orders.create(orderData) as Record<string, unknown>;
      setFullOrderId(result.id as string);
      setOrderId((result.id as string).slice(-6).toUpperCase());
      localStorage.removeItem('cart');
      window.dispatchEvent(new Event('cart-updated'));
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el pedido');
    } finally {
      setLoading(false);
    }
  }

  // Subida del comprobante Yape/Plin en la pantalla de éxito.
  async function onPickProof(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !fullOrderId) return;
    if (file.size > 8 * 1024 * 1024) { setProofError('La imagen no debe superar 8MB'); return; }
    setProofError(''); setProofBusy(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(new Error('No se pudo leer la imagen'));
        r.readAsDataURL(file);
      });
      await api.orders.uploadProof(fullOrderId, { image: dataUrl, method: 'yape' });
      setProofDone(true);
    } catch (err) {
      setProofError(err instanceof Error ? err.message : 'No se pudo subir el comprobante');
    } finally {
      setProofBusy(false);
    }
  }

  if (!mounted) return null;

  if (success) {
    const waNumber = (settings?.whatsapp || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');
    const waMsg = payMethod === 'yape'
      ? `Hola! Hice un pedido (#${orderId}) y pagué por Yape. Adjunto mi comprobante.`
      : `Hola! Hice el pedido #${orderId}. Por favor confírmenme cuando esté listo.`;

    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Check className="w-10 h-10 text-green-600" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-display font-bold text-gray-900 mb-2">¡Pedido registrado!</h1>
          <p className="text-gray-500 mb-1">Pedido <strong>#{orderId}</strong></p>
          {payMethod === 'yape' ? (
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 my-5 text-left">
              <p className="font-bold text-purple-800 mb-2">📱 Paga por Yape</p>
              {settings?.yapeNumber ? (
                <p className="text-sm text-purple-700 mb-1">
                  Yapea a: <strong>{settings.yapeNumber}</strong>
                  {settings.yapeName ? <> ({settings.yapeName})</> : null}
                </p>
              ) : (
                <p className="text-sm text-purple-700 mb-1">Pídenos el número de Yape por WhatsApp.</p>
              )}
              {settings?.plinNumber ? (
                <p className="text-sm text-purple-700 mb-1">o Plin: <strong>{settings.plinNumber}</strong></p>
              ) : null}
              <p className="text-sm text-purple-700 mb-3">Monto: <strong>S/ {total.toFixed(2)}</strong></p>

              {proofDone ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 font-medium flex items-center gap-2">
                  <Check className="w-4 h-4" /> Comprobante recibido. Lo verificaremos y te confirmamos.
                </div>
              ) : (
                <>
                  <label className={`block w-full text-center cursor-pointer bg-purple-600 text-white font-semibold px-4 py-3 rounded-xl text-sm hover:bg-purple-700 transition-colors ${proofBusy ? 'opacity-60 pointer-events-none' : ''}`}>
                    {proofBusy ? 'Subiendo…' : '📎 Adjuntar comprobante de pago'}
                    <input type="file" accept="image/*" onChange={onPickProof} disabled={proofBusy} className="hidden" />
                  </label>
                  {proofError && <p className="text-xs text-red-600 mt-2">{proofError}</p>}
                  <p className="text-xs text-purple-600 mt-2">O envíalo por WhatsApp con tu número de pedido.</p>
                </>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm my-5">Tu pago con tarjeta fue procesado. Recibirás confirmación por email.</p>
          )}
          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500 text-white font-bold px-7 py-3.5 rounded-full text-sm hover:bg-green-600 transition-colors mb-3"
          >
            💬 Confirmar por WhatsApp
          </a>
          <Link href="/tienda" className="block text-sm text-gray-400 hover:text-gray-600 underline mt-2">
            Seguir comprando
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-10">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/carrito" className="text-gray-500 hover:text-primary-600 flex items-center gap-1 text-sm">
            <ChevronLeft className="w-4 h-4" /> Carrito
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="font-display font-bold text-gray-900">Checkout</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 grid md:grid-cols-[1fr_320px] gap-6">

        {/* Formulario */}
        <div className="space-y-5">
          {/* Datos de envío */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-4">Datos de entrega</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre completo *</label>
                <input type="text" required value={form.name} onChange={set('name')} placeholder="Tu nombre"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">WhatsApp *</label>
                  <input type="tel" required value={form.phone} onChange={set('phone')} placeholder="9XX XXX XXX"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={set('email')} placeholder="opcional"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Dirección *</label>
                <input type="text" required value={form.address} onChange={set('address')} placeholder="Av. ..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Distrito</label>
                <select value={form.district} onChange={set('district')}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  {LIMA_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Método de pago */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-4">Método de pago</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'yape' as const, label: 'Yape / Plin', icon: '📱', desc: 'Paga al número del salón' },
                { id: 'culqi' as const, label: 'Tarjeta', icon: '💳', desc: 'Visa / Mastercard (próximamente)' },
              ].map(({ id, label, icon, desc }) => (
                <button
                  key={id}
                  onClick={() => setPayMethod(id)}
                  disabled={id === 'culqi'}
                  className={`p-4 border-2 rounded-2xl text-left transition-all ${
                    payMethod === id && id !== 'culqi'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${id === 'culqi' ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <span className="text-2xl block mb-1">{icon}</span>
                  <p className="font-bold text-sm text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm sticky top-20">
            <h2 className="font-bold text-gray-900 mb-4">Tu pedido</h2>
            <div className="space-y-2 mb-4">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate">{item.name} ×{item.qty}</span>
                  <span className="font-medium text-gray-900 ml-2 shrink-0">S/ {(item.pricePen * item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 text-sm border-t border-gray-100 pt-3 mb-3">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>S/ {subtotal.toFixed(2)}</span></div>
              {discount > 0 && <div className="flex justify-between text-green-600"><span>Descuento</span><span>-S/ {discount.toFixed(2)}</span></div>}
              <div className="flex justify-between text-gray-600"><span>Envío Lima</span><span>{shipping === 0 ? <span className="text-green-600">Gratis</span> : `S/ ${shipping.toFixed(2)}`}</span></div>
              <div className="flex justify-between font-black text-gray-900 text-base pt-1 border-t border-gray-100"><span>Total</span><span>S/ {total.toFixed(2)}</span></div>
            </div>

            {error && <p className="text-red-600 text-xs mb-3">{error}</p>}

            <button
              onClick={handlePlaceOrder}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-full text-sm transition-all disabled:opacity-50 active:scale-95"
              style={{ boxShadow: '0 4px 20px rgba(219,39,119,0.4)' }}
            >
              {loading ? 'Procesando...' : <>{payMethod === 'yape' ? '📱 Confirmar pedido' : '💳 Pagar con tarjeta'} <ArrowRight className="w-4 h-4" /></>}
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">🔒 Pago 100% seguro</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center"><div className="text-gray-400">Cargando...</div></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
