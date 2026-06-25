import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles, Crown } from 'lucide-react';
import { focalImg } from '@/lib/cloudinary-client';

// Cards EXCLUSIVOS de paquetes estrella (Novia / Quinceañera) — los más vistosos.
// Cada uno redirige a su evento: /servicios/{slug}.

export type FeaturedPackage = {
  id: string;
  name: string;
  slug: string;
  tagline?: string | null;
  shortDesc?: string | null;
  heroImageUrl?: string | null;
  accentColor?: string | null;
  icon?: string | null;
  packagesCount?: number;
  fromPricePen?: number;
};

function PackageHero({ p }: { p: FeaturedPackage }) {
  const accent = p.accentColor || '#C9A030';
  const im = p.heroImageUrl ? focalImg(p.heroImageUrl, 1000) : null;

  return (
    <Link
      href={`/servicios/${p.slug}`}
      className="group relative block overflow-hidden rounded-[28px] min-h-[360px] md:min-h-[420px]
                 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 active:scale-[0.99]"
      style={{ boxShadow: `0 16px 46px ${accent}33`, border: `1px solid ${accent}44` }}
    >
      {/* Imagen de fondo */}
      {im ? (
        <Image
          src={im.src}
          alt={p.name}
          fill
          sizes="(max-width: 768px) 92vw, 560px"
          style={{ objectPosition: im.objectPosition }}
          className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: '#1a1014' }} />
      )}

      {/* Velos para legibilidad + brillo de acento */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(165deg, rgba(15,10,12,0.20) 0%, rgba(15,10,12,0.55) 46%, rgba(11,7,9,0.92) 100%)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(120% 80% at 50% 125%, ${accent}45 0%, transparent 60%)` }} />
      <div className="absolute top-0 inset-x-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

      {/* Badge EXCLUSIVO */}
      <span
        className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white backdrop-blur-sm"
        style={{ background: `${accent}d9`, boxShadow: `0 4px 14px ${accent}66` }}
      >
        <Sparkles className="h-3.5 w-3.5" /> Exclusivo
      </span>

      {/* Contenido */}
      <div className="absolute inset-x-0 bottom-0 p-6 md:p-7">
        {p.icon && <div className="mb-2 text-4xl md:text-5xl drop-shadow-lg transition-transform duration-500 group-hover:scale-110">{p.icon}</div>}
        <h3 className="font-display text-[28px] font-bold italic leading-tight text-white md:text-[34px]">{p.name}</h3>
        {p.tagline && <p className="mt-1 text-sm italic text-white/80 line-clamp-1">&ldquo;{p.tagline}&rdquo;</p>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            {p.fromPricePen != null && (
              <>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Desde</span>
                <span className="font-display text-2xl font-bold text-white">S/{p.fromPricePen}</span>
              </>
            )}
            {p.packagesCount ? (
              <span className="text-xs text-white/55">· {p.packagesCount} paquete{p.packagesCount !== 1 ? 's' : ''}</span>
            ) : null}
          </div>
          <span
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white transition-all duration-300 group-hover:gap-3"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, boxShadow: `0 6px 18px ${accent}66` }}
          >
            Ver paquetes <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function FeaturedPackages({ packages }: { packages: FeaturedPackage[] }) {
  if (!packages?.length) return null;

  return (
    <section className="relative px-4 py-14 md:py-20" style={{ background: '#FAFAFA' }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center md:mb-10">
          <p className="section-label" style={{ color: '#b8962e' }}>
            <Crown className="inline h-3.5 w-3.5" /> Paquetes exclusivos
          </p>
          <h2 className="section-title-light mt-2 mb-2">
            Para tu <span style={{ color: '#C9A030' }}>día más especial</span>
          </h2>
          <p className="mx-auto max-w-md text-sm" style={{ color: '#8a6a78' }}>
            Novias y quinceañeras: maquillaje, peinado y más en un solo paquete, pensado al detalle.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 md:gap-6">
          {packages.map((p) => <PackageHero key={p.id} p={p} />)}
        </div>
      </div>
    </section>
  );
}
