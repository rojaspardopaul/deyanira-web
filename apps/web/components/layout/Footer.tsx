'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { MapPin, Phone, Clock, Instagram, Facebook, Mail, BookOpen } from 'lucide-react';
import { useSalonSettings } from '@/lib/useSalonSettings';

// lucide-react no incluye el logo de marca de TikTok → SVG inline (simple-icons).
function TikTokIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} style={style}>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

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
            {salonSettings?.tiktokUrl && (
              <a href={salonSettings.tiktokUrl as string} aria-label="TikTok" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,79,162,0.4)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}>
                <TikTokIcon className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.55)' }} />
              </a>
            )}
            {!salonSettings && (
              <>
                {[Instagram, Facebook, TikTokIcon].map((Icon, i) => (
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
            {salonSettings?.email && (
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 shrink-0" style={{ color: '#D4AF37' }} />
                <a href={`mailto:${salonSettings.email as string}`}
                  className="text-sm transition-colors duration-200 break-all"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D4AF37'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; }}>
                  {salonSettings.email as string}
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

      {/* Legal links */}
      <div className="max-w-6xl mx-auto px-4 pb-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1.25rem' }}>
        {([
          ['Términos y Condiciones', '/terminos-y-condiciones'],
          ['Cambios y Devoluciones', '/politica-de-cambios-y-devoluciones'],
          ['Política de Privacidad', '/politica-de-privacidad'],
        ] as const).map(([label, href]) => (
          <Link key={href} href={href}
            className="transition-colors duration-200 hover:text-white"
            style={{ color: 'rgba(255,255,255,0.45)' }}>
            {label}
          </Link>
        ))}
        <Link href="/libro-de-reclamaciones" aria-label="Libro de Reclamaciones"
          className="inline-flex items-center gap-2 bg-white rounded-md px-3 py-1.5 shadow-sm hover:shadow-md transition-shadow ml-auto"
          style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
          <BookOpen className="w-7 h-7 shrink-0" strokeWidth={1.5} style={{ color: '#2f6fb0' }} />
          <span className="font-bold leading-[1.05] text-[13px]" style={{ color: '#2f6fb0' }}>
            Libro de<br />Reclamaciones
          </span>
        </Link>
      </div>

      {/* Bottom bar */}
      <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}>
        <p>© {new Date().getFullYear()} {salonSettings?.salonName as string || 'Deyanira Makeup Beauty'}. Todos los derechos reservados.</p>
        <p style={{ color: 'rgba(255,255,255,0.25)' }}>Hecho con 💛 en Cieneguilla, Lima</p>
      </div>
    </footer>
  );
}
