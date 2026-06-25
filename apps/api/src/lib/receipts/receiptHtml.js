// Renderiza un recibo GENÉRICO (cualquier cobro) en HTML, listo para convertir a
// PDF. Soporta items/concepto + historial de pagos (abonos) + saldo. Comparte la
// paleta de marca con el recibo de reserva (bookingReceipt.js) vía theme.js.
const { escapeHtml: esc } = require('../html');
const T = require('../notifications/theme');

const PINK = T.color.primary;   // #db2777
const GOLD = T.color.gold;      // #d4af37
const INK1 = T.color.inkDark;   // #100815
const INK2 = T.color.inkDeep;   // #2a0f22

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
  transfer: 'Transferencia',
  cash: 'Efectivo',
};

const STATUS_LABEL = {
  pending: 'Pendiente',
  partial: 'Pago parcial',
  paid: 'Pagado',
  cancelled: 'Anulado',
};

/**
 * @param {object} args
 * @param {object} args.receipt  Receipt (receiptNumber, customerName/Phone/Email, title,
 *                               totalPen, paidPen, balancePen, status, createdAt,
 *                               items: [{description, qty, unitPen, amountPen}],
 *                               payments: [{amountPen, method, paidAt, note}])
 * @param {object} [args.salon]  Setting (salonName, address, district, city, phone, whatsapp, logoUrl)
 * @returns {string} HTML completo
 */
