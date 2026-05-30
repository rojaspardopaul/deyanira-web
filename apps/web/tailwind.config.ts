import type { Config } from 'tailwindcss';

// ═══════════════════════════════════════════════════════════
//  MARCA — Cambia estos valores para rethemear toda la app
//  Después de cambiar, reinicia el servidor de desarrollo.
// ═══════════════════════════════════════════════════════════
const BRAND     = '#E8C040';   // Dorado principal — botones, bordes, acentos
const BRAND_DK  = '#C9A030';   // Dorado oscuro    — hover, sombras
const BRAND_LT  = '#FBF5CC';   // Dorado claro     — fondos, badges
// ═══════════════════════════════════════════════════════════

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#fefff5',
          100: BRAND_LT,
          200: '#f5e87a',
          300: '#f0d85a',
          400: BRAND,
          500: BRAND_DK,
          600: '#a88426',
          700: '#7d631c',
          800: '#5a4614',
          900: '#3a2e0d',
        },
        gold: {
          300: '#f0d85a',
          400: BRAND,
          500: BRAND_DK,
          600: '#a88426',
        },
        nude: {
          50:  '#fdfaf7',
          100: '#F5E6DA',
          200: '#ecdac9',
          300: '#dfc8b3',
        },
        dark: '#0F0F0F',
        cream: '#FAFAFA',
      },
      fontFamily: {
        sans:    ['var(--font-poppins)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        inter:   ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        poppins: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-pink':  'linear-gradient(135deg, #FF4FA2 0%, #e6368a 100%)',
        'gradient-gold':  `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DK} 100%)`,
        'gradient-dark':  'linear-gradient(135deg, #0F0F0F 0%, #1a0a14 100%)',
        'gradient-nude':  'linear-gradient(150deg, #FAFAFA 0%, #F5E6DA 100%)',
      },
      boxShadow: {
        'pink':       '0 8px 32px rgba(255,79,162,0.35)',
        'pink-sm':    '0 4px 16px rgba(255,79,162,0.25)',
        'gold':       '0 8px 32px rgba(232,192,64,0.4)',
        'glass':      '0 8px 32px rgba(0,0,0,0.12)',
        'card':       '0 2px 16px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.14)',
      },
      animation: {
        'shimmer':    'shimmer 1.5s ease-in-out infinite',
        'fade-up':    'fadeUp 0.6s ease forwards',
        'fade-in':    'fadeIn 0.5s ease forwards',
        'marquee':    'marquee 24s linear infinite',
        'float':      'float 6s ease-in-out infinite',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'slide-down': 'slideDown 0.3s ease forwards',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(-33.333%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(232,192,64,0.4)' },
          '50%':      { boxShadow: '0 0 0 12px rgba(232,192,64,0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
