// Etiquetas/colores compartidos del módulo de recibos (admin).

export const STATUS_UI: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'bg-gray-100 text-gray-600' },
  partial: { label: 'Parcial', cls: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Pagado', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Anulado', cls: 'bg-red-100 text-red-500' },
};

export const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
  transfer: 'Transferencia',
  culqi: 'Tarjeta',
};

export const METHODS = ['cash', 'yape', 'plin', 'transfer', 'culqi'] as const;

// Estado de la reserva (grupo de citas) que se muestra al vincular un recibo.
export const RESERVA_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Confirmada', cls: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'En curso', cls: 'bg-teal-100 text-teal-700' },
  completed: { label: 'Atendida', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', cls: 'bg-red-100 text-red-500' },
  no_show: { label: 'No asistió', cls: 'bg-gray-100 text-gray-500' },
};

export const money = (n: unknown) => `S/ ${Number(n || 0).toFixed(2)}`;

// 'YYYY-MM-DD' o ISO → '15 jun 2026' (sin desfase de zona).
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  const iso = d.slice(0, 10);
  const [y, m, day] = iso.split('-').map(Number);
  if (!y || !m || !day) return '';
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${day} ${months[m - 1]} ${y}`;
}
