'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CreditCard } from 'lucide-react';

// Integración con Culqi Checkout v4. Carga el script una sola vez, abre el
// formulario de tarjeta y devuelve el token (el PAN nunca toca nuestro servidor).
// Docs: https://docs.culqi.com/

const CULQI_SRC = 'https://checkout.culqi.com/js/v4';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { Culqi?: any; culqi?: () => void }
}

let scriptPromise: Promise<void> | null = null;
function loadCulqi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.Culqi) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CULQI_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar Culqi'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

type Props = {
  publicKey: string;
  amountCents: number;       // monto en céntimos (S/ × 100)
  title: string;
  email?: string;
  onToken: (token: string) => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
};

export default function CulqiCheckout({
  publicKey, amountCents, title, email, onToken, onError, disabled, className, label,
}: Props) {
  const [ready, setReady] = useState(false);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  onTokenRef.current = onToken;
  onErrorRef.current = onError;

  useEffect(() => {
    let active = true;
    loadCulqi().then(() => { if (active) setReady(true); }).catch((e) => onErrorRef.current?.(e.message));
    return () => { active = false; };
  }, []);

  const open = useCallback(() => {
    const Culqi = window.Culqi;
    if (!Culqi || !publicKey) { onErrorRef.current?.('Pago con tarjeta no disponible'); return; }
    Culqi.publicKey = publicKey;
    Culqi.settings({ title: title.slice(0, 50), currency: 'PEN', amount: amountCents });
    Culqi.options({
      lang: 'es',
      installments: false,
      paymentMethods: { tarjeta: true, yape: true, billetera: false, bancaMovil: false, agente: false, cuotealo: false },
      style: { buttonText: 'Pagar adelanto', buttonTextColor: '#ffffff', buttonBackground: '#FF4FA2', menuColor: '#FF4FA2' },
    });
    // Callback global que Culqi invoca al terminar
    window.culqi = function () {
      const C = window.Culqi;
      if (C?.token?.id) {
        onTokenRef.current(C.token.id);
      } else if (C?.error) {
        onErrorRef.current?.(C.error.user_message || 'No se pudo procesar la tarjeta');
      }
    };
    Culqi.open();
  }, [publicKey, amountCents, title, email]);

  return (
    <button
      type="button"
      onClick={open}
      disabled={disabled || !ready}
      className={className || 'w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm text-white transition-all disabled:opacity-50'}
      style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)' }}
    >
      <CreditCard className="w-4 h-4" />
      {ready ? (label || 'Pagar con tarjeta') : 'Cargando…'}
    </button>
  );
}
