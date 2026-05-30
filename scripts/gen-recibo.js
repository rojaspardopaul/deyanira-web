// Genera un recibo formal en HTML (listo para imprimir / convertir a PDF).
// Uso: node scripts/gen-recibo.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const logoB64 = 'data:image/png;base64,' +
  fs.readFileSync(path.join(ROOT, 'apps/web/public/logo-dark.png')).toString('base64');

const PINK = '#FF4FA2';
const GOLD = '#D4AF37';

// ---- Datos del recibo ----
const recibo = {
  numero: 'DMB-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-001',
  fecha: new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }),
  cliente: 'Ena Flores',
  paquete: 'Paquete Novia — Religioso',
  items: [
    'Maquillaje + peinado',
    'Prueba de maquillaje',
    'Maquillaje y peinado civil',
    'Manicure acrílicas + pedicura',
    '2 familiares: maquillaje y peinado',
  ],
  total: 1370,
  adelanto: 500,
};
const saldo = recibo.total - recibo.adelanto;
const money = (n) => 'S/ ' + n.toFixed(2);

const rows = recibo.items
  .map(
    (it) => `
      <tr>
        <td class="desc"><span class="bullet">◆</span> ${it}</td>
      </tr>`
  )
  .join('');

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Recibo ${recibo.numero}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 0; }
  html, body { background: #ECECEC; }
  body {
    font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #fff;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  /* Banda superior de marca */
  .topbar {
    background: linear-gradient(135deg, #0F0F0F 0%, #1d1d1d 100%);
    color: #fff;
    padding: 34px 48px 30px;
    position: relative;
    overflow: hidden;
  }
  .topbar::after {
    content: '';
    position: absolute;
    top: -120px; right: -120px;
    width: 340px; height: 340px; border-radius: 50%;
    background: radial-gradient(circle, ${PINK}40 0%, transparent 70%);
  }
  .topbar::before {
    content: '';
    position: absolute;
    bottom: -140px; left: -100px;
    width: 300px; height: 300px; border-radius: 50%;
    background: radial-gradient(circle, ${GOLD}33 0%, transparent 70%);
  }
  .brand { display:flex; align-items:center; justify-content:space-between; position:relative; z-index:1; gap:20px; }
  .brand img { height: 64px; width:auto; object-fit:contain; }
  .brand .meta { text-align:right; }
  .brand .meta .kicker {
    font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: ${GOLD}; font-weight: 700;
  }
  .brand .meta .recibo-n { font-size: 13px; color: rgba(255,255,255,.7); margin-top:6px; font-family: monospace; letter-spacing:1px; }
  .brand .meta .fecha { font-size: 12px; color: rgba(255,255,255,.55); margin-top:3px; }

  .title-row {
    position:relative; z-index:1; margin-top: 22px;
    display:flex; align-items:flex-end; gap:14px;
  }
  .title-row h1 {
    font-size: 30px; font-weight: 800; letter-spacing: 6px; text-transform: uppercase;
    background: linear-gradient(90deg, ${PINK}, ${GOLD}); -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .title-row .sub { font-size: 12px; color: rgba(255,255,255,.5); padding-bottom:5px; }

  .body { padding: 36px 48px 0; flex: 1; }

  /* Cliente */
  .client-card {
    display:flex; justify-content:space-between; align-items:center; gap:16px;
    border: 1px solid #eee; border-left: 4px solid ${PINK};
    border-radius: 10px; padding: 16px 20px; background:#fcfcfc;
  }
  .label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; font-weight:700; color:${PINK}; }
  .client-card .name { font-size: 20px; font-weight: 700; margin-top:4px; }
  .pkg-badge {
    background: linear-gradient(135deg, ${GOLD}1f, ${GOLD}0a); border:1px solid ${GOLD}55;
    color:#9a7b1f; border-radius: 999px; padding: 8px 16px; font-size: 13px; font-weight:700; white-space:nowrap;
  }

  /* Tabla servicios */
  .section-title { font-size: 11px; letter-spacing:2px; text-transform:uppercase; font-weight:700; color:#888; margin: 30px 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  thead th {
    text-align:left; font-size: 11px; letter-spacing:1.5px; text-transform:uppercase; color:#fff;
    background: linear-gradient(90deg, ${PINK}, #e6368a); padding: 12px 18px; font-weight:700;
  }
  tbody td.desc { padding: 14px 18px; font-size: 14px; border-bottom:1px solid #f0f0f0; color:#222; }
  .bullet { color:${PINK}; margin-right:8px; }
  tbody tr:nth-child(even) td { background:#fafafa; }

  /* Totales */
  .totals { margin-top: 28px; display:flex; justify-content:flex-end; }
  .totals .box { width: 320px; }
  .totals .line { display:flex; justify-content:space-between; padding: 10px 4px; font-size: 14px; border-bottom: 1px dashed #e2e2e2; }
  .totals .line.total {
    margin-top: 10px; border:none; border-radius: 12px; padding: 16px 20px; align-items:center;
    background: linear-gradient(135deg, ${PINK} 0%, #e6368a 55%, #a88426 100%); color:#fff;
    box-shadow: 0 10px 26px ${PINK}3a;
  }
  .totals .line.total .t-label { font-size: 12px; letter-spacing:1.5px; text-transform:uppercase; font-weight:700; }
  .totals .line.total .t-val { font-size: 26px; font-weight:800; }
  .totals .line .muted { color:#666; }
  .totals .saldo .v { font-weight: 800; color:${PINK}; font-size: 16px; }

  .note {
    margin: 30px 0 0; background:${GOLD}12; border:1px solid ${GOLD}44; border-radius:10px;
    padding: 14px 18px; font-size: 12.5px; color:#7a611a;
  }
  .sign-row { display:flex; justify-content:space-between; gap:40px; margin-top: 56px; }
  .sign { flex:1; text-align:center; }
  .sign .ln { border-top:1px solid #bbb; margin-bottom:8px; }
  .sign .cap { font-size: 11px; color:#888; letter-spacing:1px; text-transform:uppercase; }

  /* Footer */
  .footer {
    margin-top: 30px; background:#0F0F0F; color:rgba(255,255,255,.6);
    padding: 18px 48px; display:flex; justify-content:space-between; align-items:center; font-size: 11px;
  }
  .footer .gold { color:${GOLD}; font-weight:700; letter-spacing:2px; text-transform:uppercase; font-size:10px; }
</style>
</head>
<body>
  <div class="page">
    <div class="topbar">
      <div class="brand">
        <img src="${logoB64}" alt="Deyanira Makeup Beauty" />
        <div class="meta">
          <div class="kicker">Deyanira Makeup Beauty</div>
          <div class="recibo-n">N.º ${recibo.numero}</div>
          <div class="fecha">Lima, ${recibo.fecha}</div>
        </div>
      </div>
      <div class="title-row">
        <h1>Recibo</h1>
        <span class="sub">Comprobante de pago</span>
      </div>
    </div>

    <div class="body">
      <div class="client-card">
        <div>
          <div class="label">Cliente</div>
          <div class="name">${recibo.cliente}</div>
        </div>
        <div class="pkg-badge">👑 ${recibo.paquete}</div>
      </div>

      <div class="section-title">Detalle del servicio</div>
      <table>
        <thead><tr><th>Descripción</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals">
        <div class="box">
          <div class="line"><span class="muted">Total del servicio</span><span>${money(recibo.total)}</span></div>
          <div class="line"><span class="muted">Adelanto recibido</span><span>${money(recibo.adelanto)}</span></div>
          <div class="line saldo"><span class="muted">Saldo pendiente</span><span class="v">${money(saldo)}</span></div>
          <div class="line total">
            <div>
              <div class="t-label">Total</div>
            </div>
            <div class="t-val">${money(recibo.total)}</div>
          </div>
        </div>
      </div>

      <div class="note">
        ✦ Se recibió un adelanto de <strong>${money(recibo.adelanto)}</strong>. El saldo pendiente de
        <strong>${money(saldo)}</strong> se cancelará el día del servicio. Este recibo es válido como
        comprobante del adelanto entregado.
      </div>

      <div class="sign-row">
        <div class="sign"><div class="ln"></div><div class="cap">Firma del cliente</div></div>
        <div class="sign"><div class="ln"></div><div class="cap">Deyanira Makeup Beauty</div></div>
      </div>
    </div>

    <div class="footer">
      <span class="gold">deyaniramakeup.pe</span>
      <span>Gracias por tu confianza · Hecho con ♡ en Lima</span>
    </div>
  </div>
</body>
</html>`;

const outDir = path.join(ROOT, 'recibos');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `recibo-${recibo.cliente.replace(/\s+/g, '-').toLowerCase()}.html`);
fs.writeFileSync(outPath, html, 'utf8');
console.log('HTML escrito en:', outPath);
