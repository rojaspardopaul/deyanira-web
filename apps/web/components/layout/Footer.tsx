import Link from 'next/link';
import { MapPin, Phone, Clock } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 pt-16 pb-8">
      <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-4 gap-10 mb-12">
        {/* Marca */}
        <div className="md:col-span-2">
          <p className="font-display font-bold text-2xl text-white mb-3">
            Deyanira<span className="text-primary-400"> Beauty</span>
          </p>
          <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
            Salón de belleza profesional en Lima, Perú. Maquillaje, cabello,
            uñas y cejas con los mejores productos del mercado.
          </p>
        </div>

        {/* Navegación */}
        <div>
          <h4 className="text-white font-semibold mb-4">Menú</h4>
          <ul className="space-y-2 text-sm">
            {[
              ['Servicios', '/servicios'],
              ['Tienda', '/tienda'],
              ['Galería', '/galeria'],
              ['Nosotros', '/nosotros'],
              ['Contacto', '/contacto'],
              ['Reservar cita', '/reservar'],
            ].map(([label, href]) => (
              <li key={href}>
                <Link href={href} className="hover:text-primary-400 transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contacto */}
        <div>
          <h4 className="text-white font-semibold mb-4">Contacto</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 text-primary-400 shrink-0" />
              <span>Lima, Perú</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary-400 shrink-0" />
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '')}`}
                className="hover:text-primary-400 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Clock className="w-4 h-4 mt-0.5 text-primary-400 shrink-0" />
              <span>Lun–Vie 9:00–19:00<br />Sáb 9:00–17:00</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
        <p>© {new Date().getFullYear()} Deyanira Makeup Beauty. Todos los derechos reservados.</p>
        <div className="flex gap-6">
          <Link href="/politica-de-privacidad" className="hover:text-gray-300 transition-colors">
            Política de privacidad
          </Link>
        </div>
      </div>
    </footer>
  );
}
