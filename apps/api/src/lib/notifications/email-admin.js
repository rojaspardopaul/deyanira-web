// Emails específicos del admin. Reutiliza el shell oscuro y los helpers de email.js
// para mantener una sola identidad visual (cambiar theme.js afecta también a estos).
const { Resend } = require('resend');
const env = require('../env');
const logger = require('../logger');
const { createLazyClient } = require('../lazyClient');
const { escapeHtml: esc } = require('../html');
const { baseHtml, getEmailSettings, heading, bodyText, ctaBtn, alertBox } = require('./email');

const FROM = env.EMAIL_FROM || 'Deyanira Makeup Beauty <admin@deyaniramakeup.pe>';

const getResend = createLazyClient(() =>
  env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null
);

async function sendAdminPasswordResetEmail({ email, resetUrl }) {
  const resend = getResend();
  if (!resend || !email || !resetUrl) return;

  const safeUrl = (() => {
    try {
      const u = new URL(resetUrl);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
      return resetUrl;
    } catch { return ''; }
  })();
  if (!safeUrl) return;

  const settings = await getEmailSettings();
  const body = `
    ${heading('🔐', 'Restablecer contraseña')}
    ${bodyText(`Recibimos una solicitud para restablecer la contraseña de la cuenta administrativa <strong style="color:#f6ecf0;">${esc(email)}</strong>.`)}
    ${bodyText('El enlace expira en <strong>1 hora</strong> y solo puede usarse una vez:')}
    ${ctaBtn('Restablecer contraseña', safeUrl)}
    ${alertBox('Si tú no solicitaste esto, ignora este correo — tu contraseña seguirá igual. La IP del solicitante quedó registrada en el log de auditoría.', 'warning')}
  `;

  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Restablecer contraseña — Admin Deyanira',
      html: baseHtml('Restablecer contraseña del panel admin', body, settings),
    });
  } catch (err) {
    logger.error('admin_reset_email_failed', { msg: err.message });
  }
}

module.exports = { sendAdminPasswordResetEmail };
