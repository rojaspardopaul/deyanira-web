// Generadores de JSON-LD type-safe para Schema.org.
// Cada función devuelve el objeto listo para pasar a <JsonLd data={...} />.
//
// Schemas implementados:
//   - LocalBusiness / BeautySalon   (página principal y contacto)
//   - Service                       (cada página de servicio)
//   - Product                       (cada producto)
//   - BreadcrumbList                (todas las páginas profundas)
//   - FAQPage                       (página de contacto y servicios destacados)
//   - Article                       (posts de blog)
//   - Organization + WebSite        (root)

import { SITE } from './seo';

const SAME_AS = [
  'https://www.instagram.com/deyaniramakeup', // ajustar a los reales
  'https://www.facebook.com/deyaniramakeup',
  'https://www.tiktok.com/@deyaniramakeup',
];

// ── LocalBusiness / BeautySalon ──────────────────────────────
type BusinessOpts = {
  phone?: string;
  whatsapp?: string;
  email?: string;
  street?: string;
  district?: string;
  city?: string;
  lat?: number;
  lng?: number;
  hoursWeekday?: string;   // "9:00 - 19:00"
  hoursSaturday?: string;
  hoursSunday?: string;
  priceRange?: string;     // "S/ 30 - S/ 300"
  rating?: { value: number; count: number };
};

function parseHours(label: string | undefined): { opens: string; closes: string } | null {
  if (!label) return null;
  const m = label.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (!m) return null;
  return { opens: m[1], closes: m[2] };
}

export function beautySalonLd(opts: BusinessOpts = {}) {
  const lat = opts.lat ?? -12.1109913;
  const lng = opts.lng ?? -76.8182017;

  const hoursSpec: Array<Record<string, unknown>> = [];
  const weekday = parseHours(opts.hoursWeekday);
  if (weekday) {
    hoursSpec.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: weekday.opens, closes: weekday.closes,
    });
  }
  const sat = parseHours(opts.hoursSaturday);
  if (sat) {
    hoursSpec.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Saturday',
      opens: sat.opens, closes: sat.closes,
    });
  }
  const sun = parseHours(opts.hoursSunday);
  if (sun) {
    hoursSpec.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Sunday',
      opens: sun.opens, closes: sun.closes,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BeautySalon',
    '@id': `${SITE.url}#salon`,
    name: SITE.name,
    image: `${SITE.url}${SITE.ogImage}`,
    logo: `${SITE.url}/logo.png`,
    url: SITE.url,
    telephone: opts.phone,
    email: opts.email,
    priceRange: opts.priceRange || 'S/ 30 - S/ 300',
    currenciesAccepted: 'PEN',
    paymentAccepted: 'Cash, Credit Card, Yape, Plin',
    address: {
      '@type': 'PostalAddress',
      streetAddress: opts.street || 'Lima',
      addressLocality: opts.district || 'Surco',
      addressRegion: 'Lima',
      addressCountry: 'PE',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: lat,
      longitude: lng,
    },
    openingHoursSpecification: hoursSpec.length ? hoursSpec : undefined,
    sameAs: SAME_AS,
    areaServed: [
      { '@type': 'City', name: 'Lima' },
      { '@type': 'AdministrativeArea', name: 'Lima Metropolitana' },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Servicios de belleza',
      itemListElement: [
        { '@type': 'OfferCatalog', name: 'Maquillaje profesional' },
        { '@type': 'OfferCatalog', name: 'Uñas (manicure y pedicure)' },
        { '@type': 'OfferCatalog', name: 'Cabello' },
        { '@type': 'OfferCatalog', name: 'Cejas y pestañas' },
      ],
    },
    ...(opts.rating ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: opts.rating.value.toFixed(1),
        reviewCount: opts.rating.count,
        bestRating: '5',
        worstRating: '1',
      },
    } : {}),
  };
}

// ── Organization (root) ──────────────────────────────────────
export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE.url}#org`,
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/logo.png`,
    sameAs: SAME_AS,
  };
}

// ── WebSite (root, habilita sitelinks searchbox) ─────────────
export function webSiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE.url}#website`,
    url: SITE.url,
    name: SITE.name,
    inLanguage: SITE.language,
    publisher: { '@id': `${SITE.url}#org` },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE.url}/tienda?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

// ── Service ──────────────────────────────────────────────────
type ServiceOpts = {
  name: string;
  description?: string;
  pricePen: number;
  durationMin?: number;
  slug: string;
  image?: string;
  category?: string;
};
export function serviceLd(s: ServiceOpts) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.name,
    description: s.description,
    serviceType: s.category || 'Beauty Service',
    provider: { '@id': `${SITE.url}#salon` },
    areaServed: { '@type': 'City', name: 'Lima' },
    url: `${SITE.url}/servicios/${s.slug}`,
    image: s.image ? (s.image.startsWith('http') ? s.image : `${SITE.url}${s.image}`) : undefined,
    offers: {
      '@type': 'Offer',
      price: s.pricePen.toFixed(2),
      priceCurrency: 'PEN',
      availability: 'https://schema.org/InStock',
      url: `${SITE.url}/reservar?servicio=${s.slug}`,
      validFrom: new Date().toISOString().split('T')[0],
    },
  };
}

// ── Product ──────────────────────────────────────────────────
type ProductOpts = {
  name: string;
  description?: string;
  pricePen: number;
  slug: string;
  images?: string[];
  brand?: string;
  stock?: number;
  rating?: { value: number; count: number };
};
export function productLd(p: ProductOpts) {
  const imgs = (p.images || []).slice(0, 5).map(i => (i.startsWith('http') ? i : `${SITE.url}${i}`));
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    image: imgs.length ? imgs : undefined,
    brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
    sku: p.slug,
    url: `${SITE.url}/tienda/${p.slug}`,
    offers: {
      '@type': 'Offer',
      price: p.pricePen.toFixed(2),
      priceCurrency: 'PEN',
      availability: (p.stock ?? 0) > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${SITE.url}/tienda/${p.slug}`,
      seller: { '@id': `${SITE.url}#salon` },
    },
    ...(p.rating ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: p.rating.value.toFixed(1),
        reviewCount: p.rating.count,
      },
    } : {}),
  };
}

// ── BreadcrumbList ───────────────────────────────────────────
type Crumb = { name: string; path: string };
export function breadcrumbsLd(items: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${SITE.url}${c.path.startsWith('/') ? c.path : `/${c.path}`}`,
    })),
  };
}

// ── FAQPage ──────────────────────────────────────────────────
type Faq = { q: string; a: string };
export function faqLd(items: Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

// ── Article (blog) ───────────────────────────────────────────
type ArticleOpts = {
  title: string;
  description?: string;
  slug: string;
  coverUrl?: string;
  publishedAt?: string;
  modifiedAt?: string;
  authorName?: string;
};
export function articleLd(a: ArticleOpts) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    image: a.coverUrl,
    datePublished: a.publishedAt,
    dateModified: a.modifiedAt || a.publishedAt,
    author: { '@type': 'Person', name: a.authorName || 'Deyanira Makeup Beauty' },
    publisher: { '@id': `${SITE.url}#org` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE.url}/blog/${a.slug}` },
  };
}
