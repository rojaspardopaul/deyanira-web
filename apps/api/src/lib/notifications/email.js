const { Resend } = require('resend');
const prisma = require('../prisma');
const env = require('../env');
const logger = require('../logger');
const cache = require('../cache');
const T = require('./theme');
const { createLazyClient } = require('../lazyClient');
const { escapeHtml: esc } = require('../html');

const FROM        = env.EMAIL_FROM || 'Deyanira Makeup Beauty <admin@deyaniramakeup.pe>';
const SALON       = 'Deyanira Makeup Beauty';
const SALON_PHONE = (env.SALON_WHATSAPP || env.WHATSAPP_NUMBER || '').replace(/\D/g, '');
const WEB_URL     = env.NEXT_PUBLIC_WEB_URL || env.FRONTEND_URL || 'https://deyanira.pe';

// Ajustes del salón para los correos (logo + datos de contacto + redes).
// Caché compartida (clave 'settings:email') → se invalida cuando el admin guarda.
async function getEmailSettings() {
  return cache.wrap('settings:email', 5 * 60 * 1000, async () => {
    try {
      const s = await prisma.setting.findFirst({
        select: {
          logoDarkUrl: true, logoUrl: true, salonName: true,
          phone: true, whatsapp: true, address: true, district: true, city: true,
          instagramUrl: true, facebookUrl: true, tiktokUrl: true,
        },
      });
      return s || {};
    } catch {
      return {};
    }
  });
}

const getResend = createLazyClient(() => {
  if (!env.RESEND_API_KEY) {
    logger.warn('email_disabled_no_key');
    return null;
  }
  return new Resend(env.RESEND_API_KEY);
});

// True si podemos "enviar" (Resend configurado) o estamos en modo preview (dev).
function canSend() { return Boolean(process.env.EMAIL_PREVIEW_DIR) || Boolean(getResend()); }

// Envío centralizado: un único try/catch + logging para todos los correos.
// Modo preview (solo dev): si EMAIL_PREVIEW_DIR está definido, escribe el HTML a
// disco en vez de enviar — usado por scripts/preview-emails.js para validar diseño.
async function safeSend(type, message) {
  if (process.env.EMAIL_PREVIEW_DIR) {
    try {
      const fs = require('fs'); const path = require('path');
      fs.mkdirSync(process.env.EMAIL_PREVIEW_DIR, { recursive: true });
      fs.writeFileSync(path.join(process.env.EMAIL_PREVIEW_DIR, `${type}.html`), message.html || '');
    } catch (err) { logger.error('email_preview_failed', { type, msg: err.message }); }
    return;
  }
  try {
    await getResend().emails.send({ from: FROM, ...message });
  } catch (err) {
    logger.error('email_send_failed', { type, msg: err.message });
  }
}

// Permitimos sólo URLs HTTP(S) válidas en `src`/`href`.
function safeUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    return esc(value);
  } catch { return ''; }
}

// ── Helpers de formato ─────────────────────────────────────────
// IMPORTANTE: formatea la fecha SIN conversión de TZ (apt.date = UTC midnight @db.Date).
function fmtDate(d) {
  let iso;
  if (typeof d === 'string') iso = d.slice(0, 10);
  else if (d instanceof Date) iso = d.toISOString().slice(0, 10);
  else return '';

  const [y, m, day] = iso.split('-').map(Number);
  if (!y || !m || !day) return '';

  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const weekdays = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return `${weekdays[dow]}, ${day} de ${months[m - 1]} de ${y}`;
}
function fmtShort(d, time) {
  let iso;
  if (typeof d === 'string') iso = d.slice(0, 10);
  else if (d instanceof Date) iso = d.toISOString().slice(0, 10);
  else return time || '';
  const [y, m, day] = iso.split('-').map(Number);
  if (!y || !m || !day) return time || '';
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const weekdays = ['dom','lun','mar','mié','jue','vie','sáb'];
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return `${weekdays[dow]} ${day} ${months[m - 1]}${time ? ` · ${time}` : ''}`;
}
function fmtPrice(n) { return `S/ ${Number(n).toFixed(2)}`; }
function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

// ── Footer con redes sociales ──────────────────────────────────
// Íconos PNG hospedados (Gmail/Outlook eliminan SVG inline) en /public/email/.
function socialIcon(slug, url) {
  const u = safeUrl(url);
  if (!u) return '';
  return `<a href="${u}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;margin:0 5px;">`
    + `<img src="${WEB_URL}/email/${slug}.png" width="34" height="34" alt="${esc(slug)}" style="display:inline-block;width:34px;height:34px;border:0;outline:none;text-decoration:none;"></a>`;
}

function socialFooter(settings) {
  const s = settings || {};
  const year = new Date().getFullYear();
  const salonName = s.salonName || SALON;
  // Íconos sociales (PNG hospedados en /public/email/). WhatsApp se ofrece como
  // botón de contacto en el cuerpo, no como ícono (no hay asset coherente).
  const icons = [
    socialIcon('instagram', s.instagramUrl),
    socialIcon('facebook',  s.facebookUrl),
    socialIcon('tiktok',    s.tiktokUrl),
  ].filter(Boolean).join('');
  const addr = [s.address, s.district, s.city || 'Lima, Perú'].filter(Boolean).join(' · ');
  const phoneLine = (s.phone || s.whatsapp) ? `<br>${esc(s.phone || s.whatsapp)}` : '';

  return `
    <td bgcolor="${T.color.footerBg}" class="email-footer" style="background:${T.color.footerBg};padding:26px 32px;text-align:center;border-top:2px solid ${T.color.gold};border-radius:0 0 ${T.radius.card} ${T.radius.card};">
      ${icons ? `<div style="margin:0 0 16px;font-size:0;">${icons}</div>` : ''}
      <p style="margin:0 0 10px;font-family:${T.font.sans};font-size:12px;color:${T.color.textFaint};line-height:1.5;">${esc(addr)}${phoneLine}</p>
      <p style="margin:0 0 10px;font-family:${T.font.sans};font-size:12px;color:${T.color.textFaint};">
        <a href="${WEB_URL}/reservar" style="color:${T.color.textMuted};text-decoration:none;margin:0 7px;">Reservar</a>·<a href="${WEB_URL}/servicios" style="color:${T.color.textMuted};text-decoration:none;margin:0 7px;">Servicios</a>·<a href="${WEB_URL}/mi-cuenta" style="color:${T.color.textMuted};text-decoration:none;margin:0 7px;">Mi cuenta</a>
      </p>
      <p style="margin:6px 0 0;font-family:${T.font.sans};font-size:10.5px;color:${T.color.textFainter};line-height:1.5;">© ${year} ${esc(salonName)} · Recibes este correo por tu reserva.</p>
    </td>`;
}

