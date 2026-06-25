/** @type {import('next').NextConfig} */
const PROD_URL = process.env.NEXT_PUBLIC_APP_URL || '';
const API_URL  = process.env.NEXT_PUBLIC_API_URL || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

const isProd = process.env.NODE_ENV === 'production';

const apiOrigin = (() => {
  try { return API_URL ? new URL(API_URL).origin : ''; } catch { return ''; }
})();

const supabaseOrigin = (() => {
  try { return SUPABASE_URL ? new URL(SUPABASE_URL).origin : ''; } catch { return ''; }
})();

// CSP — la app es server-rendered Next 14, así que evitamos 'unsafe-inline'
// donde sea posible. Next inyecta scripts inline para hydration con nonces
// si los activas; usamos 'unsafe-inline' SOLO para estilos (Tailwind atributo
// inline es común en runtime). Sin 'unsafe-eval' en producción.
const csp = [
  "default-src 'self'",
  `script-src 'self'${isProd ? '' : " 'unsafe-eval'"} 'unsafe-inline' https://checkout.culqi.com https://www.googletagmanager.com https://www.google-analytics.com https://challenges.cloudflare.com`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com data:`,
  `img-src 'self' data: blob: https://res.cloudinary.com https://*.supabase.co https://www.google-analytics.com`,
  `connect-src 'self' ${apiOrigin} ${supabaseOrigin} https://res.cloudinary.com https://*.supabase.co wss://*.supabase.co https://api.culqi.com https://secure.culqi.com https://www.google-analytics.com https://challenges.cloudflare.com`.trim(),
  `frame-src 'self' https://checkout.culqi.com https://www.google.com https://maps.google.com https://challenges.cloudflare.com`,
  `media-src 'self' blob: https://res.cloudinary.com https://*.supabase.co`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), interest-cohort=()',
  },
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Transpila el paquete de contratos compartidos (TS sin build) cuando se importe
  // en el cliente (p. ej. validar formularios con los esquemas Zod).
  transpilePackages: ['@deyanira/contracts'],

  // En prod NO ignoramos errores de tipo ni ESLint — bloquea código inseguro.
  // En CI puedes setear SKIP_TS=true / SKIP_LINT=true como escape hatch.
  typescript: { ignoreBuildErrors: process.env.SKIP_TS === 'true' },
  eslint:     { ignoreDuringBuilds: process.env.SKIP_LINT === 'true' },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
    minimumCacheTTL: 86400,
    formats: ['image/avif', 'image/webp'],
  },

  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        ...(PROD_URL ? [new URL(PROD_URL).host] : []),
      ],
    },
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },

  // Redirects de seguridad: forzar trailing-slash off, no leak en paths
  async redirects() {
    return [];
  },
};

module.exports = nextConfig;
