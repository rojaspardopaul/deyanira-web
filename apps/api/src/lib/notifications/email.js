const { Resend } = require('resend');

const FROM = process.env.EMAIL_FROM || 'hola@deyanira.pe';
const SALON_NAME = 'Deyanira Makeup Beauty';

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — emails disabled');
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

async function sendAppointmentConfirmation({ appointment, email, name }) {
  const resend = getResend();
  if (!resend) return;
  const date = new Date(appointment.date).toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Cita confirmada — ${SALON_NAME}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #c2185b;">¡Tu cita está reservada! 💄</h2>
        <p>Hola <strong>${name}</strong>, tu cita ha sido registrada exitosamente.</p>
        <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; background:#fce4ec;"><strong>Servicio</strong></td>
              <td style="padding: 8px;">${appointment.service?.name || ''}</td></tr>
          <tr><td style="padding: 8px; background:#fce4ec;"><strong>Fecha</strong></td>
              <td style="padding: 8px;">${date}</td></tr>
          <tr><td style="padding: 8px; background:#fce4ec;"><strong>Hora</strong></td>
              <td style="padding: 8px;">${appointment.startTime} - ${appointment.endTime}</td></tr>
          <tr><td style="padding: 8px; background:#fce4ec;"><strong>Estilista</strong></td>
              <td style="padding: 8px;">${appointment.staff?.name || 'Por asignar'}</td></tr>
          <tr><td style="padding: 8px; background:#fce4ec;"><strong>Total</strong></td>
              <td style="padding: 8px;">S/ ${appointment.totalPen}</td></tr>
        </table>
        <p>Si necesitas cancelar o reagendar, contáctanos con al menos 24 horas de anticipación.</p>
        <p style="color:#888; font-size: 12px;">${SALON_NAME} · Lima, Perú</p>
      </div>
    `,
  });
}

async function sendAppointmentReminder({ appointment, email, name, hoursBefor }) {
  const resend = getResend();
  if (!resend) return;
  const date = new Date(appointment.date).toLocaleDateString('es-PE', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Recordatorio: tu cita es ${hoursBefor === 24 ? 'mañana' : 'en 2 horas'} 💅`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #c2185b;">¡No olvides tu cita! 🌸</h2>
        <p>Hola <strong>${name}</strong>, te recordamos que tienes una cita:</p>
        <p><strong>Servicio:</strong> ${appointment.service?.name}<br/>
           <strong>Fecha:</strong> ${date}<br/>
           <strong>Hora:</strong> ${appointment.startTime}</p>
        <p>¡Te esperamos!</p>
        <p style="color:#888; font-size: 12px;">${SALON_NAME} · Lima, Perú</p>
      </div>
    `,
  });
}

async function sendOrderConfirmation({ order, email }) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Pedido recibido — ${SALON_NAME}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #c2185b;">¡Pedido recibido! 🛍️</h2>
        <p>Tu pedido #${order.id.slice(0, 8)} ha sido registrado.</p>
        <p><strong>Total:</strong> S/ ${order.totalPen}<br/>
           <strong>Envío a:</strong> ${order.shipDistrict}, ${order.shipCity}</p>
        <p>Te notificaremos cuando esté en camino.</p>
        <p style="color:#888; font-size: 12px;">${SALON_NAME} · Lima, Perú</p>
      </div>
    `,
  });
}

module.exports = {
  sendAppointmentConfirmation,
  sendAppointmentReminder,
  sendOrderConfirmation,
};