// ── Template base (shell OSCURO) ───────────────────────────────
function baseHtml(previewText, body, settings) {
  const s = settings || {};
  const safeLogo = safeUrl(s.logoDarkUrl);
  const headerContent = safeLogo
    ? `<img src="${safeLogo}" alt="${esc(SALON)}" width="190" style="display:block;margin:0 auto;max-height:64px;max-width:210px;object-fit:contain;border:0;" />`
    : `<p style="margin:0;font-family:${T.font.serif};font-size:30px;font-weight:bold;letter-spacing:6px;color:${T.color.gold};line-height:1;">DEYANIRA</p>
        <p style="margin:6px 0 0;font-family:${T.font.sans};font-size:9px;letter-spacing:7px;color:rgba(212,175,55,0.5);text-transform:uppercase;">Makeup Beauty</p>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${esc(previewText)}</title>
  <style>
    @media only screen and (max-width:600px) {
      .email-card { width:100% !important; border-radius:14px !important; }
      .email-body { padding:26px 18px 22px !important; }
      .email-header { padding:26px 18px 18px !important; }
      .email-footer { padding:22px 18px !important; }
      .btn-block { display:block !important; width:100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${T.color.pageBg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(previewText)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.color.pageBg}" style="background:${T.color.pageBg};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" class="email-card" width="600" cellpadding="0" cellspacing="0" border="0"
         style="max-width:600px;width:100%;border-radius:${T.radius.card};overflow:hidden;box-shadow:0 12px 40px rgba(20,5,15,0.28);">
    <tr><td style="height:5px;line-height:5px;font-size:0;background:${T.topbarSolid};background:${T.topbar};">&nbsp;</td></tr>
    <tr>
      <td bgcolor="${T.color.cardBg}" class="email-header" style="background:${T.color.cardBg};padding:30px 32px 18px;text-align:center;">
        ${headerContent}
      </td>
    </tr>
    <tr>
      <td bgcolor="${T.color.cardBg}" class="email-body" style="background:${T.color.cardBg};padding:14px 32px 30px;">
        ${body}
      </td>
    </tr>
    <tr>${socialFooter(s)}</tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Bloques reutilizables (escapan el texto del usuario) ──────
function heading(emoji, text, colorHex) {
  const c = colorHex || T.color.white;
  return `<p style="margin:6px 0 4px;font-family:${T.font.sans};font-size:26px;line-height:1.1;text-align:center;">${esc(emoji)}</p>
<h1 style="margin:0 0 16px;font-family:${T.font.serif};font-size:23px;font-weight:bold;color:${esc(c)};line-height:1.3;text-align:center;">${esc(text)}</h1>`;
}

function greeting(name) {
  return `<p style="margin:0 0 18px;font-family:${T.font.sans};font-size:15px;color:${T.color.cream};line-height:1.6;text-align:center;">Hola <strong>${esc(capFirst(name))}</strong>,</p>`;
}

function bodyText(text) {
  return `<p style="margin:0 0 16px;font-family:${T.font.sans};font-size:14px;color:${T.color.textMuted};line-height:1.7;text-align:center;">${text}</p>`;
}
function bodyTextEsc(text) { return bodyText(esc(text)); }

// Panel de detalles (filas etiqueta/valor) sobre fondo oscuro.
function infoTable(rows) {
  const cells = rows.map(([label, value], i) => {
    const safeValue = (value && typeof value === 'object' && 'html' in value)
      ? value.html
      : esc(value ?? '');
    const isLast = i === rows.length - 1;
    return `<tr>
      <td style="padding:12px 16px;font-family:${T.font.sans};font-size:13px;font-weight:600;color:${T.color.textFaint};width:40%;${isLast ? '' : `border-bottom:1px solid ${T.color.rowLine};`}">${esc(label)}</td>
      <td style="padding:12px 16px;font-family:${T.font.sans};font-size:13px;color:${T.color.cream};text-align:right;${isLast ? '' : `border-bottom:1px solid ${T.color.rowLine};`}">${safeValue}</td>
    </tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.color.panelBg}"
    style="background:${T.color.panelBg};border:1px solid ${T.color.panelLine};border-radius:${T.radius.box};overflow:hidden;margin:8px 0 22px;">
    ${cells}
  </table>`;
}

function ctaBtn(text, url) {
  const safeURL = safeUrl(url);
  if (!safeURL) return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto;">
    <tr>
      <td style="border-radius:${T.radius.pill};background:${T.color.primary};" bgcolor="${T.color.primary}">
        <a href="${safeURL}" target="_blank" rel="noopener noreferrer" class="btn-block" style="display:inline-block;padding:14px 34px;font-family:${T.font.sans};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:${T.radius.pill};letter-spacing:0.3px;">${esc(text)}</a>
      </td>
    </tr>
  </table>`;
}

// Botón secundario (contorno dorado).
function ctaBtnGhost(text, url) {
  const safeURL = safeUrl(url);
  if (!safeURL) return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto;">
    <tr>
      <td style="border-radius:${T.radius.pill};border:1.5px solid rgba(212,175,55,0.6);">
        <a href="${safeURL}" target="_blank" rel="noopener noreferrer" class="btn-block" style="display:inline-block;padding:12px 30px;font-family:${T.font.sans};font-size:14px;font-weight:700;color:${T.color.gold};text-decoration:none;border-radius:${T.radius.pill};letter-spacing:0.3px;">${esc(text)}</a>
      </td>
    </tr>
  </table>`;
}

function goldDivider() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
    <tr><td style="border-top:1px solid ${T.color.rowLine};font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>`;
}

