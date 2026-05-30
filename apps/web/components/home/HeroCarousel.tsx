'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { clImage } from '@/lib/cloudinary-client';

type SlideData = {
  id?: number | string;
  badge: string;
  line1: string;
  line2: string;
  bullets: string[];
  cta: string;
  ctaHref: string;
  tag?: string | null;
  image?: string;
  video?: string;
  /** Punto focal preferido para el crop inteligente: 'auto' | 'face' | 'faces' | 'center' */
  gravity?: 'auto' | 'face' | 'faces' | 'center';
};

const DEFAULT_SLIDES: SlideData[] = [
  {
    id: 0,
    badge: 'Video · Reserva online',
    line1: 'Descubre',
    line2: 'Nuestro Mundo',
    bullets: [
      'Mira nuestro espacio y servicios en acción',
      'Reserva directamente desde el video.',
    ],
    cta: 'Reserva ahora',
    ctaHref: '/reservar',
    tag: null,
    video: '/images/carrusel_video_1.mp4',
  },
  {
    id: 4,
    badge: 'Tour · Nuestro salón',
    line1: 'Bienvenidas',
    line2: 'Al Salón',
    bullets: [
      'Recorre nuestras instalaciones y ambiente',
      'Conoce al equipo y los servicios disponibles.',
    ],
    cta: 'Ver servicios',
    ctaHref: '/servicios',
    tag: null,
    video: '/images/carrusel_video_2.mp4',
  },
  {
    id: 5,
    badge: 'Uñas · Manicure & Pedicure',
    line1: 'Arte en',
    line2: 'tus Uñas',
    bullets: [
      'Gel, acrílico y semipermanente con acabado perfecto',
      'Diseños exclusivos a cargo de nuestras especialistas.',
    ],
    cta: 'Reserva tu cita',
    ctaHref: '/reservar',
    tag: null,
    video: '/images/carrusel_video_1.mp4',
  },
  {
    id: 6,
    badge: 'Quinceañeras · Look completo',
    line1: 'Tu Noche',
    line2: 'Perfecta',
    bullets: [
      'Maquillaje y peinado profesional para tu quinceañera',
      'Luce radiante en el día más especial de tu vida.',
    ],
    cta: 'Consultar paquetes',
    ctaHref: '/reservar',
    tag: null,
    video: '/images/carrusel_video_2.mp4',
  },
  {
    id: 1,
    badge: 'Reserva online · Confirmación inmediata',
    line1: 'Tendencias',
    line2: 'en Color',
    bullets: [
      'Babylights, balayage & keratinas con 15% off',
      'Bonus sorpresa solo al reservar en línea.',
    ],
    cta: 'Reserva ahora',
    ctaHref: '/reservar',
    tag: '-15%',
  },
  {
    id: 2,
    badge: 'Maquillaje artístico profesional',
    line1: 'Luce',
    line2: 'Espectacular',
    bullets: [
      'Maquillaje de novia y social con artistas certificados',
      'Resultados duraderos con marcas premium.',
    ],
    cta: 'Ver servicios',
    ctaHref: '/servicios',
    tag: null,
  },
  {
    id: 3,
    badge: 'Tienda online · Envío a toda Lima',
    line1: 'Productos',
    line2: 'Premium',
    bullets: [
      'Las mejores marcas profesionales de belleza',
      'Delivery express a Miraflores, Surco y más.',
    ],
    cta: 'Ver tienda',
    ctaHref: '/tienda',
    tag: null,
    image: '/images/carrusel_imagen_2.webp',
  },
];

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);
  const [slides, setSlides] = useState<SlideData[]>(DEFAULT_SLIDES);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);

  // Carga slides del backend (settings.homeSlides). Si están vacíos, mantiene los defaults.
  useEffect(() => {
    api.settings.public()
      .then((s) => {
        const sett = s as { homeSlides?: SlideData[] };
        if (Array.isArray(sett.homeSlides) && sett.homeSlides.length > 0) {
          setSlides(sett.homeSlides);
        }
      })
      .catch(() => {});
  }, []);

  const goTo = useCallback((idx: number) => {
    setFading(true);
    setTimeout(() => { setCurrent(idx); setFading(false); }, 320);
  }, []);

  const next = useCallback(() => goTo((current + 1) % slides.length), [current, goTo, slides.length]);
  const prev = useCallback(() => goTo((current - 1 + slides.length) % slides.length), [current, goTo, slides.length]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(next, 5500);
  }, [next]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const slide = slides[current] || slides[0];
  if (!slide) return null;

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: '#0d080e', minHeight: '100svh' }}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(dx) > 45) { dx > 0 ? next() : prev(); resetTimer(); }
      }}
    >
      {/* ── Background image ─────────────────────────────── */}
      <div className="absolute inset-0">
        {slide.video ? (
          <video
            src={slide.video}
            autoPlay
            muted
            loop
            playsInline
            className={`w-full h-full object-cover transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
            style={{ objectPosition: 'center 20%' }}
          />
        ) : (
          <Image
            src={
              slide.image
                ? (clImage(slide.image, { w: 2400, h: 1100, crop: 'pad', background: 'auto:predominant' }) || slide.image)
                : '/images/hero-cover.jpg'
            }
            alt="Deyanira Makeup Beauty"
            fill
            sizes="100vw"
            className={`object-cover transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
            style={{ objectPosition: 'center 30%' }}
            priority
            unoptimized={!!slide.image && slide.image.includes('cloudinary')}
          />
        )}
        {/* Mobile overlay: semi-transparent so image is visible but text is readable */}
        <div className="absolute inset-0 md:hidden"
          style={{ background: 'linear-gradient(to bottom, rgba(13,8,14,0.45) 0%, rgba(13,8,14,0.65) 50%, rgba(13,8,14,0.88) 100%)' }} />
        {/* Desktop overlay: left-heavy gradient */}
        <div className="absolute inset-0 hidden md:block"
          style={{ background: 'linear-gradient(to right, rgba(13,8,14,0.95) 30%, rgba(13,8,14,0.7) 60%, rgba(13,8,14,0.2) 100%)' }} />
        <div className="absolute inset-0 hidden md:block"
          style={{ background: 'linear-gradient(to top, rgba(13,8,14,0.6) 0%, transparent 60%)' }} />
        {/* Pink glow */}
        <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(120,20,70,0.25), transparent)' }} />
      </div>

      {/* ── Layout: mobile = flex col, desktop = grid ────── */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-5 md:px-12
                      flex flex-col justify-center
                      md:grid md:grid-cols-[1fr_420px] lg:md:grid-cols-[1fr_460px] md:items-center
                      gap-6 md:gap-10"
        style={{ minHeight: '100svh', paddingTop: '5.5rem', paddingBottom: '4.5rem' }}
      >
        {/* ── Text ─────────────────────────────────────────── */}
        <div className={`text-white transition-all duration-400 ${fading ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'}`}>

          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.15em] px-3 py-1.5 rounded-full mb-4 md:mb-6"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(212,175,55,0.4)', color: '#d4af37' }}>
            ✦ {slide.badge}
          </span>

          {/* Title */}
          <h1 className="font-display font-bold italic leading-[0.93] mb-4 tracking-tight">
            <span className="block text-[2.6rem] sm:text-5xl md:text-6xl lg:text-[5.5rem] text-white drop-shadow-lg">
              {slide.line1}
            </span>
            <span className="block text-[2.6rem] sm:text-5xl md:text-6xl lg:text-[5.5rem] text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(90deg, #ec4899, #f472b6, #fb7185)' }}>
              {slide.line2}
            </span>
          </h1>

          {/* Bullets */}
          <ul className="space-y-1.5 mb-6">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm md:text-[15px] leading-snug"
                style={{ color: 'rgba(255,255,255,0.72)' }}>
                <span className="mt-0.5 shrink-0" style={{ color: '#d4af37' }}>◆</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <div className="flex flex-wrap items-center gap-3">
            <Link href={slide.ctaHref}
              className="group inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-full text-sm sm:text-[15px] transition-all duration-200 active:scale-95"
              style={{ boxShadow: '0 8px 28px rgba(219,39,119,0.5)' }}>
              {slide.cta}
              {slide.tag && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: '#d4af37', color: '#ffffff' }}>
                  {slide.tag}
                </span>
              )}
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
            <Link href="/servicios"
              className="text-xs sm:text-sm underline underline-offset-4 transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              Ver servicios
            </Link>
          </div>

          {/* Stars */}
          <p className="mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            ⭐⭐⭐⭐⭐ &nbsp;+500 clientas satisfechas en Lima, Perú
          </p>
        </div>

        {/* ── Image card — desktop only ─────────────────────── */}
        <div className={`hidden md:block transition-all duration-600 ${fading ? 'opacity-0 scale-[0.97]' : 'opacity-100 scale-100'}`}>
          <div className="relative h-[500px] lg:h-[560px]">
            <div className="absolute -inset-3 rounded-[44px] blur-2xl pointer-events-none"
              style={{ background: 'linear-gradient(135deg, rgba(219,39,119,0.2), rgba(212,175,55,0.12))' }} />
            {slide.video ? (
              <video
                src={slide.video}
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 w-full h-full object-cover rounded-[36px]"
                style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.7)', objectPosition: 'center 20%' }}
              />
            ) : (
              <Image
                src={
                  slide.image
                    ? (clImage(slide.image, { w: 920, h: 1120, crop: 'fill', gravity: slide.gravity || 'face' }) || slide.image)
                    : '/images/hero-cover.jpg'
                }
                alt="Deyanira Makeup Beauty"
                fill
                sizes="460px"
                className="object-cover rounded-[36px]"
                style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.7)', objectPosition: 'center 20%' }}
                priority
                unoptimized={!!slide.image && slide.image.includes('cloudinary')}
              />
            )}
            <div className="absolute inset-0 rounded-[36px] pointer-events-none"
              style={{ border: '1px solid rgba(212,175,55,0.22)' }} />
          </div>
        </div>
      </div>

      {/* ── Arrows ───────────────────────────────────────── */}
      <button onClick={() => { prev(); resetTimer(); }}
        className="absolute left-2 md:left-5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center text-white transition-all"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}
        aria-label="Anterior">
        <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
      </button>
      <button onClick={() => { next(); resetTimer(); }}
        className="absolute right-2 md:right-5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center text-white transition-all"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}
        aria-label="Siguiente">
        <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
      </button>

      {/* ── Dots ─────────────────────────────────────────── */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {slides.map((_, i) => (
          <button key={i} onClick={() => { goTo(i); resetTimer(); }}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: i === current ? '2rem' : '0.5rem', background: i === current ? '#d4af37' : 'rgba(255,255,255,0.3)' }}
            aria-label={`Slide ${i + 1}`} />
        ))}
      </div>
    </section>
  );
}