function renderReceiptHtml({ receipt, salon = {} }) {
  const salonName = salon.salonName || 'Deyanira Makeup Beauty';
  const salonAddr = [salon.address, salon.district, salon.city || 'Lima'].filter(Boolean).join(', ');
  const salonPhone = salon.whatsapp || salon.phone || '';
  const logo = typeof salon.logoUrl === 'string' && /^https?:\/\//.test(salon.logoUrl) ? salon.logoUrl : '';

  const fechaEmision = fmtDateLong(receipt.createdAt || new Date());
  const total = Number(receipt.totalPen || 0);
  const pagado = Number(receipt.paidPen || 0);
  const saldo = Number(receipt.balancePen != null ? receipt.balancePen : total - pagado);
  const items = Array.isArray(receipt.items) ? receipt.items : [];
  const payments = Array.isArray(receipt.payments) ? receipt.payments : [];

  const itemRows = (items.length
    ? items.map((it) => {
        const qty = Number(it.qty || 1);
        const sub = it.description + (qty > 1 ? ` <span class="sub" style="display:inline;">(${qty} × ${money(it.unitPen)})</span>` : '');
        return `<tr>
          <td class="desc"><span class="bullet">◆</span> ${esc(it.description)}${qty > 1 ? ` <span class="sub" style="display:inline;">— ${qty} × ${money(it.unitPen)}</span>` : ''}</td>
          <td class="amt">${money(it.amountPen)}</td>
        </tr>`;
      }).join('')
    : `<tr><td class="desc"><span class="bullet">◆</span> ${esc(receipt.title || 'Cobro')}</td><td class="amt">${money(total)}</td></tr>`);

  const paymentRows = payments.length
    ? payments.map((p) => `<tr>
        <td class="desc">${esc(fmtDateLong(p.paidAt))} <span class="sub" style="display:inline;">· ${esc(METHOD_LABEL[p.method] || p.method || '—')}</span>${p.note ? ` <span class="sub" style="display:inline;">· ${esc(p.note)}</span>` : ''}</td>
        <td class="amt">${money(p.amountPen)}</td>
      </tr>`).join('')
    : `<tr><td class="desc"><span class="sub">Sin pagos registrados aún</span></td><td class="amt"></td></tr>`;

  const headerBrand = logo
    ? `<img src="${esc(logo)}" alt="${esc(salonName)}" class="logo" />`
    : `<div class="brandtext">DEYANIRA<span>MAKEUP BEAUTY</span></div>`;

  const statusLabel = STATUS_LABEL[receipt.status] || receipt.status || '';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Recibo ${esc(receipt.receiptNumber || '')}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 0; }
  html, body { background: #ECECEC; }
  body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; position: relative; padding: 0 0 40mm; }
  .band { background: ${INK1}; background: linear-gradient(120deg, ${INK1} 0%, ${INK2} 100%); color: #fff; padding: 32px 40px 26px; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; border-bottom: 3px solid ${GOLD}; }
  .logo { max-height: 64px; max-width: 220px; object-fit: contain; }
  .brandtext { font-family: Georgia, serif; font-size: 30px; font-weight: bold; letter-spacing: 5px; color: ${GOLD}; line-height: 1; }
  .brandtext span { display: block; font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 6px; color: rgba(212,175,55,0.55); margin-top: 4px; }
  .rcpt { text-align: right; }
  .rcpt .tag { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.55); }
  .rcpt .num { font-size: 16px; font-weight: 700; color: ${GOLD}; margin-top: 3px; }
  .rcpt .date { font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 6px; }
  .rcpt .status { display: inline-block; margin-top: 8px; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; background: rgba(255,255,255,0.12); color: #fff; }
  .body { padding: 32px 40px; }
  .row2 { display: flex; gap: 20px; margin-bottom: 26px; }
  .card { flex: 1; border: 1px solid #eee; border-radius: 12px; padding: 16px 18px; }
  .card h3 { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #b8962e; margin-bottom: 8px; }
  .card p { font-size: 14px; color: #1a1a1a; line-height: 1.5; }
  .card .muted { color: #777; font-size: 12px; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
  table.items th { text-align: left; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #888; padding: 10px 12px; border-bottom: 2px solid #eee; }
  table.items th.r, td.amt { text-align: right; }
  td.desc { padding: 12px; font-size: 14px; border-bottom: 1px solid #f2f2f2; }
  td.desc .sub { font-size: 11px; color: #888; }
  td.amt { padding: 12px; font-size: 14px; border-bottom: 1px solid #f2f2f2; white-space: nowrap; }
  .bullet { color: ${PINK}; margin-right: 6px; }
  .sectlabel { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #b8962e; margin: 4px 0 8px; font-weight: 700; }
  .totals { margin-left: auto; width: 320px; }
  .totals .line { display: flex; justify-content: space-between; padding: 9px 4px; font-size: 14px; }
  .totals .line.sep { border-top: 1px solid #eee; }
  .totals .grand { font-size: 15px; font-weight: 700; }
  .totals .paid { color: #16a34a; font-weight: 700; }
  .totals .balance { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 12px 14px; margin-top: 8px; font-size: 16px; font-weight: 700; color: #9a3412; display: flex; justify-content: space-between; }
  .totals .balance.zero { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
  .note { margin-top: 26px; font-size: 12px; color: #777; line-height: 1.6; border-top: 1px dashed #ddd; padding-top: 16px; }
  .foot { position: absolute; bottom: 0; left: 0; right: 0; background: ${INK1}; color: rgba(255,255,255,0.6); font-size: 11px; text-align: center; padding: 14px; }
  .foot .contact { color: rgba(255,255,255,0.45); font-size: 10.5px; margin-top: 3px; }
  .foot b { color: ${GOLD}; }
</style>
</head>
<body>
  <div class="page">
    <div class="band">
      <div>${headerBrand}</div>
      <div class="rcpt">
        <div class="tag">Recibo</div>
        <div class="num">${esc(receipt.receiptNumber || '—')}</div>
        <div class="date">${esc(fechaEmision)}</div>
        ${statusLabel ? `<div class="status">${esc(statusLabel)}</div>` : ''}
      </div>
    </div>

    <div class="body">
      <div class="row2">
        <div class="card">
          <h3>Cliente</h3>
          <p>${esc(receipt.customerName || 'Cliente')}</p>
          ${receipt.customerPhone ? `<p class="muted">${esc(receipt.customerPhone)}</p>` : ''}
          ${receipt.customerEmail ? `<p class="muted">${esc(receipt.customerEmail)}</p>` : ''}
        </div>
        <div class="card">
          <h3>${esc(salonName)}</h3>
          ${salonAddr ? `<p class="muted">${esc(salonAddr)}</p>` : ''}
          ${salonPhone ? `<p class="muted">${esc(salonPhone)}</p>` : ''}
          ${receipt.title ? `<p class="muted">Concepto: ${esc(receipt.title)}</p>` : ''}
        </div>
      </div>

      <table class="items">
        <thead><tr><th>Detalle</th><th class="r">Importe</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>

      <p class="sectlabel">Historial de pagos</p>
      <table class="items">
        <thead><tr><th>Fecha · método</th><th class="r">Monto</th></tr></thead>
        <tbody>${paymentRows}</tbody>
      </table>

      <div class="totals">
        <div class="line grand"><span>Total</span><span>${money(total)}</span></div>
        <div class="line sep paid"><span>Pagado</span><span>${money(pagado)}</span></div>
        ${saldo > 0 ? `<div class="balance"><span>Saldo pendiente</span><span>${money(saldo)}</span></div>` : ''}
      </div>

      <div class="note">
        Este documento es un comprobante interno de pago emitido por ${esc(salonName)}.
        Conserve este recibo. Para cualquier consulta, contáctenos${salonPhone ? ` al ${esc(salonPhone)}` : ''}.
      </div>
    </div>

    <div class="foot">© ${new Date().getFullYear()} <b>${esc(salonName)}</b> · Gracias por su preferencia
      ${(salonPhone || salonAddr) ? `<div class="contact">${[salonAddr, salonPhone].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
    </div>
  </div>
</body>
</html>`;
}

module.exports = { renderReceiptHtml, money };