// Caja de alerta con paleta de estado (success/warning/info/error/gold_/purple).
function alertBox(text, status = 'info') {
  const c = T.color[status] || T.color.info;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
    <tr>
      <td style="background:${c.bg};border:1px solid ${c.bd};border-radius:${T.radius.box};padding:14px 18px;font-family:${T.font.sans};font-size:13px;color:${c.fg};line-height:1.6;text-align:center;">${text}</td>
    </tr>
  </table>`;
}
function alertBoxText(text, status = 'info') { return alertBox(esc(text), status); }

// ── Stepper de estados (línea principal de 3 pasos) ───────────
// current ∈ 'requested' | 'confirmed' | 'completed'. Table-based (Gmail/Outlook).
function statusStepper(current) {
  const steps = [
    { key: 'requested', label: 'Solicitada' },
    { key: 'confirmed', label: 'Confirmada' },
    { key: 'completed', label: 'Atendida' },
  ];
  const idx = steps.findIndex(s => s.key === current);
  const ci = idx < 0 ? 0 : idx;

  const badge = (i) => {
    const st = i < ci ? 'done' : (i === ci ? 'active' : 'todo');
    const c = T.stepper[st];
    const content = st === 'todo' ? String(i + 1) : '✓';
    const border = st === 'todo' ? `border:2px solid ${T.stepper.todo.border};` : 'border:2px solid transparent;';
    const ring = st === 'active' ? 'box-shadow:0 0 0 4px rgba(219,39,119,0.22);' : '';
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>`
      + `<td width="44" height="44" align="center" valign="middle" style="width:44px;height:44px;background:${c.bg};border-radius:50%;${border}${ring}font-family:${T.font.sans};font-size:16px;font-weight:700;color:${c.fg};">${content}</td>`
      + `</tr></table>`;
  };
  const seg = (i) => {
    const done = i < ci;
    return `<td valign="middle" style="padding:0 2px;"><div style="height:3px;border-radius:3px;background:${done ? T.color.gold : 'rgba(212,175,55,0.28)'};line-height:3px;font-size:0;">&nbsp;</div></td>`;
  };
  const labelCell = (i) => {
    const st = i < ci ? 'done' : (i === ci ? 'active' : 'todo');
    const col = st === 'todo' ? T.stepper.todo.fg : T.color.cream;
    const sub = st === 'active'
      ? `<div style="font-size:10px;font-weight:600;color:${T.color.primaryGlow};margin-top:3px;">¡Aquí estás!</div>`
      : '';
    return `<td width="78" align="center" style="padding-top:9px;font-family:${T.font.sans};font-size:11px;font-weight:700;color:${col};">${esc(steps[i].label)}${sub}</td>`;
  };

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px;">
    <tr>
      <td width="78" align="center" valign="top">${badge(0)}</td>${seg(0)}
      <td width="78" align="center" valign="top">${badge(1)}</td>${seg(1)}
      <td width="78" align="center" valign="top">${badge(2)}</td>
    </tr>
    <tr>${labelCell(0)}<td></td>${labelCell(1)}<td></td>${labelCell(2)}</tr>
  </table>`;
}

// Banner para estados secundarios (sin stepper). kind ∈ banner keys.
function statusBanner(kind, title, text, extraHtml = '') {
  const c = T.banner[kind] || T.banner.info;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px;">
    <tr>
      <td style="background:${c.bg};border:1px solid ${c.bd};border-radius:${T.radius.box};padding:18px 20px;text-align:center;">
        <p style="margin:0 0 4px;font-family:${T.font.serif};font-size:17px;font-weight:bold;color:${c.fg};line-height:1.3;">${title}</p>
        <p style="margin:0;font-family:${T.font.sans};font-size:13px;color:${T.color.textMuted};line-height:1.55;">${text}</p>
        ${extraHtml}
      </td>
    </tr>
  </table>`;
}

// Chips "antes → ahora" para reprogramaciones.
function rescheduleChips(beforeLabel, afterLabel) {
  const chip = (cap, val) => `<td align="center" style="background:${T.color.panelBg};border:1px solid ${T.color.panelLine};border-radius:12px;padding:10px 16px;font-family:${T.font.sans};font-size:11px;color:${T.color.textMuted};">${esc(cap)}<div style="color:${T.color.cream};font-size:14px;font-weight:700;margin-top:3px;">${esc(val)}</div></td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:14px auto 2px;"><tr>
    ${chip('Antes', beforeLabel)}
    <td style="padding:0 10px;color:${T.color.gold};font-size:20px;">→</td>
    ${chip('Ahora', afterLabel)}
  </tr></table>`;
}

// ── Resumen de cita ────────────────────────────────────────────
function aptSummary(apt) {
  const date = fmtDate(apt.date);
  const isOnDuty = apt.onDutyStaff || !apt.staff;
  const staffCell = isOnDuty
    ? { html: `<span style="color:${T.color.gold};font-weight:600;">✦ Estilista de turno (por asignar)</span>` }
    : (apt.staff?.name || '—');
  const rows = [
    ['Servicio',  apt.service?.name || '—'],
    ['Estilista', staffCell],
    ['Fecha',     capFirst(date)],
    ['Hora',      `${apt.startTime} – ${apt.endTime}`],
    ['Total',     { html: `<strong style="color:${T.color.gold};font-size:15px;">${esc(fmtPrice(apt.totalPen))}</strong>` }],
  ];
  if (apt.atHome && apt.atHomeAddress) {
    rows.splice(4, 0, ['Dirección', `${apt.atHomeAddress}, ${apt.atHomeDistrict || ''}`]);
    rows.splice(5, 0, ['Recargo movilidad', fmtPrice(apt.atHomeExtraPen || 0)]);
  }
  return infoTable(rows);
}

