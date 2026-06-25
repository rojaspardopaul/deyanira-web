import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display, Poppins } from 'next/font/google';
import './globals.css';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import BottomNav from '@/components/layout/BottomNav';
import FaviconUpdater from '@/components/layout/FaviconUpdater';
import { LoadingProvider } from '@/lib/loading';
import { SalonSettingsProvider } from '@/lib/useSalonSettings';

import { JsonLd } from '@/components/seo/JsonLd';
import { organizationLd, webSiteLd } from '@/lib/jsonld';
import { SITE } from '@/lib/seo';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#100815' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: 'Deyanira Makeup Beauty | Salón de Belleza en Cieneguilla, Lima',
    template: '%s | Deyanira Makeup Beauty',
  },
  description: SITE.defaultDescription,
  keywords: SITE.defaultKeywords,
  applicationName: SITE.name,
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  publisher: SITE.name,
  formatDetection: { telephone: true, email: true, address: true },
  alternates: {
    canonical: SITE.url,
    languages: { 'es-PE': SITE.url, 'x-default': SITE.url },
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: '/favicon.ico',
  },
  openGraph: {
    type: 'website',
    locale: SITE.locale,
    siteName: SITE.name,
    title: 'Deyanira Makeup Beauty | Salón de Belleza en Cieneguilla, Lima',
    description: SITE.defaultDescription,
    url: SITE.url,
  },
  twitter: {
    card: 'summary_large_image',
    site: SITE.twitter,
    creator: SITE.twitter,
    title: 'Deyanira Makeup Beauty | Salón de Belleza en Cieneguilla, Lima',
    description: SITE.defaultDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    // bing: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION,
  },
  category: 'beauty',
  other: {
    'geo.region': SITE.geo.region,
    'geo.placename': SITE.geo.placename,
    'geo.position': SITE.geo.position,
    'ICBM': SITE.geo.icbm,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={SITE.language} className={`${inter.variable} ${poppins.variable} ${playfair.variable}`}>
      <head>
        {/* Performance: preconnect a recursos críticos */}
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://api.culqi.com" />

        {/* Structured data global (Organization + WebSite) */}
        <JsonLd data={[organizationLd(), webSiteLd()]} />
      </head>
      <body>
        <LoadingProvider>
          <SalonSettingsProvider>
            <FaviconUpdater />
            <Header />
            <main>
              {children}
            </main>
            <Footer />
            <WhatsAppButton />
            <BottomNav />
          </SalonSettingsProvider>
        </LoadingProvider>
      </body>
    </html>
  );
}
