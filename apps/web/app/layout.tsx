import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import BottomNav from '@/components/layout/BottomNav';

// Self-hosted fonts — cero render-blocking, cero peticiones a Google en runtime
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Deyanira Makeup Beauty | Salón de Belleza en Lima, Perú',
    template: '%s | Deyanira Makeup Beauty',
  },
  description:
    'Salón de belleza profesional en Lima, Perú. Maquillaje, cabello, uñas, cejas. Agenda tu cita online y compra productos de belleza.',
  keywords: ['salon de belleza lima', 'maquillaje profesional peru', 'citas de belleza lima'],
  openGraph: {
    type: 'website',
    locale: 'es_PE',
    siteName: 'Deyanira Makeup Beauty',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <Header />
        {/* pb-nav = espacio para el bottom nav en móvil (safe area incluida) */}
        <main className="pb-nav md:pb-0">
          {children}
        </main>
        <Footer />
        <WhatsAppButton />
        <BottomNav />
      </body>
    </html>
  );
}