function orderSummary(order) {
  const items = (order.items || []).map(i =>
    `<tr>
      <td style="padding:9px 16px;font-family:${T.font.sans};font-size:13px;color:${T.color.cream};border-bottom:1px solid ${T.color.rowLine};">${esc(i.name)} × ${esc(i.qty)}</td>
      <td style="padding:9px 16px;font-family:${T.font.sans};font-size:13px;color:${T.color.cream};text-align:right;border-bottom:1px solid ${T.color.rowLine};">${esc(fmtPrice(Number(i.pricePen) * i.qty))}</td>
    </tr>`
  ).join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.color.panelBg}"
    style="background:${T.color.panelBg};border:1px solid ${T.color.panelLine};border-radius:${T.radius.box};overflow:hidden;margin:8px 0 20px;">
    <tr bgcolor="${T.color.headerInk}">
      <td style="padding:10px 16px;font-family:${T.font.sans};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${T.color.textFaint};background:${T.color.headerInk};">Producto</td>
      <td style="padding:10px 16px;font-family:${T.font.sans};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${T.color.textFaint};text-align:right;background:${T.color.headerInk};">Precio</td>
    </tr>
    ${items}
    <tr>
      <td style="padding:9px 16px;font-family:${T.font.sans};font-size:13px;color:${T.color.textFaint};">Subtotal</td>
      <td style="padding:9px 16px;font-family:${T.font.sans};font-size:13px;color:${T.color.cream};text-align:right;">${esc(fmtPrice(order.subtotalPen))}</td>
    </tr>
    ${Number(order.shippingPen) > 0 ? `<tr>
      <td style="padding:8px 16px;font-family:${T.font.sans};font-size:13px;color:${T.color.textFaint};">Envío</td>
      <td style="padding:8px 16px;font-family:${T.font.sans};font-size:13px;color:${T.color.cream};text-align:right;">${esc(fmtPrice(order.shippingPen))}</td>
    </tr>` : ''}
    ${Number(order.discountPen) > 0 ? `<tr>
      <td style="padding:8px 16px;font-family:${T.font.sans};font-size:13px;color:${T.color.positive};">Descuento</td>
      <td style="padding:8px 16px;font-family:${T.font.sans};font-size:13px;color:${T.color.positive};text-align:right;">-${esc(fmtPrice(order.discountPen))}</td>
    </tr>` : ''}
    <tr style="background:rgba(212,175,55,0.10);">
      <td style="padding:13px 16px;font-family:${T.font.sans};font-size:15px;font-weight:700;color:${T.color.cream};background:rgba(212,175,55,0.10);">Total</td>
      <td style="padding:13px 16px;font-family:${T.font.sans};font-size:15px;font-weight:700;color:${T.color.gold};text-align:right;background:rgba(212,175,55,0.10);">${esc(fmtPrice(order.totalPen))}</td>
    </tr>
  </table>`;
}

// ── Tabla resumen de reservas múltiples (paquete + extras) ────
function bookingSummaryTable({ packageInfo, appointments, atHomeExtraPen }) {
  const rows = appointments.map((apt) => {
    const isOnDuty = apt.onDutyStaff || !apt.staff;
    const staffName = isOnDuty ? 'Estilista de turno' : (apt.staff?.name || '—');
    return `<tr>
      <td style="padding:11px 16px;font-family:${T.font.sans};font-size:13px;color:${T.color.cream};border-bottom:1px solid ${T.color.rowLine};">
        <strong>${esc(apt.service?.name || '—')}</strong>
        <div style="font-size:11px;color:${T.color.textFaint};margin-top:2px;">${esc(apt.startTime)} – ${esc(apt.endTime)} · ${esc(staffName)}</div>
      </td>
      <td style="padding:11px 16px;font-family:${T.font.sans};font-size:13px;color:${T.color.cream};text-align:right;border-bottom:1px solid ${T.color.rowLine};white-space:nowrap;">
        ${apt.totalPen != null ? esc(fmtPrice(apt.totalPen)) : ''}
      </td>
    </tr>`;
  }).join('');

  const total = appointments.reduce((sum, apt) => sum + Number(apt.totalPen || 0), 0)
    + Number(atHomeExtraPen || 0);

  const packageRow = packageInfo
    ? `<tr style="background:rgba(212,175,55,0.10);">
        <td colspan="2" style="padding:12px 16px;font-family:${T.font.sans};font-size:13px;color:${T.color.gold};background:rgba(212,175,55,0.10);">
          <strong>📦 Paquete: ${esc(packageInfo.name)}</strong>
          ${packageInfo.eventType ? ` <span style="color:${T.color.textMuted};">— ${esc(packageInfo.eventType.name)}</span>` : ''}
          ${packageInfo.groupLabel ? `<div style="font-size:11px;margin-top:2px;color:${T.color.textMuted};">${esc(packageInfo.groupLabel)}</div>` : ''}
        </td>
       </tr>`
    : '';

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.color.panelBg}"
    style="background:${T.color.panelBg};border:1px solid ${T.color.panelLine};border-radius:${T.radius.box};overflow:hidden;margin:8px 0 20px;">
    ${packageRow}
    <tr bgcolor="${T.color.headerInk}">
      <td style="padding:10px 16px;font-family:${T.font.sans};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${T.color.textFaint};background:${T.color.headerInk};">Servicio</td>
      <td style="padding:10px 16px;font-family:${T.font.sans};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${T.color.textFaint};text-align:right;background:${T.color.headerInk};">Subtotal</td>
    </tr>
    ${rows}
    ${atHomeExtraPen > 0 ? `<tr>
      <td style="padding:8px 16px;font-family:${T.font.sans};font-size:13px;color:${T.color.textFaint};">Servicio a domicilio</td>
      <td style="padding:8px 16px;font-family:${T.font.sans};font-size:13px;color:${T.color.cream};text-align:right;">${esc(fmtPrice(atHomeExtraPen))}</td>
    </tr>` : ''}
    <tr style="background:rgba(212,175,55,0.10);">
      <td style="padding:14px 16px;font-family:${T.font.sans};font-size:15px;font-weight:700;color:${T.color.cream};background:rgba(212,175,55,0.10);">Total</td>
      <td style="padding:14px 16px;font-family:${T.font.sans};font-size:15px;font-weight:700;color:${T.color.gold};text-align:right;background:rgba(212,175,55,0.10);">${esc(fmtPrice(total))}</td>
    </tr>
  </table>`;
}

// Bloque de ayuda/contacto reutilizable al pie del cuerpo.
function helpBlock() {
  const wa = SALON_PHONE ? `<a href="https://wa.me/${SALON_PHONE}" style="color:${T.color.gold};text-decoration:none;">WhatsApp</a>` : 'WhatsApp';
  return `<p style="margin:18px 0 0;font-family:${T.font.sans};font-size:12.5px;color:${T.color.textFaint};line-height:1.6;text-align:center;">¿Dudas o necesitas reprogramar? Escríbenos por ${wa} o responde a este correo.</p>`;
}

// ════════════════════════════════════════════════════════════
//  CITAS — línea principal (con stepper)
// ════════════════════════════════════════════════════════════

// Paso 1 (Solicitada): acuse de recibo. El admin revisará y confirmará.
async function sendAppointmentRequested({ appointment, email, name }) {
  if (!canSend() || !email) return;
  const settings = await getEmailSettings();
  const isAtHome = appointment.atHome;
  const body = `
    ${statusStepper('requested')}
    ${heading('📩', 'Recibimos tu solicitud')}
    ${greeting(name)}
    ${bodyText('Tu reserva fue recibida y está <strong style="color:#f6ecf0;">en revisión</strong>. El salón la confirmará muy pronto y te avisaremos por este medio.')}
    ${aptSummary(appointment)}
    ${isAtHome ? alertBox('🏠 <strong>Servicio a domicilio</strong> — Te contactaremos para coordinar el horario exacto de llegada.', 'info') : ''}
    ${goldDivider()}
    ${ctaBtn('Ver mi reserva', `${WEB_URL}/mi-cuenta/citas`)}
    ${helpBlock()}
  `;
  await safeSend('apt_requested', {
    to: email,
    subject: `Recibimos tu solicitud de cita — ${SALON}`,
    html: baseHtml(`Solicitud recibida para ${capFirst(fmtDate(appointment.date))}`, body, settings),
  });
}

