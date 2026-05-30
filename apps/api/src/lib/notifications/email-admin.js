// Emails específicos del admin (separados para no inflar email.js)
const { Resend } = require('resend');
const env = require('../env');
const logger = require('../logger');
const T = require('./theme');
const { createLazyClient } = require('../lazyClient');
const { escapeHtml: esc } = require('../html');

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

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="font-family:${T.font.sans};background:${T.color.pageBg};padding:40px 20px;">
  <table align="center" width="600" style="background:${T.color.bodyBg};border-radius:${T.radius.box};padding:32px;">
    <tr><td>
      <h1 style="margin:0 0 16px;font-family:${T.font.serif};font-size:22px;color:${T.color.textStrong};">Restablecer contraseña — Admin Deyanira</h1>
      <p style="font-size:14px;color:${T.color.text};line-height:1.6;">Recibimos una solicitud para restablecer la contraseña de la cuenta administrativa <strong>${esc(email)}</strong>.</p>
      <p style="font-size:14px;color:${T.color.text};line-height:1.6;">El enlace expira en <strong>1 hora</strong> y sólo puede usarse una vez:</p>
      <p style="margin:24px 0;text-align:center;">
        <a href="${esc(safeUrl)}" style="display:inline-block;padding:14px 28px;background:${T.color.primary};color:${T.color.bodyBg};text-decoration:none;border-radius:8px;font-weight:600;">Restablecer contraseña</a>
      </p>
      <p style="font-size:13px;color:${T.color.textMuted};">Si tú no solicitaste esto, ignora este correo — tu contraseña seguirá igual.</p>
      <p style="font-size:11px;color:${T.color.textFaint};margin-top:24px;">IP del solicitante registrada en el log de auditoría.</p>
    </td></tr>
  </table>
</body></html>`;

  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Restablecer contraseña — Admin Deyanira',
      html,
    });
  } catch (err) {
    logger.error('admin_reset_email_failed', { msg: err.message });
  }
}

module.exports = { sendAdminPasswordResetEmail };
