'use client';

import { MapPin, Clock, ExternalLink } from 'lucide-react';
import { useSalonSettings } from '@/lib/useSalonSettings';

const LAT = -12.1109913;
const LNG = -76.8182017;

// Google Maps embed — mismo lugar real del negocio que en /contacto (sin API key)
const MAP_EMBED_URL =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3901.6!2d-76.8182017!3d-12.1109913!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9105eb6d5ce17247%3A0xce4bf1bb73951425!2sSalon%20%7C%20Deyanira%20Makeup%20Beauty%20%7C%20Profesional!5e0!3m2!1ses!2spe';

const GMAPS_URL = `https://www.google.com/maps/search/?api=1&query=${LAT},${LNG}`;

export default function LocationSection() {
  const s = useSalonSettings();

  const address = s
    ? [s.address, s.district, s.city || 'Lima'].filter(Boolean).join(', ')
    : 'Cieneguilla, Lima, Perú';

  const hours = [
    { label: 'Lun – Vie', value: s?.hoursWeekday  || '9:00 – 19:00', closed: false },
    { label: 'Sábado',    value: s?.hoursSaturday || '9:00 – 17:00', closed: false },
    { label: 'Domingo',   value: s?.hoursSunday   || 'Cerrado',
      closed: (s?.hoursSunday || 'Cerrado').toLowerCase().includes('cerrado') },
  ];


  return (
    <section className="py-10 px-4" style={{ background: '#0A0A0A' }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: '#D4AF37' }}>
            Cómo llegar
          </span>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* Info cards */}
          <div className="space-y-4">
            <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.15)' }}>
              <div className="flex items-center gap-3 mb-2">
                <MapPin className="w-4 h-4 shrink-0" style={{ color: '#D4AF37' }} />
                <span className="font-semibold text-white text-sm">Dirección</span>
              </div>
              <p className="text-sm pl-7" style={{ color: 'rgba(255,255,255,0.5)' }}>{address}</p>
            </div>

            <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.15)' }}>
              <div className="flex items-center gap-3 mb-3">
                <Clock className="w-4 h-4 shrink-0" style={{ color: '#D4AF37' }} />
                <span className="font-semibold text-white text-sm">Horarios</span>
              </div>
              <div className="pl-7 space-y-2">
                {hours.map(({ label, value, closed }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
                    <span className={closed ? 'text-red-400' : undefined} style={closed ? undefined : { color: 'rgba(255,255,255,0.85)' }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Mapa */}
          <div className="lg:col-span-2 flex flex-col gap-2">
            <div className="rounded-2xl overflow-hidden" style={{ height: '350px', border: '1px solid rgba(212,175,55,0.15)' }}>
              <iframe
                src={MAP_EMBED_URL}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación Deyanira Makeup Beauty"
              />
            </div>
            <a
              href={GMAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 self-end text-xs font-semibold transition-opacity hover:opacity-70"
              style={{ color: 'rgba(212,175,55,0.7)' }}
            >
              <ExternalLink className="w-3 h-3" />
              Ver en Google Maps
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
