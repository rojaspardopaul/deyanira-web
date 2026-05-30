import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type DbItem = { slug: string; updatedAt?: string; createdAt?: string };

async function fetchSlugs(path: string): Promise<DbItem[]> {
  try {
    const res = await fetch(`${API_URL}/api${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

// Sitemap dinámico — Next 14 lo regenera cada `revalidate`.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE.url,                         lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${SITE.url}/servicios`,          lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${SITE.url}/reservar`,           lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${SITE.url}/tienda`,             lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE.url}/galeria`,            lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${SITE.url}/nosotros`,           lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE.url}/contacto`,           lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE.url}/blog`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
  ];

  const [services, products, posts] = await Promise.all([
    fetchSlugs('/services'),
    fetchSlugs('/products'),
    fetchSlugs('/blog'),
  ]);

  const dynamic: MetadataRoute.Sitemap = [
    ...services.map(s => ({
      url: `${SITE.url}/servicios/${s.slug}`,
      lastModified: s.updatedAt || s.createdAt || now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...products.map(p => ({
      url: `${SITE.url}/tienda/${p.slug}`,
      lastModified: p.updatedAt || p.createdAt || now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...posts.map(b => ({
      url: `${SITE.url}/blog/${b.slug}`,
      lastModified: b.updatedAt || b.createdAt || now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];

  return [...staticPages, ...dynamic];
}
