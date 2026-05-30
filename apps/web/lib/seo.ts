// Helpers de metadata SEO compartidos.
// Convención: cada page exporta `export const metadata` o `generateMetadata`
// usando estos helpers para mantener consistencia y evitar errores.

import type { Metadata } from 'next';

export const SITE = {
  name: 'Deyanira Makeup Beauty',
  shortName: 'Deyanira',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://deyanira.pe',
  locale: 'es_PE',
  language: 'es-PE',
  twitter: '@deyanirabeauty',
  defaultDescription:
    'Salón de belleza profesional en Lima, Perú. Maquillaje, uñas, cabello y cejas. Reserva tu cita online y compra productos de belleza con envío en Lima.',
  defaultKeywords: [
    'salón de belleza Lima',
    'maquillaje profesional Lima',
    'salón de uñas Lima',
    'extensión de cejas Lima',
    'manicure Cieneguilla',
    'pedicure Lima',
    'maquillaje novias Lima',
    'maquillaje quinceañeras Lima',
    'reservar cita belleza online Lima',
    'productos de maquillaje Perú',
    'Deyanira Makeup Beauty',
  ],
  geo: {
    region: 'PE-LIM',         // ISO-3166-2 (Perú-Lima)
    placename: 'Cieneguilla, Lima',
    position: '-12.1109913;-76.8182017', // lat;lng del salón (defaults schema.prisma)
    icbm: '-12.1109913, -76.8182017',
  },
  ogImage: '/og/og-default.jpg',     // 1200×630 — generar en /public/og
};

type BuildMetaOpts = {
  title?: string;            // se aplica al template "%s | Deyanira"
  description?: string;
  path?: string;             // pathname canónico (ej: '/servicios/maquillaje')
  image?: string;            // URL absoluta o path relativo
  noindex?: boolean;
  keywords?: string[];
  type?: 'website' | 'article' | 'product';
  publishedTime?: string;    // para artículos
  modifiedTime?: string;
};

export function buildMetadata(opts: BuildMetaOpts = {}): Metadata {
  const title = opts.title;
  const description = opts.description ?? SITE.defaultDescription;
  const url = opts.path ? `${SITE.url}${opts.path}` : SITE.url;
  const image = opts.image
    ? (opts.image.startsWith('http') ? opts.image : `${SITE.url}${opts.image}`)
    : `${SITE.url}${SITE.ogImage}`;

  return {
    title,
    description,
    keywords: opts.keywords ?? SITE.defaultKeywords,
    alternates: {
      canonical: url,
      languages: { 'es-PE': url, 'x-default': url },
    },
    robots: opts.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
    openGraph: {
      type: opts.type ?? 'website',
      url,
      siteName: SITE.name,
      locale: SITE.locale,
      title: title || SITE.name,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: SITE.name }],
      ...(opts.publishedTime ? { publishedTime: opts.publishedTime } : {}),
      ...(opts.modifiedTime ? { modifiedTime: opts.modifiedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      site: SITE.twitter,
      title: title || SITE.name,
      description,
      images: [image],
    },
    other: {
      'geo.region': SITE.geo.region,
      'geo.placename': SITE.geo.placename,
      'geo.position': SITE.geo.position,
      'ICBM': SITE.geo.icbm,
    },
  };
}

// Helpers para construir URL canónica desde un slug
export function canonical(path: string): string {
  return `${SITE.url}${path.startsWith('/') ? path : `/${path}`}`;
}
