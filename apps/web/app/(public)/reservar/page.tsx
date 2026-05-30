import type { Metadata } from 'next';
import { Sparkles, Shield, Clock, Star } from 'lucide-react';
import BookingWizard from '@/components/booking/BookingWizard';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Reservar Cita Online en Lima — Salón de Belleza Deyanira',
  description: 'Agenda tu cita de maquillaje, uñas, cabello o cejas en segundos. Disponibilidad en tiempo real, confirmación inmediata por WhatsApp. También a domicilio en Lima.',
  path: '/reservar',
  keywords: [
    'reservar cita salón belleza Lima',
    'agendar maquillaje Lima',
    'cita uñas online Lima',
    'reserva belleza Surco',
    'cita peluquería online Lima',
    'maquillaje a domicilio Lima',
  ],
});

const TRUST = [
  { icon: Shield, text: 'Confirmación inmediata' },
  { icon: Clock,  text: 'Sin esperas' },
  { icon: Star,   text: '+500 clientas satisfechas' },
];

export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; category?: string; package?: string; trial?: string }>;
}) {
  const { service, category, package: packageId, trial } = await searchParams;
  return (
    <div className="min-h-screen pt-16" style={{ background: '#0F0F0F' }}>
      {/* Glow de fondo */}
      <div className="fixed top-0 left-0 right-0 h-screen pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(255,79,162,0.06) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-4 py-10 md:py-14">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-4 text-xs font-semibold uppercase tracking-wider"
            style={{ background: 'rgba(255,79,162,0.1)', border: '1px solid rgba(255,79,162,0.2)', color: '#FF4FA2' }}>
            <Sparkles className="w-3 h-3" /> Agenda en línea
          </div>
          <h1 className="font-display font-bold italic text-4xl md:text-5xl text-white mb-3">
            Reserva tu <span style={{ color: '#FF4FA2' }}>cita</span>
          </h1>
          <p className="text-sm max-w-sm mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Selecciona tus servicios, estilista y horario disponible en segundos
          </p>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-4 mt-5 flex-wrap">
            {TRUST.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Wizard card */}
        <div className="rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
          }}>
          <BookingWizard
            initialServiceId={service}
            initialCategorySlug={category}
            initialPackageId={packageId}
            initialTrialEnabled={trial === '1' || trial === 'true'}
          />
        </div>

        {/* Footer note */}
        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Al reservar aceptas que te contactemos por WhatsApp para confirmar tu cita
        </p>
      </div>
    </div>
  );
}
