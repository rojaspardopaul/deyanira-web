'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, ArrowRight, Crown, Flame, Heart, Sparkles } from 'lucide-react';
import { focalImg } from '@/lib/cloudinary-client';

// ── Tipos ────────────────────────────────────────────────
export type PopularService = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  duration: number;
  pricePen: number | string;
  comparePricePen?: number | string | null;
  imageUrl?: string | null;
  bookingCount?: number;
  category?: { name?: string | null; slug?: string | null } | null;
};

// ── Estética por categoría (fallback sin imagen + acento) ─
const CAT: Record<string, { emoji: string; accent: string; grad: string }> = {
  maquillaje: { emoji: '💄', accent: '#FF4FA2', grad: 'linear-gradient(135deg, #FF4FA2 0%, #b3266b 100%)' },
  cabello:    { emoji: '💇', accent: '#E8C040', grad: 'linear-gradient(135deg, #E8C040 0%, #a8801f 100%)' },
  unas:       { emoji: '💅', accent: '#FF6FB3', grad: 'linear-gradient(135deg, #FF6FB3 0%, #c23d82 100%)' },
  cejas:      { emoji: '✨', accent: '#D4AF37', grad: 'linear-gradient(135deg, #D4AF37 0%, #8c7016 100%)' },
};
const DEFAULT_CAT = { emoji: '🌸', accent: '#E8C040', grad: 'linear-gradient(135deg, #E8C040 0%, #FF4FA2 100%)' };

const catVisual = (slug?: string | null) => CAT[slug || ''] || DEFAULT_CAT;

const RANK_META = [
  { label: 'La más pedida', icon: Crown, badge: 'linear-gradient(135deg, #F7D560, #C9A030)', ring: 'rgba(232,192,64,0.55)' },
  { label: 'Top favorita',  icon: Flame, badge: 'linear-gradient(135deg, #E8E8EC, #A8A8B0)', ring: 'rgba(168,168,176,0.45)' },
  { label: 'Muy reservada', icon: Flame, badge: 'linear-gradient(135deg, #E2A579, #B97B45)', ring: 'rgba(185,123,69,0.45)' },
];

// ── Card individual ──────────────────────────────────────
function ServiceCard({ service, rank, visible }: { service: PopularService; rank: number; visible: boolean }) {
  const cat = catVisual(service.category?.slug);
  const price = Number(service.pricePen);
  const compare = service.comparePricePen != null ? Number(service.comparePricePen) : null;
  const hasDiscount = compare != null && compare > price;
  const discountPct = hasDiscount ? Math.round(((compare! - price) / compare!) * 100) : 0;
  const rankMeta = rank <= 3 ? RANK_META[rank - 1] : null;
  const RankIcon = rankMeta?.icon;
  const im = service.imageUrl ? focalImg(service.imageUrl, 720) : null;
  const count = service.bookingCount || 0;

  return (
    <Link
      href={`/reservar?service=${service.id}`}
      className="popsvc-card group relative shrink-0 snap-start flex flex-col overflow-hidden rounded-[1.75rem] bg-white
                 w-[80%] sm:w-[300px] md:w-auto
                 transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
                 hover:-translate-y-2 active:scale-[0.98]"
      style={{
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: visible ? '0 6px 28px rgba(15,15,15,0.08)' : '0 6px 28px rgba(15,15,15,0)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(36px)',
        transition: `opacity 0.6s ease ${rank * 80}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${rank * 80}ms`,
        ...(rank === 1 ? { boxShadow: visible ? '0 10px 40px rgba(232,192,64,0.22)' : 'none', borderColor: 'rgba(232,192,64,0.4)' } : {}),
      }}
    >
      {/* ── Imagen / fallback ── */}
      <div className="relative aspect-[4/3] md:aspect-[5/4] overflow-hidden">
        {im ? (
          <Image
            src={im.src}
            alt={service.name}
            fill
            sizes="(max-width: 768px) 82vw, 360px"
            style={{ objectPosition: im.objectPosition }}
            className="object-cover transition-[transform,filter] duration-[800ms] ease-out group-hover:scale-[1.08] group-hover:brightness-[1.06] group-hover:saturate-[1.12]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: cat.grad }}>
            <span className="text-6xl md:text-7xl drop-shadow-lg transition-transform duration-700 group-hover:scale-110 group-hover:rotate-6">
              {cat.emoji}
            </span>
          </div>
        )}

        {/* Velo inferior para legibilidad de chips */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(15,15,15,0.5) 0%, transparent 45%)' }} />

        {/* Ranking badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span
            className="flex items-center justify-center w-9 h-9 rounded-full text-sm font-black shadow-lg"
            style={{
              background: rankMeta?.badge || 'rgba(255,255,255,0.92)',
              color: rankMeta ? '#3a2e0d' : '#0F0F0F',
              border: '1.5px solid rgba(255,255,255,0.7)',
            }}
          >
            {RankIcon ? <RankIcon className="w-4 h-4" /> : rank}
          </span>
          {rankMeta && (
            <span className="hidden md:inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm"
              style={{ background: 'rgba(15,15,15,0.55)' }}>
              {rankMeta.label}
            </span>
          )}
        </div>

        {/* Descuento */}
        {hasDiscount && (
          <span className="absolute top-3 right-3 text-[11px] font-black px-2.5 py-1 rounded-full text-white shadow-md"
            style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)' }}>
            −{discountPct}%
          </span>
        )}

        {/* Prueba social: nº de reservas */}
        {count > 0 && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white backdrop-blur-md"
            style={{ background: 'rgba(15,15,15,0.45)' }}>
            <Heart className="w-3 h-3 fill-current" style={{ color: '#FF6FB3' }} />
            {count} {count === 1 ? 'reserva' : 'reservas'}
          </span>
        )}
      </div>

      {/* ── Contenido ── */}
      <div className="flex flex-col flex-1 p-4 md:p-5">
        {/* Categoría */}
        {service.category?.name && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5"
            style={{ color: cat.accent }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.accent }} />
            {service.category.name}
          </span>
        )}

        {/* Nombre */}
        <h3 className="font-poppins font-bold text-base md:text-lg leading-snug line-clamp-2 mb-1.5"
          style={{ color: '#0F0F0F' }}>
          {service.name}
        </h3>

        {/* Descripción */}
        {service.description && (
          <p className="text-xs leading-relaxed line-clamp-2 mb-3" style={{ color: '#8a6a78' }}>
            {service.description}
          </p>
        )}

        {/* Duración */}
        <div className="flex items-center gap-1.5 mb-4">
          <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: cat.accent }} />
          <span className="text-xs font-medium" style={{ color: '#8a6a78' }}>{service.duration} min</span>
        </div>

        {/* Precio + CTA */}
        <div className="mt-auto pt-3.5 flex items-end justify-between gap-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="flex flex-col">
            {hasDiscount && (
              <span className="text-xs line-through leading-none mb-0.5" style={{ color: '#b09aa5' }}>
                S/{compare!.toFixed(0)}
              </span>
            )}
            <span className="font-display font-bold text-xl md:text-2xl leading-none" style={{ color: '#0F0F0F' }}>
              S/ {price.toFixed(0)}
            </span>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-white shrink-0
                       transition-all duration-300 group-hover:gap-2.5 group-hover:shadow-lg"
            style={{ background: cat.accent === '#E8C040' || cat.accent === '#D4AF37'
              ? 'linear-gradient(135deg, #E8C040, #C9A030)'
              : 'linear-gradient(135deg, #FF4FA2, #e6368a)' }}
          >
            Reservar <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      {/* Anillo de acento en el borde (aparece en hover, no cubre la foto) */}
      <div className="absolute inset-0 rounded-[1.75rem] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ boxShadow: `inset 0 0 0 2px ${cat.accent}` }} />
    </Link>
  );
}

