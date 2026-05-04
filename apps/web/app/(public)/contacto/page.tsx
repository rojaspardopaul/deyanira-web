import type { Metadata } from 'next';
import { MapPin, Phone, Clock, MessageCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Ubicación, horarios y contacto de Deyanira Makeup Beauty en Lima, Perú.',
};

export default function ContactoPage() {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '') || '';

  return (
    <div className="min-h-screen bg-white pt-20">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="section-title">Contacto</h1>
          <p className="text-gray-600">Estamos en Lima, Perú. ¡Escríbenos por WhatsApp!</p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Info de contacto */}
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Ubicación</h3>
                <p className="text-gray-600">Lima, Perú</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">WhatsApp</h3>
                <a
                  href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('¡Hola! Quiero información sobre sus servicios.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline font-medium"
                >
                  Escribirnos por WhatsApp
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Horarios</h3>
                <table className="text-sm text-gray-600">
                  <tbody>
                    <tr><td className="pr-6 py-1 font-medium">Lunes – Viernes</td><td>9:00 – 19:00</td></tr>
                    <tr><td className="pr-6 py-1 font-medium">Sábado</td><td>9:00 – 17:00</td></tr>
                    <tr><td className="pr-6 py-1 font-medium">Domingo</td><td className="text-red-500">Cerrado</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <a
              href="/reservar"
              className="btn-primary inline-flex mt-4"
            >
              Reservar cita online
            </a>
          </div>

          {/* Mapa embebido de Google Maps */}
          <div className="rounded-2xl overflow-hidden shadow-lg h-96 bg-gray-100">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3901.6!2d-76.8182017!3d-12.1109913!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9105eb6d5ce17247%3A0xce4bf1bb73951425!2sSalon%20%7C%20Deyanira%20Makeup%20Beauty%20%7C%20Profesional!5e0!3m2!1ses!2spe"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
