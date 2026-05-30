// Tokens de estilo compartidos por los subcomponentes del DateTimePicker.
// El primary de marca es dorado, pero el acento de los calendarios es rosa
// (#FF4FA2), coherente con Calendar.tsx / BookingCalendar.tsx existentes.
import type { CSSProperties } from 'react';
import type { DateTimeTheme } from './types';

export const PINK = '#FF4FA2';
export const PINK_DK = '#e6368a';
export const PINK_GRADIENT = `linear-gradient(135deg, ${PINK}, ${PINK_DK})`;

export type ThemeTokens = {
  surface: CSSProperties;       // contenedor del picker
  navBtn: CSSProperties;        // botón de navegación de mes/semana
  navHover: string;            // background hover de navBtn
  navIcon: string;             // color de íconos de navegación
  monthLabel: string;          // color del "Mayo 2026"
  dowLabel: string;            // color de "Lu Ma Mi..."
  selectedCell: CSSProperties; // celda de día seleccionada
  todayCell: CSSProperties;    // celda de hoy (no seleccionada)
  disabledCell: CSSProperties; // celda deshabilitada
  defaultCell: CSSProperties;  // celda normal
  cellHover: string;           // background hover de celda normal
  optionText: string;          // color de texto de opciones de hora
  optionBg: string;            // background de opción de hora inactiva
  optionHover: string;         // background hover de opción de hora
  inputField: string;          // clases tailwind del input trigger
  // Rueda de hora (TimeWheel)
  wheelText: string;           // color de ítem normal (no seleccionado)
  wheelDisabled: string;       // color de ítem deshabilitado (gris)
  wheelBand: string;           // background de la banda central de selección
  wheelBandBorder: string;     // borde sutil de la banda central
  wheelColLabel: string;       // color de las etiquetas "Hora" / "Min"
};

const LIGHT: ThemeTokens = {
  surface: { background: 'rgba(255,79,162,0.04)', border: '1px solid rgba(0,0,0,0.08)' },
  navBtn: { background: 'rgba(0,0,0,0.04)' },
  navHover: 'rgba(255,79,162,0.15)',
  navIcon: 'rgba(0,0,0,0.55)',
  monthLabel: '#111827',
  dowLabel: 'rgba(0,0,0,0.35)',
  selectedCell: { background: PINK_GRADIENT, color: '#fff', fontWeight: 700, boxShadow: '0 4px 12px rgba(255,79,162,0.4)' },
  todayCell: { outline: '2px solid rgba(255,79,162,0.5)', outlineOffset: '-2px', color: PINK, fontWeight: 700 },
  disabledCell: { color: 'rgba(0,0,0,0.2)', cursor: 'not-allowed' },
  defaultCell: { color: 'rgba(0,0,0,0.75)' },
  cellHover: 'rgba(255,79,162,0.12)',
  optionText: 'rgba(0,0,0,0.75)',
  optionBg: 'rgba(0,0,0,0.04)',
  optionHover: 'rgba(255,79,162,0.12)',
  inputField: 'bg-white border border-gray-200 text-gray-800 placeholder-gray-400',
  wheelText: 'rgba(0,0,0,0.7)',
  wheelDisabled: 'rgba(0,0,0,0.18)',
  wheelBand: 'rgba(255,79,162,0.10)',
  wheelBandBorder: 'rgba(255,79,162,0.35)',
  wheelColLabel: 'rgba(0,0,0,0.4)',
};

const DARK: ThemeTokens = {
  surface: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' },
  navBtn: { background: 'rgba(255,255,255,0.06)' },
  navHover: 'rgba(255,79,162,0.15)',
  navIcon: 'rgba(255,255,255,0.7)',
  monthLabel: '#ffffff',
  dowLabel: 'rgba(255,255,255,0.25)',
  selectedCell: { background: PINK_GRADIENT, color: '#fff', fontWeight: 700, boxShadow: '0 4px 12px rgba(255,79,162,0.4)' },
  todayCell: { outline: '2px solid rgba(255,79,162,0.5)', outlineOffset: '-2px', color: PINK, fontWeight: 700 },
  disabledCell: { color: 'rgba(255,255,255,0.15)', cursor: 'not-allowed' },
  defaultCell: { color: 'rgba(255,255,255,0.65)' },
  cellHover: 'rgba(255,79,162,0.12)',
  optionText: 'rgba(255,255,255,0.8)',
  optionBg: 'rgba(255,255,255,0.06)',
  optionHover: 'rgba(255,79,162,0.18)',
  inputField: 'border text-white placeholder-white/40',
  wheelText: 'rgba(255,255,255,0.75)',
  wheelDisabled: 'rgba(255,255,255,0.18)',
  wheelBand: 'rgba(255,79,162,0.16)',
  wheelBandBorder: 'rgba(255,79,162,0.4)',
  wheelColLabel: 'rgba(255,255,255,0.4)',
};

export function getTokens(theme: DateTimeTheme = 'light'): ThemeTokens {
  return theme === 'dark' ? DARK : LIGHT;
}
