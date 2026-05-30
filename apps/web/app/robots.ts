import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/admin/*',
          '/api/',
          '/api/*',
          '/mi-cuenta/',
          '/mi-cuenta/*',
          '/checkout/',
          '/carrito/',
          '/auth/',
        ],
      },
      // Bloqueo de scrapers de IA / SEO agresivos (opcional — quitar si quieres ser indexable)
      { userAgent: 'GPTBot',        disallow: '/' },
      { userAgent: 'CCBot',         disallow: '/' },
      { userAgent: 'ClaudeBot',     disallow: '/' },
      { userAgent: 'PerplexityBot', disallow: '/' },
      { userAgent: 'AhrefsBot',     disallow: '/' },
      { userAgent: 'SemrushBot',    disallow: '/' },
      { userAgent: 'MJ12bot',       disallow: '/' },
      { userAgent: 'DotBot',        disallow: '/' },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
