// Render de TODAS las plantillas de correo a HTML (sin enviar) para validar el
// diseño en navegador (desktop + móvil). Uso:
//   node apps/api/scripts/preview-emails.js   (genera HTML en tmp y lo sirve)
//
// Gated por EMAIL_PREVIEW_DIR → safeSend escribe HTML en vez de enviar.

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const PORT = 8810;
// El correo referencia ${WEB_URL}/email/<icono>.png y el logo desde settings.
process.env.NEXT_PUBLIC_WEB_URL = `http://127.0.0.1:${PORT}`;
// Para que los correos internos al salón también se rendericen en preview.
process.env.SALON_ADMIN_EMAIL = process.env.SALON_ADMIN_EMAIL || 'salon@example.com';
process.env.SALON_WHATSAPP = process.env.SALON_WHATSAPP || '51999888777';

const OUT = path.join(os.tmpdir(), 'deyanira-emails');
process.env.EMAIL_PREVIEW_DIR = OUT;
fs.mkdirSync(path.join(OUT, 'email'), { recursive: true });

// Copiar assets (logo + íconos) al mismo origen del server de preview.
const PUB = path.join(__dirname, '..', '..', 'web', 'public');
try { fs.copyFileSync(path.join(PUB, 'logo-dark.png'), path.join(OUT, 'logo-dark.png')); } catch {}
for (const f of ['instagram.png', 'facebook.png', 'tiktok.png']) {
  try { fs.copyFileSync(path.join(PUB, 'email', f), path.join(OUT, 'email', f)); } catch {}
}

// Sembrar la caché de settings con datos de marca (logo local + redes).
const cache = require('../src/lib/cache');
cache.set('settings:email', {
  logoDarkUrl: `http://127.0.0.1:${PORT}/logo-dark.png`,
  salonName: 'Deyanira Makeup Beauty',
  phone: '+51 999 888 777', whatsapp: '51999888777',
  address: 'Av. Ejemplo 123', district: 'Surco', city: 'Lima, Perú',
  instagramUrl: 'https://instagram.com/deyanira',
  facebookUrl: 'https://facebook.com/deyanira',
  tiktokUrl: 'https://tiktok.com/@deyanira',
}, 60 * 60 * 1000);

const M = require('../src/lib/notifications/email');

// ── Datos mock ─────────────────────────────────────────────────
const apt = {
  id: 'abc12345-0000-0000-0000-000000000000',
  service: { name: 'Maquillaje + Peinado' },
  staff: null, onDutyStaff: true,
  date: '2026-06-14', startTime: '10:00', endTime: '11:30',
  totalPen: 180, atHome: false,
  guestName: 'Andrea', guestEmail: 'andrea@example.com', guestPhone: '999888777',
};
const aptStaff = { ...apt, staff: { name: 'Lucía Ramírez' }, onDutyStaff: false };
// Reserva de paquete tal como queda en BD: la 1ª cita lleva el precio del paquete,
// el resto 0, y el addon (prueba) su precio propio. El correo debe mostrar el
// precio a nivel paquete e "Incluido en el paquete" en las citas incluidas.
const SVC_MAQ = 'svc-maq-novia', SVC_PEI = 'svc-peinado', SVC_TRIAL = 'svc-prueba';
const pkgAppts = [
  { ...aptStaff, serviceId: SVC_MAQ, service: { id: SVC_MAQ, name: 'Maquillaje novia' }, startTime: '08:00', endTime: '09:30', totalPen: 450 },
  { ...aptStaff, serviceId: SVC_PEI, service: { id: SVC_PEI, name: 'Peinado' }, startTime: '09:30', endTime: '10:30', totalPen: 0 },
  { ...aptStaff, serviceId: SVC_TRIAL, service: { id: SVC_TRIAL, name: 'Maquillaje de prueba' }, date: '2026-06-10', startTime: '11:00', endTime: '12:00', totalPen: 200 },
];
const packageInfo = {
  name: 'Novia Premium', groupLabel: 'Boda', eventType: { name: 'Bodas' },
  pricePen: 450, includedServiceIds: [SVC_MAQ, SVC_PEI], trialAddonServiceId: SVC_TRIAL,
};
const order = {
  id: 'order-abcdef123456', subtotalPen: 150, shippingPen: 15, discountPen: 10, totalPen: 155,
  shipDistrict: 'Miraflores', shipCity: 'Lima', paymentMethod: 'culqi',
  items: [{ name: 'Labial mate', qty: 2, pricePen: 45 }, { name: 'Base líquida', qty: 1, pricePen: 60 }],
};
const payment = {
  id: 'pay-123', receiptNumber: 'R-0001', totalPen: 650, paidPen: 325, balancePen: 325,
  method: 'yape', depositPen: 325, customerName: 'Andrea', customerPhone: '999888777',
  proofImageUrl: 'https://picsum.photos/seed/comprobante/400/520',
};
const email = 'preview@example.com';

