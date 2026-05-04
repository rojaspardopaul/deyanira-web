import type { Metadata } from 'next';
import BookingWizard from '@/components/booking/BookingWizard';

export const metadata: Metadata = {
  title: 'Reservar Cita',
  description: 'Agenda tu cita en Deyanira Makeup Beauty. Elige tu servicio, estilista y horario favorito.',
};

export default function ReservarPage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-display font-bold text-gray-900 mb-3">
            Reserva tu cita
          </h1>
          <p className="text-gray-600">
            Selecciona tu servicio, estilista y horario disponible
          </p>
        </div>
        <BookingWizard />
      </div>
    </div>
  );
}