// Paso 1 (Solicitada) — versión múltiple/paquete.
async function sendBookingRequested({ appointments, packageInfo, email, name, atHomeExtraPen }) {
  if (!canSend() || !email || !appointments?.length) return;
  const settings = await getEmailSettings();
  const first = appointments[0];
  const isAtHome = appointments.some(a => a.atHome);
  const body = `
    ${statusStepper('requested')}
    ${heading('📩', packageInfo ? `Solicitud del paquete "${packageInfo.name}"` : 'Recibimos tu solicitud')}
    ${greeting(name)}
    ${bodyText(`Recibimos ${appointments.length === 1 ? 'tu reserva' : `tus ${appointments.length} reservas`} para el <strong style="color:#f6ecf0;">${esc(capFirst(fmtDate(first.date)))}</strong>. El salón la revisará y confirmará pronto.`)}
    ${bookingSummaryTable({ packageInfo, appointments, atHomeExtraPen })}
    ${isAtHome ? alertBox('🏠 <strong>Servicio a domicilio</strong> — Te contactaremos para coordinar el horario exacto.', 'info') : ''}
    ${goldDivider()}
    ${ctaBtn('Ver mi reserva', `${WEB_URL}/mi-cuenta/citas`)}
    ${helpBlock()}
  `;
  await safeSend('booking_requested', {
    to: email,
    subject: packageInfo ? `Solicitud del paquete ${packageInfo.name} — ${SALON}` : `Recibimos tu solicitud de cita — ${SALON}`,
    html: baseHtml(`Solicitud recibida para ${capFirst(fmtDate(first.date))}`, body, settings),
  });
}

// Paso 2 (Confirmada).
async function sendAppointmentConfirmation({ appointment, email, name }) {
  if (!canSend() || !email) return;
  const settings = await getEmailSettings();
  const isAtHome = appointment.atHome;
  const isOnDuty = appointment.onDutyStaff || !appointment.staff;
  const body = `
    ${statusStepper('confirmed')}
    ${heading(isAtHome ? '🏠' : '💄', isAtHome ? '¡Tu cita a domicilio está confirmada!' : '¡Tu cita está confirmada!')}
    ${greeting(name)}
    ${bodyText('Tu espacio está asegurado. Te esperamos. Aquí están los detalles:')}
    ${aptSummary(appointment)}
    ${isOnDuty ? alertBox('✦ <strong>Estilista de turno:</strong> El salón asignará a la especialista disponible y te confirmará quién te atenderá.', 'gold_') : ''}
    ${isAtHome
      ? alertBox('📍 <strong>Servicio a domicilio</strong> — Nos moveremos hasta tu dirección. Te contactaremos para confirmar el horario exacto.', 'info')
      : alertBox('📍 <strong>Te esperamos en el salón</strong> — Llega 5 minutos antes de tu cita.', 'success')
    }
    ${goldDivider()}
    ${ctaBtn('Ver mi cita', `${WEB_URL}/mi-cuenta/citas`)}
    ${SALON_PHONE ? ctaBtnGhost('Ayuda por WhatsApp', `https://wa.me/${SALON_PHONE}`) : ''}
    ${helpBlock()}
  `;
  await safeSend('apt_confirm', {
    to: email,
    subject: `¡Cita ${isAtHome ? 'a domicilio ' : ''}confirmada! — ${SALON}`,
    html: baseHtml(`Cita confirmada para ${capFirst(fmtDate(appointment.date))}`, body, settings),
  });
}

// Email único cuando se confirma un paquete y/o varios servicios.
async function sendBookingConfirmation({ appointments, packageInfo, email, name, atHomeExtraPen }) {
  if (!canSend() || !email || !appointments?.length) return;
  const settings = await getEmailSettings();
  const first = appointments[0];
  const hasOnDuty = appointments.some(a => a.onDutyStaff || !a.staff);
  const isAtHome = appointments.some(a => a.atHome);
  const title = packageInfo
    ? `¡Tu paquete "${packageInfo.name}" está confirmado!`
    : appointments.length > 1 ? '¡Tus citas están confirmadas!' : '¡Tu cita está confirmada!';
  const body = `
    ${statusStepper('confirmed')}
    ${heading(packageInfo ? '🎉' : (isAtHome ? '🏠' : '💄'), title)}
    ${greeting(name)}
    ${bodyText(`Confirmamos ${appointments.length === 1 ? 'tu reserva' : `tus ${appointments.length} reservas`} para el <strong style="color:#f6ecf0;">${esc(capFirst(fmtDate(first.date)))}</strong>.`)}
    ${bookingSummaryTable({ packageInfo, appointments, atHomeExtraPen })}
    ${hasOnDuty ? alertBox('✦ <strong>Estilistas de turno:</strong> Algunas reservas tienen estilista por asignar. Te confirmamos quién te atenderá.', 'gold_') : ''}
    ${isAtHome
      ? alertBox('📍 <strong>Servicio a domicilio</strong> — Nos moveremos hasta tu dirección.', 'info')
      : alertBox('📍 <strong>Te esperamos en el salón</strong> — Llega 5 minutos antes de tu primera cita.', 'success')
    }
    ${goldDivider()}
    ${ctaBtn('Ver mis citas', `${WEB_URL}/mi-cuenta/citas`)}
    ${SALON_PHONE ? ctaBtnGhost('Ayuda por WhatsApp', `https://wa.me/${SALON_PHONE}`) : ''}
    ${helpBlock()}
  `;
  await safeSend('booking_confirm', {
    to: email,
    subject: packageInfo
      ? `¡Paquete ${packageInfo.name} confirmado! — ${SALON}`
      : `${appointments.length > 1 ? `${appointments.length} citas` : 'Cita'} confirmada${appointments.length > 1 ? 's' : ''} — ${SALON}`,
    html: baseHtml(`Reserva confirmada para ${capFirst(fmtDate(first.date))}`, body, settings),
  });
}

// Paso 3 (Atendida).
async function sendAppointmentCompleted({ appointment, email, name }) {
  if (!canSend() || !email) return;
  const settings = await getEmailSettings();
  const waReview = SALON_PHONE
    ? `https://wa.me/${SALON_PHONE}?text=${encodeURIComponent('Hola! Quiero dejar una reseña sobre mi experiencia.')}`
    : '';
  const body = `
    ${statusStepper('completed')}
    ${heading('⭐', '¡Gracias por elegirnos!', T.color.gold)}
    ${greeting(name)}
    ${bodyText('Fue un placer atenderte. Esperamos que hayas quedado encantada con los resultados.')}
    ${aptSummary(appointment)}
    ${goldDivider()}
    <p style="margin:0 0 12px;font-family:${T.font.serif};font-size:16px;font-weight:bold;color:${T.color.cream};text-align:center;">¿Cómo fue tu experiencia?</p>
    ${bodyText('Tu opinión nos ayuda a seguir mejorando.')}
    ${waReview ? ctaBtn('Dejar reseña por WhatsApp', waReview) : ''}
    ${ctaBtnGhost('Reservar próxima cita', `${WEB_URL}/reservar`)}
  `;
  await safeSend('apt_completed', {
    to: email,
    subject: `¡Gracias por tu visita! — ${SALON}`,
    html: baseHtml('Gracias por elegirnos hoy', body, settings),
  });
}

