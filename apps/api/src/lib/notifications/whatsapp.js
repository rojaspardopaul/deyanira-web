const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '+51XXXXXXXXX';

/**
 * Genera link wa.me con mensaje pre-armado para confirmación de cita
 */
function appointmentWhatsAppLink({ appointment, name }) {
  const date = new Date(appointment.date).toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const message = encodeURIComponent(
    `Hola, soy ${name}. Acabo de reservar una cita:\n` +
    `📅 ${date} a las ${appointment.startTime}\n` +
    `💄 Servicio: ${appointment.service?.name}\n` +
    `¡Gracias!`
  );
  return `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${message}`;
}

/**
 * Genera link wa.me genérico de contacto
 */
function contactWhatsAppLink(message = '¡Hola! Quiero más información sobre sus servicios.') {
  return `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}

module.exports = { appointmentWhatsAppLink, contactWhatsAppLink };
