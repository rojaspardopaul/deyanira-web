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

// ────────────────────────────────────────────────────────────
// Punto focal — viaja DENTRO de la URL como fragmento `#focal=x,y`
// (x,y normalizados 0..1). Así cualquier campo de imagen (todos son
// `string`) puede llevar su encuadre sin migrar el schema, y es
// retro-compatible: una URL sin `#focal` cae al `g_auto` de siempre.
// ────────────────────────────────────────────────────────────
const FOCAL_RE = /#focal=([0-9.]+),([0-9.]+)$/;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round2 = (n: number) => Math.round(clamp01(n) * 100) / 100;

/** Lee el punto focal de una URL (`#focal=x,y`). `null` si no tiene. */
export function getFocal(url: string | null | undefined): { x: number; y: number } | null {
  if (!url) return null;
  const m = url.match(FOCAL_RE);
  if (!m) return null;
  const x = parseFloat(m[1]);
  const y = parseFloat(m[2]);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return { x: clamp01(x), y: clamp01(y) };
}

/** Quita el fragmento `#focal=…` (para usar la URL como `src` o base). */
export function stripFocal(url: string | null | undefined): string {
  if (!url) return '';
  return url.replace(FOCAL_RE, '');
}

/** Escribe/reemplaza el punto focal en la URL. */
export function withFocal(url: string, x: number, y: number): string {
  return `${stripFocal(url)}#focal=${round2(x)},${round2(y)}`;
}

/** `true` si la URL apunta a un asset de Cloudinary (image/video upload). */
export function isCloudinaryUrl(url: string | null | undefined): boolean {
  return !!url && /res\.cloudinary\.com\/.+\/(image|video)\/upload\//.test(url);
}

/**
 * Devuelve la URL transformada para una imagen alojada en Cloudinary.
 * Si la URL no es de Cloudinary, la devuelve tal cual.
 *
 * El fragmento `#focal` (si existe) SIEMPRE se elimina del resultado. El punto
 * focal NO se aplica aquí (Cloudinary `g_xy_center` exige coordenadas en píxeles,
 * no fracciones): se aplica con `focalImg()` vía CSS `object-position`.
 *
 * Ejemplo:
 *   clImage('https://res.cloudinary.com/x/image/upload/v1/deyanira/eventos/abc.webp', { w: 1920, h: 800 })
 *   → 'https://.../upload/w_1920,h_800,c_fill,g_auto,q_auto,f_auto/v1/deyanira/eventos/abc.webp'
 */
export function clImage(url: string | null | undefined, opts: FitOpts = {}): string {
  const clean = stripFocal(url);
  if (!clean) return '';
  // Solo transformamos URLs de Cloudinary
  if (!isCloudinaryUrl(clean)) return clean;

  const {
    w, h,
    crop = 'fill',
    gravity = 'auto',
    background,
    quality = 'auto',
    format = 'auto',
  } = opts;

  const recorta = crop === 'fill' || crop === 'crop' || crop === 'thumb';

  // Orden recomendado por Cloudinary: dimensiones → modo de crop → gravity → background → calidad/formato
  const params: string[] = [];
  if (w) params.push(`w_${w}`);
  if (h) params.push(`h_${h}`);
  if (w || h) params.push(`c_${crop}`);
  if ((w || h) && recorta) {
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
  return clean.replace('/upload/', `/upload/${transformation}/`);
}

/**
 * Props para renderizar una imagen en un contenedor con `object-cover` respetando
 * el punto focal (`#focal=x,y`) vía CSS `object-position`. Entrega la imagen
 * redimensionada (webp por `f_auto`) SIN recortarla al aspecto, para que el
 * `object-cover` del contenedor haga el recorte centrado en el foco.
 *
 *   const im = focalImg(url, 800);
 *   <div style={{ aspectRatio: '16 / 9' }}>
 *     <img src={im.src} style={{ objectPosition: im.objectPosition }}
 *          className="w-full h-full object-cover" />
 *   </div>
 */
export function focalImg(
  url: string | null | undefined,
  w = 1000,
  fallback = '50% 50%',
): { src: string; objectPosition: string } {
  const f = getFocal(url);
  return {
    src: clImage(stripFocal(url), { w, h: w, crop: 'limit' }) || stripFocal(url),
    objectPosition: f ? `${(f.x * 100).toFixed(1)}% ${(f.y * 100).toFixed(1)}%` : fallback,
  };
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
