// Open Graph image dinámico para la home.
// Next 14 lo genera en build/edge runtime. Tamaño 1200×630 (estándar OG).
//
// Para overrides por ruta, crea `app/(public)/<ruta>/opengraph-image.tsx`
// con el mismo patrón.

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Deyanira Makeup Beauty — Salón de belleza en Cieneguilla, Lima';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #100815 0%, #1a0510 50%, #100815 100%)',
          fontFamily: 'serif',
          position: 'relative',
        }}
      >
        {/* Gold gradient bar */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 6,
          background: 'linear-gradient(90deg, transparent, #d4af37, transparent)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: 6,
          background: 'linear-gradient(90deg, transparent, #d4af37, transparent)',
        }} />

        {/* Brand */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}>
          <div style={{
            fontSize: 16,
            letterSpacing: 14,
            color: 'rgba(212,175,55,0.55)',
            textTransform: 'uppercase',
            fontFamily: 'sans-serif',
          }}>
            Makeup Beauty
          </div>

          <div style={{
            fontSize: 120,
            fontWeight: 800,
            letterSpacing: 8,
            color: '#d4af37',
            lineHeight: 1,
          }}>
            DEYANIRA
          </div>

          <div style={{
            fontSize: 28,
            color: '#fff',
            fontStyle: 'italic',
            opacity: 0.85,
            marginTop: 18,
          }}>
            Salón de belleza profesional en Cieneguilla, Lima
          </div>

          <div style={{
            fontSize: 18,
            color: 'rgba(255,255,255,0.55)',
            marginTop: 10,
            display: 'flex',
            gap: 24,
            fontFamily: 'sans-serif',
          }}>
            <span>💄 Maquillaje</span>
            <span>💇 Cabello</span>
            <span>💅 Uñas</span>
            <span>✨ Cejas</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          position: 'absolute',
          bottom: 32,
          right: 48,
          fontSize: 18,
          color: 'rgba(255,255,255,0.45)',
          fontFamily: 'sans-serif',
        }}>
          deyanira.pe
        </div>
      </div>
    ),
    { ...size }
  );
}
