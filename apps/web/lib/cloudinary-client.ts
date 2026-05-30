// Helper para añadir transformaciones a URLs de Cloudinary sin tener que subir variantes.
// Permite que una sola imagen base se renderice en distintos tamaños/aspectos sin
// recortes feos, usando `g_auto` (focal point inteligente) o `g_face` (detecta rostros).

type FitOpts = {
  /** Ancho del crop (px). */
  w?: number;
  /** Alto del crop (px). */
  h?: number;
  /**
   * Estrategia de crop:
   *   - 'fill'  → recorta para rellenar exactamente w×h (puede cortar contenido)
   *   - 'fit'   → cabe dentro de w×h sin recortar; puede quedar más pequeño
   *   - 'limit' → como 'fit' pero solo encoge, nunca amplía
   *   - 'pad'   → cabe sin recortar y rellena los espacios sobrantes (combinar con background)
   *   - 'scale' → estira/comprime a w×h ignorando aspect ratio
   */
  crop?: 'fill' | 'fit' | 'limit' | 'scale' | 'crop' | 'thumb' | 'pad';
  /**
   * Cómo decide qué parte mantener cuando recorta:
   *   - 'auto' (default): Cloudinary AI elige el punto focal automáticamente.
   *   - 'face':  prioriza el rostro detectado.
   *   - 'faces': múltiples rostros (grupales).
   */
  gravity?: 'auto' | 'face' | 'faces' | 'center' | 'north' | 'south' | 'east' | 'west' | 'north_east' | 'north_west' | 'south_east' | 'south_west';
  /**
   * Fondo cuando hay espacio sobrante (con crop='pad'):
   *   - 'blurred' (recomendado para hero): extiende la imagen con un blur natural
   *   - 'auto:predominant': color predominante de la imagen
   *   - 'black' | 'white' | '#hex': color sólido
   */
  background?: 'blurred' | 'auto' | 'auto:predominant' | 'black' | 'white' | string;
  /** Calidad (default 'auto'). */
  quality?: number | 'auto';
  /** Formato (default 'auto' — Cloudinary elige WebP/AVIF si el navegador soporta). */
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
};

/**
 * Devuelve la URL transformada para una imagen alojada en Cloudinary.
 * Si la URL no es de Cloudinary, la devuelve tal cual.
 *
 * Ejemplo:
 *   clImage('https://res.cloudinary.com/x/image/upload/v1/deyanira/eventos/abc.webp', { w: 1920, h: 800 })
 *   → 'https://.../upload/c_fill,g_auto,w_1920,h_800,q_auto,f_auto/v1/deyanira/eventos/abc.webp'
 */
export function clImage(url: string | null | undefined, opts: FitOpts = {}): string {
  if (!url) return '';
  // Solo transformamos URLs de Cloudinary
  if (!/res\.cloudinary\.com\/.+\/(image|video)\/upload\//.test(url)) return url;

  const {
    w, h,
    crop = 'fill',
    gravity = 'auto',
    background,
    quality = 'auto',
    format = 'auto',
  } = opts;

  // Orden recomendado por Cloudinary: dimensiones → modo de crop → gravity → background → calidad/formato
  const params: string[] = [];
  if (w) params.push(`w_${w}`);
  if (h) params.push(`h_${h}`);
  if (w || h) params.push(`c_${crop}`);
  if ((w || h) && (crop === 'fill' || crop === 'crop' || crop === 'thumb')) {
    params.push(`g_${gravity}`);
  }
  if (background) {
    let bg: string;
    // 'blurred' requiere el add-on Imagga / plan pago. Si fallback hace falta, usar 'auto:predominant'.
    if (background === 'blurred') bg = 'blurred:400';
    else if (background === 'auto') bg = 'auto:predominant';
    else if (background === 'auto:predominant') bg = 'auto:predominant';
    else if (background.startsWith('#')) bg = `rgb:${background.slice(1)}`;
    else bg = background;
    params.push(`b_${bg}`);
  }
  params.push(`q_${quality}`);
  params.push(`f_${format}`);

  const transformation = params.join(',');
  // Insertamos las transformaciones después del PRIMER /upload/. Las URLs de Cloudinary
  // tienen exactamente uno: /image/upload/<version-o-path>/...
  return url.replace('/upload/', `/upload/${transformation}/`);
}

/**
 * Preset ideal para fondos de hero / banner: muestra la imagen ENTERA sin recortes,
 * rellenando con un blur natural los bordes que sobren. Combina bien con un overlay oscuro.
 */
export const heroBlurred = (url: string | null | undefined, w = 2000, h = 1000) =>
  clImage(url, { w, h, crop: 'pad', background: 'blurred' });

/** Preset común para banner/hero horizontal (16:9 ó similar). */
export const heroBanner = (url: string | null | undefined, w = 1920, h = 900) =>
  clImage(url, { w, h, crop: 'fill', gravity: 'auto' });

/** Preset para card cuadrada con rostro centrado. */
export const cardFace = (url: string | null | undefined, w = 600, h = 600) =>
  clImage(url, { w, h, crop: 'fill', gravity: 'face' });

/** Preset para thumbnail compacto. */
export const thumb = (url: string | null | undefined, w = 240, h = 180) =>
  clImage(url, { w, h, crop: 'fill', gravity: 'auto' });
