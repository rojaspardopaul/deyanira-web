'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { MapPin, Phone, Clock, Instagram, Facebook } from 'lucide-react';
import { useSalonSettings } from '@/lib/useSalonSettings';

const LINKS = [
  ['Servicios',     '/servicios'],
  ['Tienda',        '/tienda'],
  ['Galería',       '/galeria'],
  ['Nosotros',      '/nosotros'],
  ['Contacto',      '/contacto'],
  ['Reservar cita', '/reservar'],
];

export default function Footer() {
  const pathname = usePathname();
  const salonSettings = useSalonSettings();
  if (pathname.startsWith('/admin')) return null;

  return (
    <footer style={{ background: '#0A0A0A', borderTop: '1px solid rgba(212,175,55,0.2)' }}>
      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-10 grid md:grid-cols-4 gap-10">

        {/* Brand */}
        <div className="md:col-span-2">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-5 group">
            <Image
              src={salonSettings?.logoDarkUrl || '/logo-dark.png'}
              alt={salonSettings?.salonName || 'Deyanira Makeup Beauty'}
              width={0}
              height={0}
              sizes="200px"
              style={{ width: 'auto', height: '3.5rem' }}
              className="object-contain transition-transform duration-300 group-hover:scale-105"
              unoptimized
            />
          </Link>

          <p className="text-sm leading-relaxed mb-6 max-w-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Salón de belleza profesional en Lima, Perú. Maquillaje, cabello, uñas y cejas con los mejores productos del mercado.
          </p>

          {/* Social icons */}
          <div className="flex gap-3">
            {salonSettings?.instagramUrl && (
              <a href={salonSettings.instagramUrl as string} aria-label="Instagram" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,79,162,0.4)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}>
                <Instagram className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.55)' }} />
              </a>
            )}
            {salonSettings?.facebookUrl && (
              <a href={salonSettings.facebookUrl as string} aria-label="Facebook" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,79,162,0.4)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}>
                <Facebook className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.55)' }} />
              </a>
            )}
            {!salonSettings && (
              <>
                {[Instagram, Facebook].map((Icon, i) => (
                  <div key={i} className="w-9 h-9 rounded-xl animate-pulse"
                    style={{ background: 'rgba(255,255,255,0.06)' }} />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Nav */}
        <div>
          <h4 className="text-white font-semibold mb-5 text-sm uppercase tracking-wider">Menú</h4>
          <ul className="space-y-2.5">
            {LINKS.map(([label, href]) => (
              <li key={href}>
                <Link href={href}
                  className="text-sm transition-colors duration-200 hover:text-white"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D4AF37'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; }}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-white font-semibold mb-5 text-sm uppercase tracking-wider">Contacto</h4>
          <ul className="space-y-3.5">
            {(salonSettings?.address || salonSettings?.district || salonSettings?.city) && (
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#D4AF37' }} />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {[salonSettings.address, salonSettings.district, salonSettings.city || 'Lima'].filter(Boolean).join(', ')}
                </span>
              </li>
            )}
            {!salonSettings && (
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#D4AF37' }} />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Lima, Perú</span>
              </li>
            )}
            {(salonSettings?.whatsapp || salonSettings?.phone) && (
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 shrink-0" style={{ color: '#D4AF37' }} />
                <a href={`https://wa.me/${(salonSettings.whatsapp || salonSettings.phone as string || '').replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-sm transition-colors duration-200"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D4AF37'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; }}>
                  WhatsApp
                </a>
              </li>
            )}
            <li className="flex items-start gap-3">
              <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#D4AF37' }} />
              <span className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {salonSettings?.hoursWeekday
                  ? <>Lun–Vie {salonSettings.hoursWeekday as string}<br />Sáb {salonSettings.hoursSaturday as string || '9:00–17:00'}</>
                  : <>Lun–Vie 9:00–19:00<br />Sáb 9:00–17:00</>
                }
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}>
        <p>© {new Date().getFullYear()} Papayita - Paul Rojas Pardo. Todos los derechos reservados.</p>
        <Link href="/politica-de-privacidad"
          className="hover:text-white/60 transition-colors duration-200">
          Política de privacidad
        </Link>
      </div>
    </footer>
  );
}
