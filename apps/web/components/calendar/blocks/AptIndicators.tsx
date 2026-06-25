'use client';

// Lenguaje visual ÚNICO de señales secundarias de una cita, reutilizado por TODAS
// las superficies del calendario (bloque, mes, agenda, panel, modal) para que el
// admin aprenda un solo código. El ESTADO lo codifica el color del bloque (status.ts);
// aquí van: categoría de servicio, paquete (novia/quinceañera), a domicilio y pago
// por verificar. Colores de categoría desde el mapa central lib/categoryTheme.ts.

import { Home } from 'lucide-react';
import { getCategoryTheme, type CategoryTheme } from '@/lib/categoryTheme';
import { eventTypeIcon } from '../utils/package';
import type { Appointment } from '../types';

/** Paleta de la categoría de la cita (curada por slug, fallback estable). */
export function categoryThemeOf(apt: Pick<Appointment, 'service'>): CategoryTheme {
  return getCategoryTheme(apt.service.category?.slug, apt.service.category?.name);
}

/** Glifo compacto de categoría (emoji) — para bloques y vista de mes. */
export function CategoryGlyph({ apt, className = '' }: { apt: Pick<Appointment, 'service'>; className?: string }) {
  const t = categoryThemeOf(apt);
  const label = apt.service.category?.name || 'Servicio';
  return (
    <span title={label} className={`shrink-0 leading-none ${className}`} aria-label={label}>
      {t.emoji}
    </span>
  );
}

/** Chip de categoría con texto (emoji + nombre, coloreado) — agenda, panel, modal. */
export function CategoryChip({ apt, className = '' }: { apt: Pick<Appointment, 'service'>; className?: string }) {
  if (!apt.service.category) return null;
  const t = categoryThemeOf(apt);
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none ${className}`}
      style={{ backgroundColor: t.soft, color: t.chipText }}
    >
      <span className="text-[10px]">{t.emoji}</span>
      {apt.service.category.name}
    </span>
  );
}

/** Pastilla "A domicilio" (con distrito) — superficies con espacio (panel, modal). */
export function AtHomeChip({ apt, className = '' }: { apt: Pick<Appointment, 'atHome' | 'atHomeDistrict'>; className?: string }) {
  if (!apt.atHome) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none bg-purple-50 text-purple-700 ${className}`}>
      <Home className="w-3 h-3" />
      A domicilio{apt.atHomeDistrict ? ` · ${apt.atHomeDistrict}` : ''}
    </span>
  );
}

/** Fila de badges de esquina (paquete · domicilio · pago) — para bloques de grilla. */
export function AptCornerBadges({
  apt,
  hasPendingPayment = false,
  className = '',
}: {
  apt: Pick<Appointment, 'package' | 'atHome' | 'atHomeDistrict'>;
  hasPendingPayment?: boolean;
  className?: string;
}) {
  const ev = apt.package?.eventType;
  const badges: React.ReactNode[] = [];
  if (ev) {
    badges.push(
      <span
        key="pkg"
        title={`Paquete ${ev.name}`}
        className="w-[15px] h-[15px] rounded-full ring-1 ring-white flex items-center justify-center text-[8px] leading-none shadow-sm"
        style={{ backgroundColor: ev.accentColor || '#d4af37' }}
      >
        {eventTypeIcon(ev)}
      </span>,
    );
  }
  if (apt.atHome) {
    badges.push(
      <span
        key="home"
        title={`A domicilio${apt.atHomeDistrict ? ` · ${apt.atHomeDistrict}` : ''}`}
        className="w-[15px] h-[15px] rounded-full bg-purple-500 ring-1 ring-white flex items-center justify-center shadow-sm"
      >
        <Home className="w-2.5 h-2.5 text-white" />
      </span>,
    );
  }
  if (hasPendingPayment) {
    badges.push(
      <span
        key="pay"
        title="Comprobante de pago por verificar"
        className="w-[15px] h-[15px] rounded-full bg-amber-400 ring-1 ring-white flex items-center justify-center text-[8px] leading-none shadow-sm"
      >
        💳
      </span>,
    );
  }
  if (badges.length === 0) return null;
  return <div className={`flex items-center gap-0.5 ${className}`}>{badges}</div>;
}
