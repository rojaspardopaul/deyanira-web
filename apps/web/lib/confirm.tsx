'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

// Confirmación imperativa y ESTILIZADA (reemplaza window.confirm). Permite
// resaltar datos dinámicos en el mensaje (negrita/colores con highlight.tsx).
// REGLA DE ORO: toda acción que cambie/elimine/verifique algo pasa por aquí.
//
// Uso:
//   if (!(await confirmAction({ title, message: <>…</>, danger: true }))) return;
// Requiere <ConfirmHost/> montado una vez (en el layout admin).

type ConfirmOpts = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
};
type Req = { opts: ConfirmOpts; resolve: (v: boolean) => void };

let pushRequest: ((r: Req) => void) | null = null;

export function confirmAction(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    // Fallback si el host no está montado (SSR/edge): no bloquear el flujo.
    if (typeof window === 'undefined' || !pushRequest) {
      resolve(window?.confirm?.(opts.title) ?? false);
      return;
    }
    pushRequest({ opts, resolve });
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Req | null>(null);

  useEffect(() => {
    pushRequest = (r) => setReq(r);
    return () => { pushRequest = null; };
  }, []);

  if (!req) return null;

  const settle = (value: boolean) => { req.resolve(value); setReq(null); };

  return (
    <ConfirmModal
      dialog={{
        title: req.opts.title,
        message: req.opts.message,
        confirmLabel: req.opts.confirmLabel || (req.opts.danger ? 'Sí, eliminar' : 'Confirmar'),
        confirmClass: req.opts.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-gold-600 hover:bg-gold-500',
        onConfirm: () => settle(true),
      }}
      onClose={() => settle(false)}
    />
  );
}
