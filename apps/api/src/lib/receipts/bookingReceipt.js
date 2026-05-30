// Renderiza un recibo de reserva en HTML (listo para imprimir / guardar como PDF).
// Usado por GET /api/booking-payments/:id/receipt y por el email de confirmación.
const { escapeHtml: esc } = require('../html');

const PINK = '#FF4FA2';
const GOLD = '#D4AF37';

function money(n) {
  return 'S/ ' + Number(n || 0).toFixed(2);
}

function fmtDateLong(d) {
  let iso;
  if (typeof d === 'string') iso = d.slice(0, 10);
  else if (d instanceof Date) iso = d.toISOString().slice(0, 10);
  else return '';
  const [y, m, day] = iso.split('-').map(Number);
  if (!y || !m || !day) return '';
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${day} de ${months[m - 1]} de ${y}`;
}

const METHOD_LABEL = {
  culqi: 'Tarjeta (Culqi)',
  yape: 'Yape',
  plin: 'Plin',
  transfer: 'Transferencia bancaria',
  cash: 'Efectivo',
};

/**
 * @param {object} args
 * @param {object} args.payment       BookingPayment (receiptNumber, totalPen, depositPen, paidPen, balancePen, method, depositPercent, customerName, customerPhone, customerEmail, createdAt)
 * @param {Array}  args.appointments  citas del grupo (service, staff, date, startTime, endTime, totalPen)
 * @param {object} [args.package]     ServicePackage (name) + eventType opcional
 * @param {object} [args.salon]       Setting (salonName, address, district, city, phone, whatsapp, logoUrl)
 * @returns {string} HTML completo
 */
function renderBookingReceiptHtml({ payment, appointments = [], package: pkg = null, salon = {} }) {
  const salonName = salon.salonName || 'Deyanira Makeup Beauty';
  const salonAddr = [salon.address, salon.district, salon.city || 'Lima'].filter(Boolean).join(', ');
  const salonPhone = salon.whatsapp || salon.phone || '';
  const logo = typeof salon.logoUrl === 'string' && /^https?:\/\//.test(salon.logoUrl) ? salon.logoUrl : '';

  const fechaEmision = fmtDateLong(payment.createdAt || new Date());
  const total = Number(payment.totalPen || 0);
  const adelanto = Number(payment.paidPen || 0);
  const saldo = Number(payment.balancePen != null ? payment.balancePen : total - adelanto);
  const method = METHOD_LABEL[payment.method] || (payment.method ? esc(payment.method) : '—');

  const itemRows = appointments.map((a) => {
    const staffName = (a.onDutyStaff || !a.staff) ? 'Estilista de turno' : (a.staff?.name || '—');
    const when = `${fmtDateLong(a.date)} · ${esc(a.startTime || '')}–${esc(a.endTime || '')}`;
    return `<tr>
      <td class="desc"><span class="bullet">◆</span> ${esc(a.service?.name || 'Servicio')}
        <div class="sub">${when} · ${esc(staffName)}</div>
      </td>
      <td class="amt">${Number(a.totalPen) > 0 ? money(a.totalPen) : ''}</td>
    </tr>`;
  }).join('');

  const headerBrand = logo
    ? `<img src="${esc(logo)}" alt="${esc(salonName)}" class="logo" />`
    : `<div class="brandtext">DEYANIRA<span>MAKEUP BEAUTY</span></div>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Recibo ${esc(payment.receiptNumber || '')}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 0; }
  html, body { background: #ECECEC; }
  body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; position: relative; padding: 0 0 40mm; }
  .band { background: linear-gradient(120deg, #100815 0%, #2a0f22 100%); color: #fff; padding: 32px 40px 26px; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; border-bottom: 3px solid ${GOLD}; }
  .logo { max-height: 64px; max-width: 220px; object-fit: contain; }
  .brandtext { font-family: Georgia, serif; font-size: 30px; font-weight: bold; letter-spacing: 5px; color: ${GOLD}; line-height: 1; }
  .brandtext span { display: block; font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 6px; color: rgba(212,175,55,0.55); margin-top: 4px; }
  .rcpt { text-align: right; }
  .rcpt .tag { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.55); }
  .rcpt .num { font-size: 16px; font-weight: 700; color: ${GOLD}; margin-top: 3px; }
  .rcpt .date { font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 6px; }
  .body { padding: 32px 40px; }
  .row2 { display: flex; gap: 20px; margin-bottom: 26px; }
  .card { flex: 1; border: 1px solid #eee; border-radius: 12px; padding: 16px 18px; }
  .card h3 { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #9a8; color: #b8962e; margin-bottom: 8px; }
  .card p { font-size: 14px; color: #1a1a1a; line-height: 1.5; }
  .card .muted { color: #777; font-size: 12px; }
  .pkg { display: inline-block; margin-top: 6px; background: ${PINK}; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
  table.items th { text-align: left; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #888; padding: 10px 12px; border-bottom: 2px solid #eee; }
  table.items th.r, td.amt { text-align: right; }
  td.desc { padding: 12px; font-size: 14px; border-bottom: 1px solid #f2f2f2; }
  td.desc .sub { font-size: 11px; color: #888; margin-top: 3px; }
  td.amt { padding: 12px; font-size: 14px; border-bottom: 1px solid #f2f2f2; white-space: nowrap; }
  .bullet { color: ${PINK}; margin-right: 6px; }
  .totals { margin-left: auto; width: 320px; }
  .totals .line { display: flex; justify-content: space-between; padding: 9px 4px; font-size: 14px; }
  .totals .line.sep { border-top: 1px solid #eee; }
  .totals .grand { font-size: 15px; font-weight: 700; }
  .totals .deposit { color: #16a34a; font-weight: 700; }
  .totals .balance { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 12px 14px; margin-top: 8px; font-size: 16px; font-weight: 700; color: #9a3412; display: flex; justify-content: space-between; }
  .note { margin-top: 26px; font-size: 12px; color: #777; line-height: 1.6; border-top: 1px dashed #ddd; padding-top: 16px; }
  .foot { position: absolute; bottom: 0; left: 0; right: 0; background: #100815; color: rgba(255,255,255,0.6); font-size: 11px; text-align: center; padding: 14px; }
  .foot b { color: ${GOLD}; }
  @media print { body { background: #fff; } .page { box-shadow: none; } }
</style>
</head>
<body>
  <div class="page">
    <div class="band">
      <div>${headerBrand}</div>
      <div class="rcpt">
        <div class="tag">Recibo</div>
        <div class="num">${esc(payment.receiptNumber || '—')}</div>
        <div class="date">${esc(fechaEmision)}</div>
      </div>
    </div>

    <div class="body">
      <div class="row2">
        <div class="card">
          <h3>Cliente</h3>
          <p>${esc(payment.customerName || 'Cliente')}</p>
          ${payment.customerPhone ? `<p class="muted">${esc(payment.customerPhone)}</p>` : ''}
          ${payment.customerEmail ? `<p class="muted">${esc(payment.customerEmail)}</p>` : ''}
          ${pkg ? `<span class="pkg">📦 ${esc(pkg.name)}</span>` : ''}
        </div>
        <div class="card">
          <h3>${esc(salonName)}</h3>
          ${salonAddr ? `<p class="muted">${esc(salonAddr)}</p>` : ''}
          ${salonPhone ? `<p class="muted">${esc(salonPhone)}</p>` : ''}
          <p class="muted">Método de pago: ${method}</p>
        </div>
      </div>

      <table class="items">
        <thead><tr><th>Detalle de la reserva</th><th class="r">Subtotal</th></tr></thead>
        <tbody>${itemRows || '<tr><td class="desc">Reserva</td><td class="amt"></td></tr>'}</tbody>
      </table>

      <div class="totals">
        <div class="line grand"><span>Total de la reserva</span><span>${money(total)}</span></div>
        <div class="line sep deposit"><span>Adelanto pagado (${esc(String(payment.depositPercent || 0))}%)</span><span>− ${money(adelanto)}</span></div>
        <div class="balance"><span>Saldo a pagar el día del servicio</span><span>${money(saldo)}</span></div>
      </div>

      <div class="note">
        Este recibo confirma el pago del adelanto de su reserva. El saldo pendiente se abona el día del servicio.
        Conserve este documento. Para reprogramar o cancelar, contáctenos con al menos 24 horas de anticipación.
      </div>
    </div>

    <div class="foot">© ${new Date().getFullYear()} <b>${esc(salonName)}</b> · Gracias por su preferencia</div>
  </div>
</body>
</html>`;
}

module.exports = { renderBookingReceiptHtml, money: money };