// ════════════════════════════════════════════════════════════
//  CITAS — estados secundarios (banner, sin stepper)
// ════════════════════════════════════════════════════════════

async function sendAppointmentCancelled({ appointment, email, name, reason }) {
  if (!canSend() || !email) return;
  const settings = await getEmailSettings();
  const body = `
    ${statusBanner('danger', '❌ Tu cita fue cancelada', 'Lamentamos informarte que tu cita ha sido cancelada. Si fue un error, contáctanos.')}
    ${greeting(name)}
    ${bodyText('Estos eran los datos de la cita:')}
    ${aptSummary(appointment)}
    ${reason ? alertBox(`<strong>Motivo:</strong> ${esc(reason)}`, 'error') : ''}
    ${goldDivider()}
    ${bodyText('Si deseas reagendar, con gusto te atendemos.')}
    ${ctaBtn('Reservar nueva cita', `${WEB_URL}/reservar`)}
    ${SALON_PHONE ? ctaBtnGhost('Escríbenos por WhatsApp', `https://wa.me/${SALON_PHONE}`) : ''}
  `;
  await safeSend('apt_cancelled', {
    to: email,
    subject: `Cita cancelada — ${SALON}`,
    html: baseHtml('Tu cita fue cancelada', body, settings),
  });
}

// Reprogramación (cambio de fecha/hora). beforeDate/beforeStart = valores previos.
async function sendAppointmentRescheduled({ appointment, email, name, beforeDate, beforeStart }) {
  if (!canSend() || !email) return;
  const settings = await getEmailSettings();
  const beforeLabel = fmtShort(beforeDate, beforeStart);
  const afterLabel = fmtShort(appointment.date, appointment.startTime);
  const body = `
    ${statusBanner('gold', '🗓️ Tu cita fue reprogramada', 'Acordamos una nueva fecha y hora para tu cita. Si no la solicitaste, contáctanos.', rescheduleChips(beforeLabel, afterLabel))}
    ${greeting(name)}
    ${bodyText('Estos son los datos actualizados de tu cita:')}
    ${aptSummary(appointment)}
    ${goldDivider()}
    ${ctaBtn('Ver mi cita', `${WEB_URL}/mi-cuenta/citas`)}
    ${SALON_PHONE ? ctaBtnGhost('Confirmar por WhatsApp', `https://wa.me/${SALON_PHONE}`) : ''}
    ${helpBlock()}
  `;
  await safeSend('apt_rescheduled', {
    to: email,
    subject: `Tu cita fue reprogramada — ${SALON}`,
    html: baseHtml(`Cita reprogramada a ${capFirst(fmtDate(appointment.date))}`, body, settings),
  });
}

// No asistió.
async function sendAppointmentNoShow({ appointment, email, name }) {
  if (!canSend() || !email) return;
  const settings = await getEmailSettings();
  const body = `
    ${statusBanner('warning', '⚠️ No registramos tu asistencia', 'No pudimos atenderte en el horario reservado. Si ocurrió algo, escríbenos — estaremos encantadas de reagendar.')}
    ${greeting(name)}
    ${aptSummary(appointment)}
    ${goldDivider()}
    ${ctaBtn('Reservar nueva cita', `${WEB_URL}/reservar`)}
    ${SALON_PHONE ? ctaBtnGhost('Escríbenos por WhatsApp', `https://wa.me/${SALON_PHONE}`) : ''}
  `;
  await safeSend('apt_no_show', {
    to: email,
    subject: `Sobre tu cita — ${SALON}`,
    html: baseHtml('No registramos tu asistencia', body, settings),
  });
}

// En curso (informativo).
async function sendAppointmentInProgress({ appointment, email, name }) {
  if (!canSend() || !email) return;
  const settings = await getEmailSettings();
  const body = `
    ${statusBanner('success', '✨ Tu cita está en curso', 'Estamos atendiéndote en este momento. ¡Disfruta tu experiencia!')}
    ${greeting(name)}
    ${aptSummary(appointment)}
    ${helpBlock()}
  `;
  await safeSend('apt_in_progress', {
    to: email,
    subject: `Tu cita está en curso — ${SALON}`,
    html: baseHtml('Tu cita está en curso', body, settings),
  });
}

async function sendAppointmentReminder({ appointment, email, name, hoursBefore }) {
  if (!canSend() || !email) return;
  const settings = await getEmailSettings();
  const when = hoursBefore >= 24 ? 'mañana' : 'en 2 horas';
  const isAtHome = appointment.atHome;
  const body = `
    ${heading('⏰', `Recuerda: tu cita es ${when}`)}
    ${greeting(name)}
    ${bodyText(`Solo pasamos a recordarte que tienes una cita <strong style="color:#f6ecf0;">${esc(when)}</strong>:`)}
    ${aptSummary(appointment)}
    ${isAtHome
      ? alertBox('🏠 <strong>Servicio a domicilio</strong> — Iremos a tu dirección. Si necesitas cambiar algo, escríbenos pronto.', 'info')
      : alertBox('✨ <strong>Llega 5 minutos antes</strong> para tu comodidad. ¡Nos vemos!', 'gold_')
    }
    ${ctaBtn('Ver mi cita', `${WEB_URL}/mi-cuenta/citas`)}
    ${helpBlock()}
  `;
  await safeSend('apt_reminder', {
    to: email,
    subject: `Tu cita es ${when} — ${SALON}`,
    html: baseHtml(`Recordatorio: cita el ${capFirst(fmtDate(appointment.date))} a las ${appointment.startTime}`, body, settings),
  });
}

// ── Notificación interna al salón (nueva solicitud) ───────────
async function sendNewBookingToSalon({ appointment }) {
  const adminEmail = env.SALON_ADMIN_EMAIL;
  if (!canSend() || !adminEmail) return;
  const settings = await getEmailSettings();

  const apt         = appointment;
  const clientName  = apt.customer?.name  || apt.guestName  || 'Cliente sin nombre';
  const clientPhone = apt.customer?.phone || apt.guestPhone || '';
  const clientEmail = apt.customer?.email || apt.guestEmail || '—';
  const shortId     = apt.id.slice(0, 8).toUpperCase();
  const adminUrl    = `${WEB_URL}/admin/citas`;
  const waClient    = clientPhone
    ? `https://wa.me/${String(clientPhone).replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${clientName}, te escribimos de ${SALON} sobre tu reserva.`)}`
    : '';

  const isOnDuty   = apt.onDutyStaff || !apt.staff;
  const staffLabel = isOnDuty ? 'Por asignar (turno)' : (apt.staff?.name || '—');

  const rows = [
    ['Cliente',   clientName],
    ['Teléfono',  clientPhone || '—'],
    ['Email',     clientEmail],
    ['Servicio',  apt.service?.name || '—'],
    ['Estilista', staffLabel],
    ['Fecha',     capFirst(fmtDate(apt.date))],
    ['Hora',      `${apt.startTime} – ${apt.endTime}`],
    ['Total',     { html: `<strong style="color:${T.color.gold};">${esc(fmtPrice(apt.totalPen))}</strong>` }],
  ];
  if (apt.atHome && apt.atHomeAddress) {
    rows.push(['Tipo', 'Servicio a domicilio']);
    rows.push(['Dirección', `${apt.atHomeAddress}, ${apt.atHomeDistrict || ''}`]);
  }
  if (apt.notes) rows.push(['Notas', apt.notes]);

  const body = `
    ${heading('📅', 'Nueva solicitud de reserva', T.color.gold)}
    ${bodyText(`Hay una nueva cita <strong style="color:#f6ecf0;">por confirmar</strong>. Ref: <strong>#${esc(shortId)}</strong>`)}
    ${infoTable(rows)}
    ${isOnDuty ? alertBox('<strong>Requiere asignación de estilista</strong> (cita de turno). Asigna desde el panel.', 'warning') : ''}
    ${apt.atHome ? alertBox('<strong>Servicio a domicilio</strong> — Coordinar horario de llegada con el cliente.', 'info') : ''}
    ${goldDivider()}
    ${ctaBtn('Revisar y confirmar', adminUrl)}
    ${waClient ? ctaBtnGhost('Escribir al cliente por WhatsApp', waClient) : ''}
  `;
  await safeSend('salon_new_booking', {
    to: adminEmail,
    subject: `Nueva solicitud: ${clientName} — ${capFirst(fmtDate(apt.date))} ${apt.startTime}`,
    html: baseHtml(`Nueva solicitud de ${clientName}`, body, settings),
  });
}

// ════════════════════════════════════════════════════════════
//  PEDIDOS (tienda) — mismo shell, sin stepper
// ════════════════════════════════════════════════════════════
async function sendOrderConfirmation({ order, email }) {
  if (!canSend() || !email) return;
  const settings = await getEmailSettings();
  const shortId = order.id.slice(-6).toUpperCase();
  const body = `
    ${heading('📦', '¡Pedido confirmado!')}
    ${bodyText(`Tu pedido <strong style="color:#f6ecf0;">#${esc(shortId)}</strong> fue recibido y está siendo procesado.`)}
    ${orderSummary(order)}
    ${infoTable([
      ['Envío a', `${order.shipDistrict || ''}, ${order.shipCity || 'Lima'}`],
      ['Estado',  { html: `<span style="color:${T.color.positive};font-weight:600;">Confirmado</span>` }],
      ['Pago',    order.paymentMethod === 'culqi' ? 'Tarjeta' : 'Yape / Plin'],
    ])}
    ${goldDivider()}
    ${bodyText('Te notificaremos por correo cuando tu pedido esté en camino.')}
    ${SALON_PHONE ? ctaBtnGhost('Consultar por WhatsApp', `https://wa.me/${SALON_PHONE}?text=${encodeURIComponent(`Hola! Quiero consultar sobre mi pedido #${shortId}`)}`) : ''}
  `;
  await safeSend('order_confirm', {
    to: email,
    subject: `Pedido #${shortId} confirmado — ${SALON}`,
    html: baseHtml(`Pedido #${shortId} confirmado`, body, settings),
  });
}

