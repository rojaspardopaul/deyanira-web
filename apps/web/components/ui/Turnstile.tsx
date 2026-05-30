'use client';

import { useEffect, useRef } from 'react';

/**
 * Widget de Cloudflare Turnstile (captcha anti-bot, casi invisible).
 *
 * Si NEXT_PUBLIC_TURNSTILE_SITE_KEY no está definido, el componente no renderiza
 * nada (el backend también es no-op sin su secret). Así dev/local funciona igual.
 *
 * El token se entrega vía onToken y debe enviarse al backend como `turnstileToken`.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
    __turnstileLoading?: Promise<void>;
  }
}

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (window.__turnstileLoading) return window.__turnstileLoading;
  window.__turnstileLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile_script_failed'));
    document.head.appendChild(s);
  });
  return window.__turnstileLoading;
}

export default function Turnstile({
  onToken,
  theme = 'light',
  className,
}: {
  onToken: (token: string) => void;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return; // no-op sin configuración
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          theme,
          callback: (token: string) => onToken(token),
          'error-callback': () => onToken(''),
          'expired-callback': () => onToken(''),
        });
      })
      .catch(() => { /* falla de red: backend tolera ausencia de token */ });

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* noop */ }
      }
    };
    // onToken/theme se mantienen estables por el caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={ref} className={className} />;
}
