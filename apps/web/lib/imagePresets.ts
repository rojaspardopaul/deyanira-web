// ────────────────────────────────────────────────────────────
// Presets de imagen — ÚNICA fuente de verdad de cómo se recorta/encuadra
// cada imagen. Tanto la web pública como la vista previa del admin
// (`ImageUploader`) usan EXACTAMENTE el mismo `render`, así que no pueden
// divergir: lo que el admin ve es lo que sale en la web.
//
// `crops:true`  → la web hace un recorte (object-cover). El admin muestra
//                 un punto focal arrastrable (se guarda en la URL como #focal).
// `crops:false` → la web mete la imagen entera (pad). Sin punto focal.
// ────────────────────────────────────────────────────────────
import { clImage } from './cloudinary-client';

export type ImageSlotKey =
  | 'packageCard'
  | 'eventHero'
  | 'eventCard'
  | 'serviceImage'
  | 'serviceThumb'
  | 'catalogHero'
  | 'catalogItem';

export type ImageSlot = {
  /** Etiqueta corta para el preview ("Card del paquete"). */
  label: string;
  /** CSS aspect-ratio del recuadro de preview, p.ej. '16 / 9'. */
  aspect: string;
  /** ¿La web recorta esta imagen? (true → object-cover + punto focal). */
  crops: boolean;
  /** Transformación Cloudinary que usan la web y el preview. */
  render: (url: string | null | undefined) => string;
  /** Otras superficies del MISMO archivo (tiles extra de solo lectura). */
  also?: ImageSlotKey[];
};

export const IMAGE_SLOTS: Record<ImageSlotKey, ImageSlot> = {
  // Card del paquete en /servicios/[slug] (PackagesComparison) — 16:9 recortado.
  packageCard: {
    label: 'Card del paquete',
    aspect: '16 / 9',
    crops: true,
    render: (u) => clImage(u, { w: 800, h: 450, crop: 'fill', gravity: 'auto' }),
  },

  // Portada/hero del evento en /servicios/[slug] — imagen a pantalla (cover) con
  // punto focal. La portada llena todo el alto, así que el foco define qué se ve.
  eventHero: {
    label: 'Portada del evento',
    aspect: '4 / 3',
    crops: true,
    render: (u) => clImage(u, { w: 1600, h: 1200, crop: 'fill', gravity: 'auto' }),
    also: ['eventCard'],
  },
  // El mismo archivo, como tarjeta en el listado /servicios — también cover + focal.
  eventCard: {
    label: 'En el listado',
    aspect: '800 / 520',
    crops: true,
    render: (u) => clImage(u, { w: 800, h: 520, crop: 'fill', gravity: 'auto' }),
  },

  // Imagen de servicio: card 4:3 (PopularServices) + miniatura cuadrada (ServiceCard).
  serviceImage: {
    label: 'Card del servicio',
    aspect: '4 / 3',
    crops: true,
    render: (u) => clImage(u, { w: 640, h: 480, crop: 'fill', gravity: 'auto' }),
    also: ['serviceThumb'],
  },
  serviceThumb: {
    label: 'Miniatura',
    aspect: '1 / 1',
    crops: true,
    render: (u) => clImage(u, { w: 240, h: 240, crop: 'fill', gravity: 'auto' }),
  },

  // Portada del catálogo — ancha (pad).
  catalogHero: {
    label: 'Portada del catálogo',
    aspect: '21 / 9',
    crops: false,
    render: (u) => clImage(u, { w: 1680, h: 720, crop: 'pad', background: 'auto:predominant' }),
  },
  // Item del catálogo (CatalogPreviewModal) — 4:3 recortado.
  catalogItem: {
    label: 'Item del catálogo',
    aspect: '4 / 3',
    crops: true,
    render: (u) => clImage(u, { w: 600, h: 450, crop: 'fill', gravity: 'auto' }),
  },
};