async function main() {
  await M.sendAppointmentRequested({ appointment: apt, email, name: 'Andrea' });
  await M.sendBookingRequested({ appointments: pkgAppts, packageInfo, email, name: 'Andrea', atHomeExtraPen: 0 });
  await M.sendAppointmentConfirmation({ appointment: apt, email, name: 'Andrea' });
  await M.sendBookingConfirmation({ appointments: pkgAppts, packageInfo, email, name: 'Andrea', atHomeExtraPen: 0 });
  await M.sendAppointmentCompleted({ appointment: aptStaff, email, name: 'Andrea' });
  await M.sendAppointmentCancelled({ appointment: aptStaff, email, name: 'Andrea', reason: 'Solicitado por la clienta' });
  await M.sendBookingRejected({ appointments: pkgAppts, packageInfo, email, name: 'Andrea', atHomeExtraPen: 0 });
  await M.sendAppointmentRescheduled({ appointment: aptStaff, email, name: 'Andrea', beforeDate: '2026-06-13', beforeStart: '10:00' });
  await M.sendAppointmentNoShow({ appointment: aptStaff, email, name: 'Andrea' });
  await M.sendAppointmentInProgress({ appointment: aptStaff, email, name: 'Andrea' });
  await M.sendAppointmentReminder({ appointment: aptStaff, email, name: 'Andrea', hoursBefore: 24 });
  await M.sendNewBookingToSalon({ appointment: apt });
  await M.sendOrderConfirmation({ order, email });
  await M.sendOrderPendingPayment({ order, email, yapeNumber: '999 888 777' });
  await M.sendOrderStatusUpdate({ order, email, newStatus: 'shipped' });
  await M.sendDepositReceipt({ payment, appointments: pkgAppts, packageInfo, email, name: 'Andrea' });
  await M.sendDepositProofReceived({ payment, email, name: 'Andrea' });
  await M.sendDepositProofToSalon({ payment });

  // override SALON_ADMIN_EMAIL para los correos al salón en preview
  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.html'));
  const index = `<!doctype html><meta charset=utf-8><style>body{font-family:Arial;background:#e7e3ea;margin:0;padding:20px}h2{font-size:14px;color:#6b5560;margin:24px 0 8px}iframe{width:100%;max-width:600px;height:760px;border:0;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.15);background:#211915;display:block}</style>`
    + files.map(f => `<h2>${f}</h2><iframe src="${f}"></iframe>`).join('');
  fs.writeFileSync(path.join(OUT, 'index.html'), index);
  console.log(`Generados ${files.length} correos en ${OUT}`);

  const TYPES = { '.html': 'text/html', '.png': 'image/png' };
  http.createServer((q, s) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    try {
      const buf = fs.readFileSync(path.join(OUT, p));
      s.setHeader('Content-Type', TYPES[path.extname(p)] || 'application/octet-stream');
      s.end(buf);
    } catch { s.statusCode = 404; s.end('nf'); }
  }).listen(PORT, () => console.log(`Preview en http://127.0.0.1:${PORT}/`));
}

main().catch(e => { console.error(e); process.exit(1); });
