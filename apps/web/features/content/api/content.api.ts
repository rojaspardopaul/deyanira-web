// API de contenido público (galería, blog). Migrada desde lib/api.ts.

import { apiFetch, STATIC } from '@/shared/api/client';

export const galleryApi = {
  list: (category?: string) =>
    apiFetch<unknown[]>(`/gallery${category ? `?category=${encodeURIComponent(category)}` : ''}`, { ...STATIC, tags: ['gallery'] }),
};

export const blogApi = {
  list: () => apiFetch<unknown[]>('/blog', { revalidate: 300 }),
  get: (slug: string) => apiFetch<unknown>(`/blog/${encodeURIComponent(slug)}`, { revalidate: 300 }),
};
