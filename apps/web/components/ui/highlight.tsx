import type { ReactNode } from 'react';

// Resaltado consistente de datos dinámicos en mensajes de confirmación/advertencia.
// REGLA: lo importante va en negrita; lo "previo" en gris, lo "nuevo/resultado" en
// verde, y lo destructivo en rojo — para que de un vistazo se entienda qué quedará.

/** Dato importante (neutro) — negrita oscura */
export const HL = ({ children }: { children: ReactNode }) =>
  <strong className="font-bold text-gray-900">{children}</strong>;

/** Valor PREVIO / que se reemplaza — negrita gris */
export const Old = ({ children }: { children: ReactNode }) =>
  <strong className="font-bold text-gray-500 line-through decoration-gray-300">{children}</strong>;

/** Valor NUEVO / resultado que quedará — negrita verde */
export const New = ({ children }: { children: ReactNode }) =>
  <strong className="font-bold text-emerald-600">{children}</strong>;

/** Monto / dato positivo — negrita verde */
export const Money = ({ children }: { children: ReactNode }) =>
  <strong className="font-bold text-emerald-600">{children}</strong>;

/** Acción/dato destructivo o irreversible — negrita roja */
export const Danger = ({ children }: { children: ReactNode }) =>
  <strong className="font-bold text-red-600">{children}</strong>;

/** Aviso / estado en revisión — negrita ámbar */
export const Warn = ({ children }: { children: ReactNode }) =>
  <strong className="font-bold text-amber-600">{children}</strong>;
