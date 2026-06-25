import type { Metadata } from 'next';
import ContactoContent from '@/components/contacto/ContactoContent';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Contacto y Ubicación — Deyanira Makeup Beauty Lima',
  description: 'Encuéntranos en Cieneguilla, Lima. Horarios de atención, teléfono, WhatsApp y ubicación en Google Maps. Atendemos toda Lima Metropolitana.',
  path: '/contacto',
  keywords: [
    'Deyanira Makeup Beauty ubicación',
    'salón de belleza Cieneguilla dirección',
    'contacto salón belleza Lima',
    'WhatsApp salón Cieneguilla',
  ],
});

export default function ContactoPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0A0A0A' }}>

      {/* Hero */}
      <div className="relative pt-28 pb-14 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,175,55,0.12) 0%, transparent 70%)',
        }} />
        <span className="inline-block text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#D4AF37' }}>
          Contáctanos
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Estamos aquí para ti
        </h1>
        <p className="text-base max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Visítanos en Lima o escríbenos — respondemos rápido.
        </p>
      </div>

      {/* Contenido dinámico */}
      <ContactoContent />
    </div>
  );
}