async function sendOrderPendingPayment({ order, email, yapeNumber }) {
  if (!canSend() || !email) return;
  const settings = await getEmailSettings();
  const shortId = order.id.slice(-6).toUpperCase();
  const total = fmtPrice(order.totalPen);
  const body = `
    ${heading('📱', '¡Pedido registrado! Falta el pago')}
    ${bodyText(`Tu pedido <strong style="color:#f6ecf0;">#${esc(shortId)}</strong> ha sido registrado. Solo falta confirmar el pago:`)}
    ${orderSummary(order)}
    ${alertBox(`
      <p style="margin:0 0 8px;font-weight:700;font-size:14px;color:${T.color.gold_.fg};">Instrucciones de pago Yape / Plin</p>
      <p style="margin:0 0 4px;font-size:13px;color:${T.color.textMuted};">1. Abre tu app de <strong>Yape</strong> o <strong>Plin</strong></p>
      <p style="margin:0 0 4px;font-size:13px;color:${T.color.textMuted};">2. Transfiere <strong>${esc(total)}</strong> al número:</p>
      <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:${T.color.gold};letter-spacing:2px;">${esc(yapeNumber || 'Consultar por WhatsApp')}</p>
      <p style="margin:8px 0 0;font-size:12px;color:${T.color.textFaint};">3. Envía la captura por WhatsApp con tu N° de pedido <strong>#${esc(shortId)}</strong></p>
    `, 'gold_')}
    ${goldDivider()}
    ${SALON_PHONE ? ctaBtn('Enviar comprobante por WhatsApp', `https://wa.me/${SALON_PHONE}?text=${encodeURIComponent(`Hola! Adjunto mi comprobante de pago Yape para el pedido #${shortId} por ${total}`)}`) : ''}
  `;
  await safeSend('order_pending', {
    to: email,
    subject: `Pedido #${shortId} registrado — Pendiente de pago Yape`,
    html: baseHtml(`Pedido #${shortId} — pendiente de pago`, body, settings),
  });
}

