import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.shortName,
    description: SITE.defaultDescription,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#db2777',
    lang: SITE.language,
    orientation: 'portrait-primary',
    categories: ['beauty', 'lifestyle', 'shopping'],
    icons: [
      { src: '/icons/icon-192.png',  sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png',  sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/apple-touch-icon.png',  sizes: '180x180', type: 'image/png' },
    ],
    shortcuts: [
      { name: 'Reservar cita', short_name: 'Reservar', url: '/reservar', description: 'Reserva tu cita en segundos' },
      { name: 'Tienda',        short_name: 'Tienda',   url: '/tienda',   description: 'Compra productos de belleza' },
      { name: 'Servicios',     short_name: 'Servicios', url: '/servicios' },
    ],
  };
}
