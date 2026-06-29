'use client';

import { CreditCard } from 'lucide-react';
import { useCulqi, closeCulqi } from './useCulqi';

// Botón que abre el formulario de tarjeta de Culqi y devuelve el token.
// Envuelve el hook useCulqi para los usos que ya esperaban un botón listo
// (p. ej. la pantalla de reservas). El checkout de tienda usa el hook directo.
export { closeCulqi };

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
  const { open, ready } = useCulqi({ publicKey, amountCents, title, email, onToken, onError });

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
