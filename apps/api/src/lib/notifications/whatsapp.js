const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '+51XXXXXXXXX';

/**
 * Genera link wa.me para que el CLIENTE notifique al SALÓN su reserva.
 * El cliente abre WhatsApp y envía el mensaje al número del salón.
 */
function appointmentWhatsAppLink({ appointment, name, phone }) {
  const date = new Date(appointment.date).toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const lines = [
    `✅ *Nueva reserva confirmada*`,
    ``,
    `👤 Cliente: ${name}`,
    phone ? `📱 Teléfono: ${phone}` : '',
    `📅 Fecha: ${date}`,
    `🕐 Hora: ${appointment.startTime} – ${appointment.endTime}`,
    `💄 Servicio: ${appointment.service?.name || ''}`,
    appointment.staff?.name ? `✂️ Estilista: ${appointment.staff.name}` : '',
    `💳 Total: S/ ${Number(appointment.totalPen).toFixed(2)}`,
    ``,
    `ID: ${appointment.id.slice(0, 8)}`,
  ].filter(Boolean).join('\n');

  const message = encodeURIComponent(lines);
  return `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${message}`;
}

/**
 * Genera link wa.me genérico de contacto
 */
function contactWhatsAppLink(message = '¡Hola! Quiero más información sobre sus servicios.') {
  return `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}

module.exports = { appointmentWhatsAppLink, contactWhatsAppLink };