// ── Sección ──────────────────────────────────────────────
export default function PopularServices({ services }: { services: PopularService[] }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (setVisible(true), io.disconnect())),
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!services?.length) return null;

  return (
    <section ref={ref} className="relative py-16 md:py-24 overflow-hidden" style={{ background: '#FAFAFA' }}>
      {/* Glow decorativo */}
      <div className="absolute top-0 left-1/4 w-[420px] h-[420px] rounded-full pointer-events-none -translate-y-1/3"
        style={{ background: 'radial-gradient(circle, rgba(232,192,64,0.10) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 right-1/4 w-[360px] h-[360px] rounded-full pointer-events-none translate-y-1/3"
        style={{ background: 'radial-gradient(circle, rgba(255,79,162,0.08) 0%, transparent 70%)' }} />
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(232,192,64,0.5), transparent)' }} />

      <div className="relative max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <p className="section-label" style={{ color: '#b8962e' }}>
            <Sparkles className="w-3.5 h-3.5" /> Las favoritas de nuestras clientas
          </p>
          <h2 className="section-title-light mt-2 mb-3">
            Los más <span style={{ color: '#FF4FA2' }}>reservados</span>
          </h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: '#8a6a78' }}>
            Nuestros servicios y paquetes estrella, ordenados por lo que más eligen quienes nos visitan.
          </p>
        </div>

        {/* Carrusel (móvil) / Grid (PC) */}
        <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 pb-2
                        md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible md:mx-0 md:px-0 md:gap-5 md:pb-0">
          {services.map((s, i) => (
            <ServiceCard key={s.id} service={s} rank={i + 1} visible={visible} />
          ))}
        </div>

        {/* Pista de scroll (solo móvil) */}
        <div className="md:hidden flex items-center justify-center gap-1.5 mt-5" aria-hidden="true">
          {services.map((s, i) => (
            <span key={s.id} className="h-1 rounded-full transition-all duration-300"
              style={{ width: i === 0 ? 20 : 6, background: i === 0 ? '#E8C040' : 'rgba(0,0,0,0.15)' }} />
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-10 md:mt-12">
          <Link href="/servicios" className="btn-outline inline-flex">
            Ver todos los servicios y paquetes <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
