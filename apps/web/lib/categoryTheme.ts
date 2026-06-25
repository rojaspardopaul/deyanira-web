// Paleta suave por categoría de servicio — único punto de verdad de los colores
// de los cards (la categoría NO tiene color en la BD). Cambiar un color de marca
// = editar este archivo. Cada paleta: fondo suave de cabecera, color de acento,
// color de texto del chip, degradado del thumb de imagen y emoji de respaldo.

export type CategoryTheme = {
  soft: string;      // fondo suave de la cabecera del card
  accent: string;    // color de acento (precio, iconos de meta)
  chipText: string;  // texto del chip de categoría
  gradient: string;  // degradado del thumb (fallback sin imagen)
  emoji: string;     // emoji de respaldo
};

// Mapa curado por slug (los que ya existen en el salón).
const CURATED: Record<string, CategoryTheme> = {
  maquillaje: { soft: '#ffeef5', accent: '#e84393', chipText: '#c0397a', gradient: 'linear-gradient(135deg,#ffd9e7,#f7a8c8)', emoji: '💄' },
  cabello:    { soft: '#fff6e6', accent: '#c79a2e', chipText: '#a9821f', gradient: 'linear-gradient(135deg,#fde9b8,#f2cf7a)', emoji: '💇‍♀️' },
  unas:       { soft: '#f3effe', accent: '#8b5cf6', chipText: '#6d44d6', gradient: 'linear-gradient(135deg,#e2d8fb,#c3b0f4)', emoji: '💅' },
  cejas:      { soft: '#e9f9f1', accent: '#10b981', chipText: '#07875f', gradient: 'linear-gradient(135deg,#c7f0db,#92e3bd)', emoji: '🪞' },
  pestanas:   { soft: '#e9f4ff', accent: '#3b9eef', chipText: '#2176c7', gradient: 'linear-gradient(135deg,#cfe7fb,#9fcdf5)', emoji: '👁️' },
  spa:        { soft: '#fff0ea', accent: '#fb7a5c', chipText: '#d85636', gradient: 'linear-gradient(135deg,#ffd8c9,#f9b39a)', emoji: '🧖‍♀️' },
  facial:     { soft: '#fff0ea', accent: '#fb7a5c', chipText: '#d85636', gradient: 'linear-gradient(135deg,#ffd8c9,#f9b39a)', emoji: '🧖‍♀️' },
};

// Paletas suaves de respaldo para categorías nuevas (asignación estable por hash).
const FALLBACKS: CategoryTheme[] = [
  { soft: '#ffeef5', accent: '#e84393', chipText: '#c0397a', gradient: 'linear-gradient(135deg,#ffd9e7,#f7a8c8)', emoji: '✨' },
  { soft: '#fff6e6', accent: '#c79a2e', chipText: '#a9821f', gradient: 'linear-gradient(135deg,#fde9b8,#f2cf7a)', emoji: '✨' },
  { soft: '#f3effe', accent: '#8b5cf6', chipText: '#6d44d6', gradient: 'linear-gradient(135deg,#e2d8fb,#c3b0f4)', emoji: '✨' },
  { soft: '#e9f9f1', accent: '#10b981', chipText: '#07875f', gradient: 'linear-gradient(135deg,#c7f0db,#92e3bd)', emoji: '✨' },
  { soft: '#e9f4ff', accent: '#3b9eef', chipText: '#2176c7', gradient: 'linear-gradient(135deg,#cfe7fb,#9fcdf5)', emoji: '✨' },
  { soft: '#fff0ea', accent: '#fb7a5c', chipText: '#d85636', gradient: 'linear-gradient(135deg,#ffd8c9,#f9b39a)', emoji: '✨' },
];

// Normaliza un slug/nombre a [a-z]: minúsculas y, tras NFD, se descartan los
// no-letras (incluidas las marcas diacríticas combinantes y guiones/espacios).
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Devuelve la paleta suave de una categoría (curada o fallback estable). */
export function getCategoryTheme(slug?: string | null, name?: string | null): CategoryTheme {
  const key = norm(slug || name || '');
  if (key && CURATED[key]) return CURATED[key];
  // match parcial (ej. "unasacrilicas" → "unas")
  for (const k of Object.keys(CURATED)) {
    if (key.includes(k)) return CURATED[k];
  }
  if (!key) return FALLBACKS[0];
  return FALLBACKS[hash(key) % FALLBACKS.length];
}

// Botón DORADO uniforme para TODOS los cards (no depende de la categoría).
export const SERVICE_BTN_GRADIENT = 'linear-gradient(135deg,#d8b948,#b8902a)';
export const SERVICE_BTN_SHADOW = '0 6px 16px rgba(184,144,42,.34)';
