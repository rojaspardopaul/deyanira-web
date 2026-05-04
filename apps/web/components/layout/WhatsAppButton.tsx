import { MessageCircle } from 'lucide-react';

export default function WhatsAppButton() {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '') || '';
  const message = encodeURIComponent('¡Hola! Me gustaría información sobre sus servicios.');
  const href = `https://wa.me/${number}?text=${message}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center
                 w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full
                 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
    >
      <MessageCircle className="w-7 h-7" />
    </a>
  );
}
