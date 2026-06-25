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
    'Salón de belleza profesional en Cieneguilla, Lima. Maquillaje, uñas, cabello y cejas. Reserva tu cita online o agenda a domicilio en Cieneguilla, La Molina, Pachacámac y Lima Metropolitana.',
  defaultKeywords: [
    'salón de belleza Cieneguilla',
    'maquillaje profesional Cieneguilla',
    'salón de uñas Cieneguilla',
    'manicure Cieneguilla',
    'pedicure Cieneguilla',
    'diseño de cejas Cieneguilla',
    'peluquería Cieneguilla',
    'salón de belleza Lima',
    'maquillaje novias Lima',
    'maquillaje quinceañeras Lima',
    'reservar cita belleza online',
    'Deyanira Makeup Beauty',
  ],
  geo: {
    region: 'PE-LIM',         // ISO-3166-2 (Perú-Lima)
    placename: 'Cieneguilla, Lima',
    position: '-12.1109913;-76.8182017', // lat;lng del salón (defaults schema.prisma)
    icbm: '-12.1109913, -76.8182017',
  },
  ogImage: '/icons/icon-512.png',    // usado solo en JSON-LD; el OG social lo genera app/opengraph-image.tsx
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
  // Sin imagen explícita devolvemos undefined para que Next use el OG dinámico
  // (app/opengraph-image.tsx) en vez de un archivo estático inexistente.
  const image = opts.image
    ? (opts.image.startsWith('http') ? opts.image : `${SITE.url}${opts.image}`)
    : undefined;

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
      // 'product' no es un tipo OG válido en Next → se mapea a 'website'
      type: opts.type === 'article' ? 'article' : 'website',
      url,
      siteName: SITE.name,
      locale: SITE.locale,
      title: title || SITE.name,
      description,
      ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: title || SITE.name }] } : {}),
      ...(opts.publishedTime ? { publishedTime: opts.publishedTime } : {}),
      ...(opts.modifiedTime ? { modifiedTime: opts.modifiedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      site: SITE.twitter,
      title: title || SITE.name,
      description,
      ...(image ? { images: [image] } : {}),
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
