'use client';

import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { useSalonSettings } from '@/lib/useSalonSettings';

export default function WhatsAppButton() {
  const pathname = usePathname();
  const settings = useSalonSettings();
  if (pathname.startsWith('/admin')) return null;
  const isHome = pathname === '/';
  // El número viene de Admin → Configuración (settings.whatsapp); la env es solo respaldo.
  const number = (settings?.whatsapp || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  const message = encodeURIComponent('¡Hola! Me gustaría información sobre sus servicios.');
  const href = `https://wa.me/${number}?text=${message}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      /* En móvil: sube por encima del bottom nav. En desktop: esquina estándar */
      className={`
        fixed z-50 right-4 bottom-[5.5rem] md:right-6 md:bottom-6
        flex items-center gap-2
        bg-[#25D366] hover:bg-[#1ebe5d] active:scale-95
        text-white rounded-full
        shadow-lg shadow-green-200 hover:shadow-xl hover:shadow-green-300
        transition-all duration-200
        px-4 py-3 md:w-14 md:h-14 md:px-0 md:justify-center
        select-none
        ${isHome ? '' : 'hidden md:flex'}
      `}
    >
      <MessageCircle className="w-6 h-6 flex-shrink-0" />
      <span className="text-sm font-semibold md:hidden">WhatsApp</span>
    </a>
  );
}
