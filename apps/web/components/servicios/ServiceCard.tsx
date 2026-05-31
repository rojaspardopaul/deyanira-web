import Link from 'next/link';
import { Clock, CalendarClock, Star, ArrowRight, Lock } from 'lucide-react';
import { clImage } from '@/lib/cloudinary-client';
import { getCategoryTheme, SERVICE_BTN_GRADIENT, SERVICE_BTN_SHADOW } from '@/lib/categoryTheme';

export type ServiceCardData = {
  id: string;
  name: string;
  description?: string | null;
  duration: number;
  pricePen: number | string;
  comparePricePen?: number | string | null;
  imageUrl?: string | null;
  daysBeforeMain?: number | null;
  category?: { slug?: string | null; name?: string | null } | null;
};

export default function ServiceCard({
  service,
  popular = false,
}: {
  service: ServiceCardData;
  popular?: boolean;
}) {
  const t = getCategoryTheme(service.category?.slug, service.category?.name);
  const catName = service.category?.name || 'Servicio';

  const price = Number(service.pricePen);
  const compare = service.comparePricePen != null ? Number(service.comparePricePen) : 0;
  const hasDiscount = compare > price;
  const discountPct = hasDiscount ? Math.round(((compare - price) / compare) * 100) : 0;
  const save = hasDiscount ? compare - price : 0;
  const anticip = service.daysBeforeMain && service.daysBeforeMain > 0 ? service.daysBeforeMain : 0;

  const img = service.imageUrl
    ? clImage(service.imageUrl, { w: 120, h: 120, crop: 'fill' }) || service.imageUrl
    : '';

  return (
    <Link
      href={`/reservar?service=${service.id}`}
      className="group relative flex flex-col overflow-hidden rounded-[22px] bg-white transition-all duration-300 hover:-translate-y-1.5 active:scale-[0.99]"
      style={{ border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 8px 26px rgba(20,10,15,0.08)' }}
    >
      {/* Badge — solo, esquina superior derecha (no choca con el chip) */}
      {hasDiscount ? (
        <span className="absolute top-3 right-3 z-10 rounded-full px-2 py-0.5 text-[11px] font-extrabold"
          style={{ background: '#fde7ec', color: '#d6336c', boxShadow: '0 2px 6px rgba(214,51,108,0.2)' }}>
          -{discountPct}%
        </span>
      ) : popular ? (
        <span className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
          style={{ background: '#fff4d6', color: '#a9821f', boxShadow: '0 2px 6px rgba(201,160,46,0.22)' }}>
          <Star className="h-3 w-3 fill-current" /> POPULAR
        </span>
      ) : null}

      {/* Cabecera con color de categoría: imagen + chip al costado, título abajo */}
      <div style={{ background: t.soft }} className="px-4 pb-3.5 pt-4">
        <div className="mb-3 flex items-center gap-2.5 pr-16">
          <div
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[15px] text-2xl"
            style={{ background: t.gradient, boxShadow: `0 4px 12px ${t.accent}33` }}
          >
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={service.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true">{t.emoji}</span>
            )}
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: 'rgba(255,255,255,0.9)', color: t.chipText, border: `1px solid ${t.accent}22` }}
          >
            <span aria-hidden="true">{t.emoji}</span> {catName}
          </span>
        </div>
        <h3 className="font-poppins text-[16.5px] font-bold leading-tight line-clamp-2" style={{ color: '#171013' }}>
          {service.name}
        </h3>
      </div>

      {/* Cuerpo */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        {service.description && (
          <p className="mb-3 text-[12.5px] font-medium leading-relaxed line-clamp-2" style={{ color: '#9b8089' }}>
            {service.description}
          </p>
        )}

        {/* Pills meta */}
        <div className="mb-3.5 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: '#f6f3f4', color: '#6f5b63' }}>
            <Clock className="h-3.5 w-3.5" style={{ color: t.accent }} /> {service.duration} min
          </span>
          {anticip > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: '#f6f3f4', color: '#6f5b63' }}>
              <CalendarClock className="h-3.5 w-3.5" style={{ color: t.accent }} /> Reserva {anticip} día{anticip !== 1 ? 's' : ''} antes
            </span>
          )}
        </div>

        {/* Precio + CTA */}
        <div className="mt-auto border-t pt-3" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <div className="mb-3 flex items-end justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#b3a1a9' }}>Desde</span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-poppins text-[22px] font-extrabold" style={{ color: '#171013' }}>S/{price.toFixed(0)}</span>
                {hasDiscount && (
                  <span className="text-[12px] font-medium line-through" style={{ color: '#c4b0b8' }}>S/{compare.toFixed(0)}</span>
                )}
              </span>
            </div>
            {hasDiscount && (
              <span className="rounded-lg px-2.5 py-1 text-[11px] font-bold" style={{ background: '#e7f8ef', color: '#0a8f5b' }}>
                Ahorras S/{save.toFixed(0)}
              </span>
            )}
          </div>

          <span
            className="flex w-full items-center justify-center gap-1.5 rounded-[14px] px-3 py-3 text-[13.5px] font-bold text-white transition-all duration-200 group-hover:gap-2.5"
            style={{ background: SERVICE_BTN_GRADIENT, boxShadow: SERVICE_BTN_SHADOW }}
          >
            Reservar cita <ArrowRight className="h-4 w-4" />
          </span>
          <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10.5px] font-semibold" style={{ color: '#b3a1a9' }}>
            <Lock className="h-3 w-3" /> Reserva online · Confirmación inmediata
          </p>
        </div>
      </div>
    </Link>
  );
}