async function sendOrderStatusUpdate({ order, email, newStatus }) {
  if (!canSend() || !email) return;
  const settings = await getEmailSettings();
  const shortId = order.id.slice(-6).toUpperCase();

  const STATUS_INFO = {
    processing: { emoji: '🔄', title: 'Tu pedido está en preparación', badge: 'En preparación', color: T.color.gold,     preview: 'Estamos preparando tu pedido' },
    shipped:    { emoji: '🚚', title: '¡Tu pedido va en camino!',       badge: 'Enviado',         color: T.color.primary,  preview: 'Tu pedido está en camino' },
    delivered:  { emoji: '✅', title: '¡Pedido entregado!',              badge: 'Entregado',       color: T.color.positive, preview: 'Tu pedido fue entregado' },
    cancelled:  { emoji: '❌', title: 'Tu pedido fue cancelado',         badge: 'Cancelado',       color: T.color.danger,   preview: 'Pedido cancelado' },
  };
  const info = STATUS_INFO[newStatus];
  if (!info) return;

  const extras = {
    processing: bodyText('Nuestro equipo ya está preparando tu pedido con mucho cuidado.'),
    shipped:    alertBox('<strong>Tu pedido está en camino.</strong> El repartidor se comunicará contigo para coordinar la entrega.', 'info'),
    delivered:  `${bodyText('¡Tu pedido llegó! Esperamos que disfrutes tus productos.')}${SALON_PHONE ? ctaBtnGhost('Calificar mi pedido', `https://wa.me/${SALON_PHONE}?text=${encodeURIComponent(`Hola! Quiero calificar mi pedido #${shortId}`)}`) : ''}`,
    cancelled:  `${alertBox('Si el pago fue procesado, te haremos el reembolso a la brevedad. Escríbenos para coordinar.', 'error')}${SALON_PHONE ? ctaBtnGhost('Contactar soporte', `https://wa.me/${SALON_PHONE}`) : ''}`,
  };

  const body = `
    ${heading(info.emoji, info.title, info.color)}
    ${bodyText(`Tu pedido <strong style="color:#f6ecf0;">#${esc(shortId)}</strong> ha cambiado de estado:`)}
    ${infoTable([
      ['Pedido', `#${shortId}`],
      ['Estado', { html: `<strong style="color:${info.color};">${esc(info.badge)}</strong>` }],
      ['Envío a', `${order.shipDistrict || ''}, ${order.shipCity || 'Lima'}`],
      ['Total', fmtPrice(order.totalPen)],
    ])}
    ${extras[newStatus] || ''}
    ${goldDivider()}
    ${SALON_PHONE ? ctaBtnGhost('Consultar por WhatsApp', `https://wa.me/${SALON_PHONE}?text=${encodeURIComponent(`Hola! Consulta sobre mi pedido #${shortId}`)}`) : ''}
  `;
  await safeSend('order_status', {
    to: email,
    subject: `Pedido #${shortId}: ${info.badge} — ${SALON}`,
    html: baseHtml(info.preview, body, settings),
  });
}

// ════════════════════════════════════════════════════════════
//  ADELANTOS / DEPÓSITOS
// ════════════════════════════════════════════════════════════
async function sendDepositReceipt({ payment, appointments = [], packageInfo, email, name }) {
  if (!canSend() || !email) return;
  const settings = await getEmailSettings();
  const total    = Number(payment.totalPen || 0);
  const adelanto = Number(payment.paidPen || 0);
  const saldo    = Number(payment.balancePen != null ? payment.balancePen : total - adelanto);
  const methodLabel = { culqi: 'Tarjeta', yape: 'Yape', plin: 'Plin', transfer: 'Transferencia', cash: 'Efectivo' }[payment.method] || '—';
  const receiptUrl = `${WEB_URL}/reserva/${payment.id}/recibo`;

  const body = `
    ${heading('💳', '¡Adelanto confirmado!')}
    ${greeting(name || payment.customerName)}
    ${bodyText(`Recibimos el adelanto de tu reserva${packageInfo ? ` del paquete <strong style="color:#f6ecf0;">${esc(packageInfo.name)}</strong>` : ''}. Aquí tu recibo:`)}
    ${appointments.length ? bookingSummaryTable({ packageInfo, appointments, atHomeExtraPen: 0 }) : ''}
    ${infoTable([
      ['N° de recibo', payment.receiptNumber || '—'],
      ['Total de la reserva', fmtPrice(total)],
      ['Adelanto pagado', { html: `<strong style="color:${T.color.positive};">${esc(fmtPrice(adelanto))}</strong>` }],
      ['Saldo pendiente', { html: `<strong style="color:${T.color.warning.fg};">${esc(fmtPrice(saldo))}</strong>` }],
      ['Método de pago', methodLabel],
    ])}
    ${alertBox('El <strong>saldo pendiente</strong> se paga el día del servicio. ¡Te esperamos!', 'success')}
    ${ctaBtn('Ver / imprimir recibo', receiptUrl)}
  `;
  await safeSend('deposit_receipt', {
    to: email,
    subject: `Adelanto confirmado · Recibo ${payment.receiptNumber || ''} — ${SALON}`,
    html: baseHtml('Adelanto confirmado', body, settings),
  });
}

async function sendDepositProofReceived({ payment, email, name }) {
  if (!canSend() || !email) return;
  const settings = await getEmailSettings();
  const body = `
    ${heading('🧾', 'Recibimos tu comprobante')}
    ${greeting(name || payment.customerName)}
    ${bodyText('Estamos verificando tu pago. Apenas lo confirmemos, tu reserva quedará confirmada y te enviaremos el recibo.')}
    ${infoTable([
      ['Adelanto', fmtPrice(payment.depositPen)],
      ['Estado', { html: `<strong style="color:${T.color.warning.fg};">En verificación</strong>` }],
    ])}
    ${SALON_PHONE ? ctaBtnGhost('Escribir por WhatsApp', `https://wa.me/${SALON_PHONE}`) : ''}
  `;
  await safeSend('deposit_proof_received', {
    to: email,
    subject: `Comprobante recibido — ${SALON}`,
    html: baseHtml('Comprobante recibido', body, settings),
  });
}

async function sendDepositProofToSalon({ payment }) {
  const adminEmail = env.SALON_ADMIN_EMAIL;
  if (!canSend() || !adminEmail) return;
  const settings = await getEmailSettings();
  const adminUrl = `${WEB_URL}/admin/pagos`;
  const body = `
    ${heading('🔎', 'Comprobante por verificar', T.color.gold)}
    ${bodyText(`<strong style="color:#f6ecf0;">${esc(payment.customerName || 'Cliente')}</strong> subió un comprobante de adelanto.`)}
    ${infoTable([
      ['Cliente', payment.customerName || '—'],
      ['Teléfono', payment.customerPhone || '—'],
      ['Adelanto', fmtPrice(payment.depositPen)],
      ['Método', payment.method || '—'],
    ])}
    ${ctaBtn('Revisar en el panel', adminUrl)}
  `;
  await safeSend('deposit_proof_salon', {
    to: adminEmail,
    subject: `Comprobante por verificar: ${payment.customerName || 'Cliente'}`,
    html: baseHtml('Comprobante por verificar', body, settings),
  });
}

module.exports = {
  // línea principal (stepper)
  sendAppointmentRequested,
  sendBookingRequested,
  sendAppointmentConfirmation,
  sendBookingConfirmation,
  sendAppointmentCompleted,
  // secundarios (banner)
  sendAppointmentCancelled,
  sendAppointmentRescheduled,
  sendAppointmentNoShow,
  sendAppointmentInProgress,
  sendAppointmentReminder,
  // salón / pedidos / depósitos
  sendNewBookingToSalon,
  sendOrderConfirmation,
  sendOrderPendingPayment,
  sendOrderStatusUpdate,
  sendDepositReceipt,
  sendDepositProofReceived,
  sendDepositProofToSalon,
  // helpers exportados por si se reutilizan
  baseHtml, getEmailSettings,
  heading, greeting, bodyText, ctaBtn, ctaBtnGhost, alertBox, goldDivider,
};
