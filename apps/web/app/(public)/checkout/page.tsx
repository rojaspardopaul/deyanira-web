'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Check, ArrowRight, Truck, Store, ShieldCheck, CreditCard, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { useSalonSettings } from '@/lib/useSalonSettings';
import { useCart, type CartItem } from '@/components/shop/CartProvider';
import { LIMA_DISTRICTS } from '@/lib/districts';
import { setShippingRates, shippingForOrder, freeShippingThreshold } from '@/lib/shipping';
import { useCulqi, closeCulqi } from '@/components/payments/useCulqi';

const TEST_CUSTOMER_EMAIL = (process.env.NEXT_PUBLIC_TEST_CUSTOMER_EMAIL || 'test.customer@deyanira.pe').toLowerCase();
const money = (n: number) => `S/ ${n.toFixed(2)}`;

type OrderSnapshot = { items: CartItem[]; subtotal: number; shipping: number; discount: number; total: number };

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const settings = useSalonSettings();
  const { items: cart, subtotal, clear } = useCart();
  const discount = parseFloat(searchParams.get('discount') || '0') || 0;
  const coupon = searchParams.get('coupon') || '';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mounted, setMounted] = useState(false);
  const [delivery, setDelivery] = useState<'delivery' | 'pickup'>('delivery');
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', district: 'Cieneguilla' });
  const [payMethod, setPayMethod] = useState<'yape' | 'culqi'>('yape');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [customerToken, setCustomerToken] = useState('');
  const [culqiOrderId, setCulqiOrderId] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);   // pedido Yape registrado (esperando comprobante)
  const [snap, setSnap] = useState<OrderSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [fullOrderId, setFullOrderId] = useState('');
  const [error, setError] = useState('');
  const [proofBusy, setProofBusy] = useState(false);
  const [proofDone, setProofDone] = useState(false);
  const [proofError, setProofError] = useState('');
  const processingRef = useRef(false);   // cobro con tarjeta en curso (evita doble procesamiento)

  useEffect(() => { setMounted(true); }, []);

  // Tarifa de envío desde la config pública (el backend es la autoridad).
  useEffect(() => { if (settings) setShippingRates(settings as Record<string, unknown>); }, [settings]);

  // Si el carrito está vacío (y no acabamos de comprar), volver al carrito.
  useEffect(() => {
    if (mounted && cart.length === 0 && !success && !placed) router.push('/carrito');
  }, [mounted, cart.length, success, placed, router]);

  // Autocompletar datos con el perfil del usuario logueado.
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const supabase = createClient();
        const sessionResponse = await supabase.auth.getSession();
        const sessionUser = sessionResponse.data.session?.user;
        const fallbackUserResponse = await supabase.auth.getUser();
        const user = sessionUser || fallbackUserResponse.data.user;
        if (!user || cancel) return;
        const name = (user.user_metadata as Record<string, unknown>)?.name as string || (user.user_metadata as Record<string, unknown>)?.full_name as string || '';
        const phone = (user.user_metadata as Record<string, unknown>)?.phone as string || '';
        const email = user.email || '';
        try {
          if (!cancel && sessionResponse.data.session?.access_token) {
            const token = sessionResponse.data.session.access_token;
            setCustomerToken(token);
            const me = await api.customers.me(token);
            setForm(f => ({
              ...f,
              name: f.name || me.name || name,
              phone: f.phone || me.phone || phone,
              email: f.email || email,
              address: f.address || me.address || '',
              district: me.district || f.district,
            }));
          } else if (!cancel) {
            setForm(f => ({ ...f, name: f.name || name, phone: f.phone || phone, email: f.email || email }));
          }
        } catch {
          if (!cancel) {
            setForm(f => ({ ...f, name: f.name || name, phone: f.phone || phone, email: f.email || email }));
          }
        }
        if (!cancel) setCurrentUserEmail(email);
      } catch { /* sin sesión */ }
    })();
    return () => { cancel = true; };
  }, []);

  const pickup = delivery === 'pickup';
  const shipping = shippingForOrder({ subtotal, district: form.district, pickupInStore: pickup });
  const total = Math.max(0, subtotal - discount) + shipping;
  const freeOver = freeShippingThreshold();
  const normalizedEnteredEmail = form.email.trim().toLowerCase();
  // Llave pública de Culqi: fuente única en el backend (settings públicos), igual
  // que la pantalla de reservas. Fallback a env por compatibilidad.
  const CULQI_PK = (settings?.culqiPublicKey as string) || process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY || '';
  const canUseCard = Boolean(CULQI_PK) && (currentUserEmail.toLowerCase() === TEST_CUSTOMER_EMAIL || normalizedEnteredEmail === TEST_CUSTOMER_EMAIL);
  // Una vez creado el pedido (Yape registrado o pedido de tarjeta en curso) no se
  // puede editar entrega ni cambiar de método: bloquea la navegación del stepper.
  const committed = placed || Boolean(culqiOrderId);

  useEffect(() => {
    if (payMethod === 'culqi' && !canUseCard) { setPayMethod('yape'); setError(''); }
  }, [canUseCard, payMethod]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function step1Valid() {
    if (!form.name.trim() || !form.phone.trim()) return false;
    if (!pickup && form.address.trim().length < 5) return false;
    return true;
  }

  // Navegación libre del stepper (avanzar/retroceder). Valida los datos de entrega
  // antes de avanzar y queda bloqueada una vez creado el pedido.
  function goToStep(n: 1 | 2 | 3) {
    if (committed || n === step) return;
    if (n > 1 && !step1Valid()) {
      setError(pickup ? 'Completa tu nombre y WhatsApp' : 'Completa tus datos de entrega');
      setStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setError('');
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Paso 1 → 2: valida datos de entrega.
  function goToConfirm() {
    if (!form.name.trim() || !form.phone.trim()) { setError('Completa tu nombre y WhatsApp'); return; }
    if (!pickup && form.address.trim().length < 5) { setError('Ingresa una dirección de entrega válida'); return; }
    setError('');
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function buildOrderData(method: 'yape' | 'culqi') {
    return {
      items: cart.map(i => ({ productId: i.id, qty: i.qty })),
      paymentMethod: method,
      couponCode: coupon || undefined,
      pickupInStore: pickup,
      shipName: form.name,
      shipPhone: form.phone,
      shipEmail: form.email || undefined,
      shipAddress: pickup ? 'Recojo en el salón (Cieneguilla)' : form.address,
      shipDistrict: pickup ? 'Cieneguilla' : form.district,
    };
  }

  // Congela el resumen (antes de vaciar el carrito) para que el paso 3 / éxito lo sigan mostrando.
  function snapshotAndClear() {
    setSnap({ items: cart, subtotal, shipping, discount, total });
    clear();
  }

  function saveDefaultAddress() {
    if (customerToken && !pickup && form.address.trim()) {
      api.customers.updateMe({ address: form.address.trim(), district: form.district || null }, customerToken).catch(() => {});
    }
  }

  // Token fresco de la sesión: imprescindible para que el pedido quede asociado a
  // la cuenta del cliente (si no, el backend lo trata como invitado).
  async function getAccessToken(): Promise<string | undefined> {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || customerToken || undefined;
    } catch {
      return customerToken || undefined;
    }
  }

  // Yape: crea el pedido (queda pendiente de pago) y muestra las instrucciones.
  async function confirmYape() {
    setLoading(true); setError('');
    try {
      const token = await getAccessToken();
      const result = await api.orders.create(buildOrderData('yape'), token) as Record<string, unknown>;
      const id = result.id as string;
      setFullOrderId(id);
      setOrderId(id.slice(-6).toUpperCase());
      saveDefaultAddress();
      snapshotAndClear();
      setPlaced(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el pedido');
    } finally {
      setLoading(false);
    }
  }

  // Tarjeta: crea el pedido una sola vez (reutilizado en reintentos). El cobro va aparte.
  async function ensureCardOrder(): Promise<string> {
    if (culqiOrderId) return culqiOrderId;
    const token = await getAccessToken();
    const result = await api.orders.create(buildOrderData('culqi'), token) as Record<string, unknown>;
    const id = result.id as string;
    setCulqiOrderId(id);
    setFullOrderId(id);
    setOrderId(id.slice(-6).toUpperCase());
    saveDefaultAddress();
    return id;
  }

  // Tarjeta: con el token de Culqi creamos+cobramos. Si el cobro falla NO se
  // confirma el pedido (queda sin pagar y el cliente puede reintentar).
  async function onCardToken(token: string) {
    // Anti-reentrada: si el cliente alcanzó a generar dos tokens (doble clic en
    // "Pagar" antes de que el modal cerrara), ignoramos el segundo para no cobrar
    // dos veces ni mostrar un error tras un pago ya aprobado.
    if (processingRef.current) return;
    processingRef.current = true;
    setLoading(true); setError('');
    try {
      const id = await ensureCardOrder();
      await api.payments.culqi({ orderId: id, culqiToken: token, email: form.email || '' });
      closeCulqi();
      snapshotAndClear();
      setSuccess(true);
    } catch (e) {
      closeCulqi();
      setError(e instanceof Error ? e.message : 'No se pudo procesar el pago. No se realizó ningún cargo, intenta de nuevo.');
    } finally {
      setLoading(false);
      processingRef.current = false;
    }
  }

  const { open: openCulqi, ready: culqiReady } = useCulqi({
    publicKey: CULQI_PK,
    amountCents: Math.round(total * 100),
    title: 'Pedido — Deyanira Makeup Beauty',
    email: form.email,
    onToken: onCardToken,
    onError: (m) => setError(m),
  });

  // Abre el formulario de tarjeta de Culqi (validando requisitos primero).
  function openCardPopup() {
    if (!canUseCard) { setError('El pago con tarjeta solo está habilitado para el usuario de pruebas.'); return; }
    if (!form.email) { setError('Necesitamos tu correo para pagar con tarjeta. Edítalo en “Datos de entrega”.'); return; }
    if (!culqiReady) { setError('La pasarela de pago está cargando, intenta de nuevo en unos segundos.'); return; }
    setError('');
    openCulqi();
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

  // Resumen a mostrar: tras confirmar usamos el snapshot (el carrito ya se vació).
  const view: OrderSnapshot = snap ?? { items: cart, subtotal, shipping, discount, total };

  const waNumber = (settings?.whatsapp || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  const waMsg = payMethod === 'yape'
    ? `Hola! Hice un pedido (#${orderId}) y pagué por Yape. Adjunto mi comprobante.`
    : `Hola! Hice el pedido #${orderId}. Por favor confírmenme cuando esté listo.`;

  // Instrucciones de pago Yape/Plin (reutilizadas en el paso 3 y en la pantalla de éxito).
  const yapeBox = (
    <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 text-left">
      <p className="font-bold text-purple-800 mb-2">📱 Paga por Yape / Plin</p>
      {settings?.yapeNumber
        ? <p className="text-sm text-purple-700 mb-1">Yapea a: <strong>{settings.yapeNumber}</strong>{settings.yapeName ? <> ({settings.yapeName})</> : null}</p>
        : <p className="text-sm text-purple-700 mb-1">Pídenos el número de Yape por WhatsApp.</p>}
      {settings?.plinNumber ? <p className="text-sm text-purple-700 mb-1">o Plin: <strong>{settings.plinNumber}</strong></p> : null}
      <p className="text-sm text-purple-700 mb-3">Monto: <strong>{money(view.total)}</strong></p>
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
  );

  // ---------- Pantalla de éxito (pago con tarjeta completado) ----------
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Check className="w-10 h-10 text-green-600" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-display font-bold text-gray-900 mb-2">¡Pago confirmado!</h1>
          <p className="text-gray-500 mb-1">Pedido <strong>#{orderId}</strong></p>
          <p className="text-xs text-gray-400 mb-4">{pickup ? '🏬 Recojo en el salón (Cieneguilla)' : '🚚 Envío a domicilio'}</p>
          <p className="text-gray-500 text-sm my-5">Tu pago con tarjeta fue procesado correctamente. Recibirás la confirmación por email.</p>
          <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500 text-white font-bold px-7 py-3.5 rounded-full text-sm hover:bg-green-600 transition-colors mb-3">
            💬 Confirmar por WhatsApp
          </a>
          <Link href="/tienda" className="block text-sm text-gray-400 hover:text-gray-600 underline mt-2">Seguir comprando</Link>
        </div>
      </div>
    );
  }

  const steps = [
    { n: 1 as const, label: 'Datos de entrega' },
    { n: 2 as const, label: 'Resumen pedido' },
    { n: 3 as const, label: 'Pago' },
  ];
  // Estados del paso 3: A) Yape registrado · B) tarjeta creada esperando cobro · C) selección.
  const cardPending = !placed && Boolean(culqiOrderId);

  // Acción principal (derecha desktop + barra móvil) según el paso/estado.
  const primaryAction = (mobile: boolean) => {
    const base = mobile
      ? 'w-full flex items-center justify-center gap-2 py-3.5 text-white font-bold rounded-full text-sm active:scale-95'
      : 'w-full flex items-center justify-center gap-2 py-3.5 text-white font-bold rounded-full text-sm transition-all active:scale-95';
    const primary = `${base} bg-primary-600 ${mobile ? '' : 'hover:bg-primary-500'} disabled:opacity-50`;
    const shadow = mobile ? undefined : { boxShadow: '0 4px 20px rgba(219,39,119,0.4)' };

    if (step === 1) {
      return <button onClick={goToConfirm} className={primary} style={shadow}>Continuar <ArrowRight className="w-4 h-4" /></button>;
    }
    if (step === 2) {
      return <button onClick={() => goToStep(3)} className={primary} style={shadow}>Ir a pagar <ArrowRight className="w-4 h-4" /></button>;
    }
    // step === 3
    if (placed) {
      return (
        <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer"
          className={`${base} bg-green-500 ${mobile ? '' : 'hover:bg-green-600'}`}>
          💬 Confirmar por WhatsApp
        </a>
      );
    }
    if (payMethod === 'culqi') {
      return (
        <button onClick={openCardPopup} disabled={loading || !culqiReady}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full font-bold text-sm text-white transition-all active:scale-95 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)' }}>
          <CreditCard className="w-4 h-4" />
          {loading ? 'Procesando…' : !culqiReady ? 'Cargando…' : cardPending ? 'Reintentar pago' : 'Pagar con tarjeta'}
        </button>
      );
    }
    return (
      <button onClick={confirmYape} disabled={loading} className={primary} style={shadow}>
        {loading ? 'Procesando...' : <>Confirmar pedido <ArrowRight className="w-4 h-4" /></>}
      </button>
    );
  };

  // ---------- Checkout por pasos ----------
  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-28 md:pb-10">
      {/* Overlay bloqueante mientras se procesa (sobre todo el cobro con tarjeta: el
          modal de Culqi ya cerró, así que este loading es el feedback del cliente). */}
      {loading && (
        <div className="fixed inset-0 z-[60] bg-white/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl px-6 py-5 shadow-xl border border-gray-100 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
            <span className="text-sm font-semibold text-gray-800">
              {payMethod === 'culqi' ? 'Procesando tu pago…' : 'Registrando tu pedido…'}
            </span>
          </div>
        </div>
      )}
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
          {steps.map(({ n, label }, i) => (
            <div key={n} className="flex items-center gap-2 flex-1 last:flex-none">
              <button type="button" onClick={() => goToStep(n)} disabled={committed || n === step}
                className="flex items-center gap-2 shrink-0 disabled:cursor-default enabled:hover:opacity-80 transition-opacity">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step >= n ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {step > n ? <Check className="w-3.5 h-3.5" /> : n}
                </span>
                <span className={`hidden sm:inline ${step >= n ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
              </button>
              {i < steps.length - 1 && <div className={`flex-1 h-px ${step > n ? 'bg-primary-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
        {/* En móvil ocultamos las etiquetas del stepper; mostramos solo la del paso actual. */}
        <p className="sm:hidden mt-2 text-sm font-bold text-gray-900">{steps[step - 1].label}</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 grid md:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-5 min-w-0">
          {step === 1 && (
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
                      <input type="email" value={form.email} onChange={set('email')} placeholder="tu@email.com"
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
          )}

          {step === 2 && (
            <>
              {/* Resumen de entrega (editable) */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-gray-900">{pickup ? 'Recojo en salón' : 'Datos de entrega'}</h2>
                  <button type="button" onClick={() => goToStep(1)} className="text-xs font-semibold text-primary-600 hover:text-primary-700">Editar</button>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><span className="text-gray-400">Nombre:</span> {form.name || '—'}</p>
                  <p><span className="text-gray-400">WhatsApp:</span> {form.phone || '—'}</p>
                  {form.email && <p><span className="text-gray-400">Email:</span> {form.email}</p>}
                  {pickup ? (
                    <p className="flex items-start gap-2 pt-1"><Store className="w-4 h-4 mt-0.5 text-primary-600 shrink-0" /> Recojo en el salón (Cieneguilla)</p>
                  ) : (
                    <p className="flex items-start gap-2 pt-1"><Truck className="w-4 h-4 mt-0.5 text-primary-600 shrink-0" /> {form.address}, {form.district}</p>
                  )}
                </div>
              </div>

              {/* Revisión del pedido (el método de pago se elige en el paso siguiente) */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-3">Revisa tu pedido</h2>
                <div className="space-y-2">
                  {view.items.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-600 truncate pr-2 min-w-0">{item.name} ×{item.qty}</span>
                      <span className="font-medium text-gray-900 shrink-0">{money(item.pricePen * item.qty)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">Elegirás el método de pago en el siguiente paso.</p>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
              {placed ? (
                /* A) Yape registrado: instrucciones de pago */
                <>
                  <div>
                    <h2 className="font-bold text-gray-900 mb-1">Pago por Yape / Plin</h2>
                    <p className="text-sm text-gray-500">Pedido <strong className="text-gray-700">#{orderId}</strong> registrado. {pickup ? 'Recojo en el salón (Cieneguilla).' : 'Envío a domicilio.'}</p>
                  </div>
                  {yapeBox}
                  <Link href="/tienda" className="block text-sm text-gray-400 hover:text-gray-600 underline">Seguir comprando</Link>
                </>
              ) : cardPending ? (
                /* B) Pedido de tarjeta creado, esperando cobro (reintento) */
                <>
                  <div>
                    <h2 className="font-bold text-gray-900 mb-1">Pago con tarjeta</h2>
                    <p className="text-sm text-gray-500">Pedido <strong className="text-gray-700">#{orderId}</strong> creado. Completa el pago para confirmarlo.</p>
                  </div>
                  <div className="flex items-center gap-3 border-2 border-primary-500 bg-primary-50 rounded-2xl p-4">
                    <span className="text-2xl">💳</span>
                    <div><p className="text-xs text-gray-500">Método de pago</p><p className="font-bold text-sm text-gray-900">Tarjeta</p></div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>El pago no se completó (no se realizó ningún cargo). Pulsa <strong>Reintentar pago</strong> para abrir de nuevo el formulario de tarjeta.</span>
                  </div>
                  <Link href="/tienda" className="block text-sm text-gray-400 hover:text-gray-600 underline">Seguir comprando</Link>
                </>
              ) : (
                /* C) Selección de método de pago */
                <>
                  <h2 className="font-bold text-gray-900">Método de pago</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'yape' as const, label: 'Yape / Plin', icon: '📱', desc: 'Paga al número del salón' },
                      { id: 'culqi' as const, label: 'Tarjeta', icon: '💳', desc: canUseCard ? 'Visa / Mastercard' : 'Solo para el usuario de pruebas' },
                    ].map(({ id, label, icon, desc }) => {
                      const isDisabled = id === 'culqi' && !canUseCard;
                      const onPick = () => {
                        if (isDisabled) return;
                        setPayMethod(id);
                        setError('');
                        if (id === 'culqi') openCardPopup();   // abre el popup de Culqi al instante
                      };
                      return (
                        <button key={id} type="button" onClick={onPick} disabled={isDisabled}
                          className={`p-4 border-2 rounded-2xl text-left transition-all ${payMethod === id && !isDisabled ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'} ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                          <span className="text-2xl block mb-1">{icon}</span>
                          <p className="font-bold text-sm text-gray-900">{label}</p>
                          <p className="text-xs text-gray-500">{desc}</p>
                        </button>
                      );
                    })}
                  </div>
                  {/* Formulario según la selección */}
                  {payMethod === 'yape' ? (
                    <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-sm text-purple-700">
                      <p className="font-bold text-purple-800 mb-1">📱 Yape / Plin</p>
                      <p>Al confirmar te mostraremos el número del salón y el monto (<strong>{money(view.total)}</strong>) para que pagues y subas tu comprobante.</p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-600 flex items-start gap-2">
                      <CreditCard className="w-4 h-4 mt-0.5 text-primary-600 shrink-0" />
                      <span>Se abrirá el formulario seguro de Culqi para ingresar tu tarjeta. Si lo cerraste, pulsa <strong>Pagar con tarjeta</strong>. El pedido se confirma solo si el pago es aprobado.</span>
                    </div>
                  )}
                  <button type="button" onClick={() => goToStep(2)} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
                    <ChevronLeft className="w-4 h-4" /> Volver al resumen
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Resumen */}
        <div className="min-w-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm md:sticky md:top-20">
            <h2 className="font-bold text-gray-900 mb-4">Tu pedido</h2>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {view.items.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate min-w-0">{item.name} ×{item.qty}</span>
                  <span className="font-medium text-gray-900 ml-2 shrink-0">{money(item.pricePen * item.qty)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 text-sm border-t border-gray-100 pt-3 mb-3">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{money(view.subtotal)}</span></div>
              {view.discount > 0 && <div className="flex justify-between text-green-600"><span>Descuento</span><span>-{money(view.discount)}</span></div>}
              <div className="flex justify-between text-gray-600">
                <span>{pickup ? 'Recojo en salón' : 'Envío'}</span>
                <span>{view.shipping === 0 ? <span className="text-green-600">Gratis</span> : money(view.shipping)}</span>
              </div>
              {!pickup && freeOver > 0 && view.subtotal < freeOver && (
                <p className="text-[11px] text-gray-400">Envío gratis desde {money(freeOver)}</p>
              )}
              <div className="flex justify-between font-black text-gray-900 text-base pt-1 border-t border-gray-100"><span>Total</span><span>{money(view.total)}</span></div>
            </div>

            {error && <p className="text-red-600 text-xs mb-3">{error}</p>}

            {/* Acción según paso (desktop) */}
            <div className="hidden md:block">{primaryAction(false)}</div>
            <p className="hidden md:flex text-center text-xs text-gray-400 mt-3 items-center justify-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Pago 100% seguro</p>
          </div>
        </div>
      </div>

      {/* Barra de acción fija (móvil) */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">Total</span>
          <span className="font-black text-gray-900">{money(view.total)}</span>
        </div>
        {primaryAction(true)}
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
