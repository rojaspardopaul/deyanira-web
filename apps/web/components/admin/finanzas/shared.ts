// Helpers y etiquetas compartidas del Centro Financiero (panel admin).

export const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const TYPE_LABELS: Record<string, string> = {
  ingreso: 'Ingreso',
  egreso: 'Egreso',
  adelanto: 'Adelanto',
  pago_final: 'Pago de servicio',
  venta: 'Venta de productos',
  reembolso: 'Reembolso',
  ajuste: 'Ajuste',
  transferencia: 'Transferencia',
  comision: 'Comisión',
  impuesto: 'Impuesto',
};

export const SOURCE_LABELS: Record<string, string> = {
  appointment: 'Cita',
  booking_payment: 'Reserva',
  order: 'Pedido',
  expense: 'Egreso manual',
  other_income: 'Ingreso manual',
  manual: 'Manual',
};

export const CATEGORY_LABELS: Record<string, string> = {
  // egresos
  alquiler: 'Alquiler',
  salarios: 'Salarios',
  productos: 'Insumos / Productos',
  servicios_pub: 'Servicios (luz, agua, internet)',
  marketing: 'Marketing y publicidad',
  equipos: 'Equipos y herramientas',
  mantenimiento: 'Mantenimiento',
  transporte: 'Transporte',
  impuestos: 'Impuestos / IGV',
  // ingresos operativos
  servicios: 'Servicios',
  adelanto: 'Adelantos',
  // otros ingresos
  servicios_externos: 'Servicios externos (eventos)',
  cursos: 'Cursos y talleres',
  alquiler_espacio: 'Alquiler del espacio',
  otro: 'Otro',
  sin_categoria: 'Sin categoría',
};

export const METHOD_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  yape: 'Yape',
  plin: 'Plin',
  culqi: 'Tarjeta (Culqi)',
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: 'Caja (efectivo)',
  wallet: 'Billetera (Yape/Plin)',
  bank: 'Banco',
  card: 'Tarjeta',
};

export function fmt(amount: number): string {
  return `S/ ${(amount || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** S/ 12.3k para ejes/etiquetas compactas. */
export function fmtShort(amount: number): string {
  const a = amount || 0;
  if (Math.abs(a) >= 1000) return `S/${(a / 1000).toFixed(1)}k`;
  return `S/${a.toFixed(0)}`;
}

export function fmtDate(isoStr: string): string {
  return isoStr.slice(0, 10).split('-').reverse().join('/');
}

/** Variación porcentual de `current` respecto a `prev`. null si no hay base. */
export function variationPct(current: number, prev: number): number | null {
  if (!prev || prev === 0) return current > 0 ? 100 : null;
  return Math.round(((current - prev) / Math.abs(prev)) * 1000) / 10;
}

export type Preset = 'today' | 'week' | 'month' | 'year' | 'custom';

export const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
  { key: 'custom', label: 'Personalizado' },
];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getPeriod(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (preset === 'today') {
    const t = ymd(now);
    return { from: t, to: t };
  }
  if (preset === 'week') {
    const day = (now.getDay() + 6) % 7; // lunes = 0
    const monday = new Date(y, m, now.getDate() - day);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: ymd(monday), to: ymd(sunday) };
  }
  if (preset === 'year') {
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  // month (default)
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const last = new Date(y, m + 1, 0).getDate();
  return { from, to: `${y}-${String(m + 1).padStart(2, '0')}-${last}` };
}
