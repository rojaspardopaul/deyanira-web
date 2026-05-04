import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';

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
  // Schema.org LocalBusiness se inyecta en page.tsx
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  );
}
