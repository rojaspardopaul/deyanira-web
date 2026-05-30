'use client';

import Link from 'next/link';
import { MapPin, Clock, MessageCircle, ArrowRight, CalendarCheck } from 'lucide-react';
import { useSalonSettings } from '@/lib/useSalonSettings';

const MAP_EMBED_URL =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3901.6!2d-76.8182017!3d-12.1109913!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9105eb6d5ce17247%3A0xce4bf1bb73951425!2sSalon%20%7C%20Deyanira%20Makeup%20Beauty%20%7C%20Profesional!5e0!3m2!1ses!2spe';

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export default function ContactoContent() {
  const s = useSalonSettings();

  const address = s
    ? [s.address, s.district, s.city || 'Lima'].filter(Boolean).join(', ')
    : 'Villa El Salvador, Lima, Perú';

  const hours = [
    { label: 'Lunes – Viernes', value: s?.hoursWeekday  || '9:00 – 19:00', closed: false },
    { label: 'Sábado',          value: s?.hoursSaturday || '9:00 – 17:00', closed: false },
    { label: 'Domingo',         value: s?.hoursSunday   || 'Cerrado',
      closed: (s?.hoursSunday || 'Cerrado').toLowerCase().includes('cerrado') },
  ];

  const waNumber = (s?.whatsapp || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  const waLink   = `https://wa.me/${waNumber}?text=${encodeURIComponent('¡Hola! Quiero información sobre sus servicios.')}`;

  const instagramUrl = s?.instagramUrl || 'https://instagram.com/deyanirabeauty';
  const facebookUrl  = s?.facebookUrl  || 'https://facebook.com/deyanirabeauty';

  // Extraer handle de Instagram para mostrarlo
  const instagramHandle = instagramUrl.replace(/\/$/, '').split('/').pop() || 'deyanirabeauty';

  return (
    <div className="max-w-6xl mx-auto px-4 pb-24">

      {/* Tarjetas de info — 1 col / 2 cols tablet / 4 cols desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">

        {/* Dirección */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.15)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(212,175,55,0.12)' }}>
            <MapPin className="w-5 h-5" style={{ color: '#D4AF37' }} />
          </div>
          <h3 className="font-semibold text-white mb-1 text-sm">Dirección</h3>
          <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>{address}</p>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium"
            style={{ color: '#D4AF37' }}>
            Abrir en Maps <ArrowRight className="w-3 h-3" />
          </a>
        </div>

        {/* WhatsApp */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(37,211,102,0.2)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(37,211,102,0.1)' }}>
            <MessageCircle className="w-5 h-5 text-green-400" />
          </div>
          <h3 className="font-semibold text-white mb-1 text-sm">WhatsApp</h3>
          <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>Respondemos en minutos</p>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: '#25D366' }}>
            Escribirnos
          </a>
        </div>

        {/* Horarios */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.15)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(212,175,55,0.12)' }}>
            <Clock className="w-5 h-5" style={{ color: '#D4AF37' }} />
          </div>
          <h3 className="font-semibold text-white mb-3 text-sm">Horarios</h3>
          <div className="space-y-1.5">
            {hours.map(({ label, value, closed }) => (
              <div key={label} className="flex justify-between text-xs gap-2">
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                <span className={closed ? 'text-red-400 font-medium' : 'text-white font-medium'}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reservar */}
        <div className="rounded-2xl p-5 flex flex-col items-center justify-center text-center"
          style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.05))', border: '1px solid rgba(212,175,55,0.25)' }}>
          <CalendarCheck className="w-8 h-8 mb-3" style={{ color: '#D4AF37' }} />
          <h3 className="font-semibold text-white text-sm mb-1">¿Lista para tu cita?</h3>
          <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>Agenda online en segundos</p>
          <Link
            href="/reservar"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#D4AF37,#b8962e)', color: '#0A0A0A' }}>
            Reservar ahora <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Mapa + redes — 1 col mobile / 2 cols desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Mapa — 2/3 en desktop */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden w-full"
          style={{ height: '420px', border: '1px solid rgba(212,175,55,0.15)' }}>
          <iframe
            src={MAP_EMBED_URL}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {/* Redes sociales */}
        <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.15)' }}>
          <h3 className="font-semibold text-white mb-4">Síguenos</h3>
          <div className="space-y-3">
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl transition-all hover:-translate-y-0.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}>
                <IconInstagram className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">Instagram</p>
                <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>@{instagramHandle}</p>
              </div>
              <ArrowRight className="w-4 h-4 ml-auto shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
            </a>

            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl transition-all hover:-translate-y-0.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#1877F2' }}>
                <IconFacebook className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">Facebook</p>
                <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {s?.salonName || 'Deyanira Makeup Beauty'}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 ml-auto shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
            </a>
          </div>

          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white mt-5 transition-all hover:-translate-y-0.5"
            style={{ background: '#25D366', boxShadow: '0 4px 16px rgba(37,211,102,0.3)' }}>
            <MessageCircle className="w-4 h-4" />
            Escribirnos por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
