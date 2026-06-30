'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Integración con Culqi Checkout v4. Carga el script una sola vez y abre el
// formulario de tarjeta, devolviendo el token (el PAN nunca toca el servidor).
// Docs: https://docs.culqi.com/
//
// Se expone como hook para poder abrir el popup de forma imperativa (p. ej. al
// seleccionar "Tarjeta" en el checkout), no solo desde un botón.

const CULQI_SRC = 'https://checkout.culqi.com/js/v4';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { Culqi?: any; culqi?: () => void }
}

// Cierra el modal/overlay de Culqi. Imprescindible llamarlo tras recibir el token
// (Culqi v4 no lo cierra solo): su overlay full-screen tapa cualquier mensaje de
// éxito/error que mostremos en nuestra página.
export function closeCulqi(): void {
  try { window.Culqi?.close?.(); } catch { /* ignore */ }
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

export type UseCulqiOptions = {
  publicKey: string;
  amountCents: number;        // monto en céntimos (S/ × 100)
  title: string;
  email?: string;
  onToken: (token: string) => void;
  onError?: (msg: string) => void;
};

export function useCulqi({ publicKey, amountCents, title, email, onToken, onError }: UseCulqiOptions) {
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
      style: { buttonText: 'Pagar', buttonTextColor: '#ffffff', buttonBackground: '#FF4FA2', menuColor: '#FF4FA2' },
    });
    // Callback global que Culqi invoca al terminar
    window.culqi = function () {
      const C = window.Culqi;
      if (C?.token?.id) {
        const tokenId = C.token.id;
        // Cerramos el modal de Culqi de inmediato: ya tenemos el token y el
        // formulario cumplió su función. Si esperamos al round-trip del backend,
        // el modal sigue abierto con su botón "Pagar" activo y el cliente puede
        // volver a pulsarlo (genera un segundo token y confunde). Cerrar aquí deja
        // que la página muestre su propio loading mientras se cobra.
        closeCulqi();
        onTokenRef.current(tokenId);
      } else if (C?.error) {
        onErrorRef.current?.(C.error.user_message || 'No se pudo procesar la tarjeta');
      }
    };
    Culqi.open();
  }, [publicKey, amountCents, title, email]);

  return { open, ready };
}
