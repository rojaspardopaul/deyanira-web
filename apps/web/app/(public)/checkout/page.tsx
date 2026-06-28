'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Check, ArrowRight, Truck, Store, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { useSalonSettings } from '@/lib/useSalonSettings';
import { useCart } from '@/components/shop/CartProvider';
import { LIMA_DISTRICTS } from '@/lib/districts';
import { setShippingRates, shippingForOrder, freeShippingThreshold } from '@/lib/shipping';
import CulqiCheckout, { closeCulqi } from '@/components/payments/CulqiCheckout';

const CULQI_PK = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY || '';
const money = (n: number) => `S/ ${n.toFixed(2)}`;

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const settings = useSalonSettings();
  const { items: cart, subtotal, clear } = useCart();
  const discount = parseFloat(searchParams.get('discount') || '0') || 0;
  const coupon = searchParams.get('coupon') || '';

  const [step, setStep] = useState<1 | 2>(1);
  const [mounted, setMounted] = useState(false);
  const [delivery, setDelivery] = useState<'delivery' | 'pickup'>('delivery');
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', district: 'Cieneguilla' });
  const [payMethod, setPayMethod] = useState<'yape' | 'culqi'>('yape');
  const [culqiOrderId, setCulqiOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [fullOrderId, setFullOrderId] = useState('');
  const [error, setError] = useState('');
  const [proofBusy, setProofBusy] = useState(false);
  const [proofDone, setProofDone] = useState(false);
  const [proofError, setProofError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  // Tarifa de envío desde la config pública (el backend es la autoridad).
  useEffect(() => { if (settings) setShippingRates(settings as Record<string, unknown>); }, [settings]);

  // Si el carrito está vacío (y no acabamos de comprar), volver al carrito.
  useEffect(() => {
    if (mounted && cart.length === 0 && !success) router.push('/carrito');
  }, [mounted, cart.length, success, router]);

  // Autocompletar datos con el perfil del usuario logueado.
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
        } catch { /* perfil opcional */ }
        if (cancel) return;
        setForm(f => ({ ...f, name: f.name || name, phone: f.phone || phone, email: f.email || session.user.email || '' }));
      } catch { /* sin sesión */ }
    })();
    return () => { cancel = true; };
  }, []);

  const pickup = delivery === 'pickup';
  const shipping = shippingForOrder({ subtotal, district: form.district, pickupInStore: pickup });
  const total = Math.max(0, subtotal - discount) + shipping;
  const freeOver = freeShippingThreshold();

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function goToPayment() {
    if (!form.name.trim() || !form.phone.trim()) { setError('Completa tu nombre y WhatsApp'); return; }
    if (!pickup && form.address.trim().length < 5) { setError('Ingresa una dirección de entrega válida'); return; }
    setError('');
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handlePlaceOrder() {
    if (payMethod === 'culqi' && !form.email) { setError('El correo es obligatorio para pagar con tarjeta'); return; }
    setLoading(true); setError('');
    try {
      const orderData = {
        items: cart.map(i => ({ productId: i.id, qty: i.qty })),
        paymentMethod: payMethod,
        couponCode: coupon || undefined,
        pickupInStore: pickup,
        shipName: form.name,
        shipPhone: form.phone,
        shipEmail: form.email || undefined,
        shipAddress: pickup ? 'Recojo en el salón (Cieneguilla)' : form.address,
        shipDistrict: pickup ? 'Cieneguilla' : form.district,
      };
      const result = await api.orders.create(orderData) as Record<string, unknown>;
      setFullOrderId(result.id as string);
      setOrderId((result.id as string).slice(-6).toUpperCase());
      if (payMethod === 'culqi') {
        setCulqiOrderId(result.id as string);
      } else {
        clear();
        setSuccess(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el pedido');
    } finally {
      setLoading(false);
    }
  }

  async function payOrderCard(token: string) {
    if (!culqiOrderId) return;
    setLoading(true); setError('');
    try {
      await api.payments.culqi({ orderId: culqiOrderId, culqiToken: token, email: form.email || '' });
      closeCulqi();
      clear();
      setSuccess(true);
    } catch (e) {
      closeCulqi();
      setError(e instanceof Error ? e.message : 'No se pudo procesar el pago con tarjeta');
    } finally {
      setLoading(false);
    }
  }

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

  // ---------- Pantalla de éxito ----------
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
          <p className="text-xs text-gray-400 mb-4">{pickup ? '🏬 Recojo en el salón (Cieneguilla)' : '🚚 Envío a domicilio'}</p>
          {payMethod === 'yape' ? (
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 my-5 text-left">
              <p className="font-bold text-purple-800 mb-2">📱 Paga por Yape</p>
              {settings?.yapeNumber
                ? <p className="text-sm text-purple-700 mb-1">Yapea a: <strong>{settings.yapeNumber}</strong>{settings.yapeName ? <> ({settings.yapeName})</> : null}</p>
                : <p className="text-sm text-purple-700 mb-1">Pídenos el número de Yape por WhatsApp.</p>}
              {settings?.plinNumber ? <p className="text-sm text-purple-700 mb-1">o Plin: <strong>{settings.plinNumber}</strong></p> : null}
              <p className="text-sm text-purple-700 mb-3">Monto: <strong>{money(total)}</strong></p>
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
          <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500 text-white font-bold px-7 py-3.5 rounded-full text-sm hover:bg-green-600 transition-colors mb-3">
            💬 Confirmar por WhatsApp
          </a>
          <Link href="/tienda" className="block text-sm text-gray-400 hover:text-gray-600 underline mt-2">Seguir comprando</Link>
        </div>
      </div>
    );
  }

  // ---------- Checkout por pasos ----------
  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-28 md:pb-10">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/carrito" className="text-gray-500 hover:text-primary-600 flex items-center gap-1 text-sm">
            <ChevronLeft className="w-4 h-4" /> Carrito
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="font-display font-bold text-gray-900">Checkout</h1>
        </div>
      </div>

      {/* Stepper */}
      <div className="max-w-4xl mx-auto px-4 pt-5">
        <div className="flex items-center gap-2 text-xs font-semibold">
          {[{ n: 1, label: 'Entrega' }, { n: 2, label: 'Pago' }].map(({ n, label }, i) => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <button onClick={() => n < step && setStep(n as 1 | 2)} className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step >= n ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {step > n ? <Check className="w-3.5 h-3.5" /> : n}
                </span>
                <span className={step >= n ? 'text-gray-900' : 'text-gray-400'}>{label}</span>
              </button>
              {i === 0 && <div className={`flex-1 h-px ${step > 1 ? 'bg-primary-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 grid md:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-5">
          {step === 1 ? (
            <>
              {/* Modo de entrega */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-4">¿Cómo quieres recibir tu pedido?</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'delivery' as const, icon: Truck, label: 'Envío a domicilio', desc: 'Costo según distrito' },
                    { id: 'pickup' as const, icon: Store, label: 'Recojo en salón', desc: 'Gratis · Cieneguilla' },
                  ].map(({ id, icon: Icon, label, desc }) => (
                    <button key={id} type="button" onClick={() => setDelivery(id)}
                      className={`p-4 border-2 rounded-2xl text-left transition-all ${delivery === id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <Icon className={`w-6 h-6 mb-1 ${delivery === id ? 'text-primary-600' : 'text-gray-400'}`} />
                      <p className="font-bold text-sm text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Datos */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-4">{pickup ? 'Tus datos' : 'Datos de entrega'}</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre completo *</label>
                    <input type="text" value={form.name} onChange={set('name')} placeholder="Tu nombre"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">WhatsApp *</label>
                      <input type="tel" value={form.phone} onChange={set('phone')} placeholder="9XX XXX XXX"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                      <input type="email" value={form.email} onChange={set('email')} placeholder="opcional"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                  {!pickup && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Dirección *</label>
                        <input type="text" value={form.address} onChange={set('address')} placeholder="Av. / Calle, número, referencia"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Distrito</label>
                        <select value={form.district} onChange={set('district')}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                          {LIMA_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <p className="text-xs text-gray-400 mt-1">Envío estimado: <strong>{shipping === 0 ? 'Gratis' : money(shipping)}</strong></p>
                      </div>
                    </>
                  )}
                  {pickup && (
                    <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 flex items-start gap-2">
                      <Store className="w-4 h-4 mt-0.5 text-primary-600 shrink-0" />
                      <span>Recoge tu pedido en nuestro salón en <strong>Cieneguilla</strong>. Te avisaremos por WhatsApp cuando esté listo.</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Paso 2: pago */
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4">Método de pago</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'yape' as const, label: 'Yape / Plin', icon: '📱', desc: 'Paga al número del salón' },
                  { id: 'culqi' as const, label: 'Tarjeta', icon: '💳', desc: CULQI_PK ? 'Visa / Mastercard' : 'Próximamente' },
                ].map(({ id, label, icon, desc }) => {
                  const isDisabled = id === 'culqi' && !CULQI_PK;
                  return (
                    <button key={id} type="button"
                      onClick={() => { if (!isDisabled) { setPayMethod(id); setCulqiOrderId(null); setError(''); } }}
                      disabled={isDisabled}
                      className={`p-4 border-2 rounded-2xl text-left transition-all ${payMethod === id && !isDisabled ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'} ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                      <span className="text-2xl block mb-1">{icon}</span>
                      <p className="font-bold text-sm text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setStep(1)} className="mt-4 text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Volver a entrega
              </button>
            </div>
          )}
        </div>

        {/* Resumen */}
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm md:sticky md:top-20">
            <h2 className="font-bold text-gray-900 mb-4">Tu pedido</h2>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate">{item.name} ×{item.qty}</span>
                  <span className="font-medium text-gray-900 ml-2 shrink-0">{money(item.pricePen * item.qty)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 text-sm border-t border-gray-100 pt-3 mb-3">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{money(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-green-600"><span>Descuento</span><span>-{money(discount)}</span></div>}
              <div className="flex justify-between text-gray-600">
                <span>{pickup ? 'Recojo en salón' : 'Envío'}</span>
                <span>{shipping === 0 ? <span className="text-green-600">Gratis</span> : money(shipping)}</span>
              </div>
              {!pickup && freeOver > 0 && subtotal < freeOver && (
                <p className="text-[11px] text-gray-400">Envío gratis desde {money(freeOver)}</p>
              )}
              <div className="flex justify-between font-black text-gray-900 text-base pt-1 border-t border-gray-100"><span>Total</span><span>{money(total)}</span></div>
            </div>

            {error && <p className="text-red-600 text-xs mb-3">{error}</p>}

            {/* Acción según paso (desktop) */}
            <div className="hidden md:block">
              {step === 1 ? (
                <button onClick={goToPayment}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-full text-sm transition-all active:scale-95"
                  style={{ boxShadow: '0 4px 20px rgba(219,39,119,0.4)' }}>
                  Continuar al pago <ArrowRight className="w-4 h-4" />
                </button>
              ) : payMethod === 'culqi' && culqiOrderId && CULQI_PK ? (
                <>
                  <CulqiCheckout publicKey={CULQI_PK} amountCents={Math.round(total * 100)}
                    title="Pedido — Deyanira Makeup Beauty" email={form.email} onToken={payOrderCard}
                    onError={(m) => setError(m)} disabled={loading} label={loading ? 'Procesando…' : 'Pagar con tarjeta'}
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full font-bold text-sm text-white transition-all disabled:opacity-50" />
                  <p className="text-center text-xs text-gray-400 mt-2">Tu pedido #{orderId} fue creado. Completa el pago para confirmarlo.</p>
                </>
              ) : (
                <button onClick={handlePlaceOrder} disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-full text-sm transition-all disabled:opacity-50 active:scale-95"
                  style={{ boxShadow: '0 4px 20px rgba(219,39,119,0.4)' }}>
                  {loading ? 'Procesando...' : <>{payMethod === 'yape' ? '📱 Confirmar pedido' : '💳 Continuar al pago'} <ArrowRight className="w-4 h-4" /></>}
                </button>
              )}
            </div>
            <p className="hidden md:flex text-center text-xs text-gray-400 mt-3 items-center justify-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Pago 100% seguro</p>
          </div>
        </div>
      </div>

      {/* Barra de acción fija (móvil) */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">Total</span>
          <span className="font-black text-gray-900">{money(total)}</span>
        </div>
        {step === 1 ? (
          <button onClick={goToPayment}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 text-white font-bold rounded-full text-sm active:scale-95">
            Continuar al pago <ArrowRight className="w-4 h-4" />
          </button>
        ) : payMethod === 'culqi' && culqiOrderId && CULQI_PK ? (
          <CulqiCheckout publicKey={CULQI_PK} amountCents={Math.round(total * 100)}
            title="Pedido — Deyanira Makeup Beauty" email={form.email} onToken={payOrderCard}
            onError={(m) => setError(m)} disabled={loading} label={loading ? 'Procesando…' : 'Pagar con tarjeta'}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full font-bold text-sm text-white" />
        ) : (
          <button onClick={handlePlaceOrder} disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 text-white font-bold rounded-full text-sm disabled:opacity-50 active:scale-95">
            {loading ? 'Procesando...' : <>{payMethod === 'yape' ? '📱 Confirmar pedido' : '💳 Continuar al pago'} <ArrowRight className="w-4 h-4" /></>}
          </button>
        )}
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
