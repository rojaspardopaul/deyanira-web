// ÚNICO punto de verdad del estilo de los correos transaccionales.
// Cambiar la identidad visual de TODOS los emails = editar este archivo.
//
// Los helpers de email.js (baseHtml, heading, ctaBtn, infoTable, alertBox…)
// consumen estos tokens en vez de hex literales. Las cajas de alerta usan
// `status` con nombre (success/warning/info/error/purple) → un set de colores
// coherente en todos los correos.

const color = {
  // Marca
  primary:    '#db2777', // rosa principal (CTA, totales, enlaces)
  primaryDark:'#9d174d', // rosa oscuro (texto sobre fondos rosa claro)
  gold:       '#d4af37', // dorado (acento header, divisores, ⭐/turno)

  // Chrome / estructura
  headerBg:   '#100815',
  bodyBg:     '#ffffff',
  pageBg:     '#f1f5f9',
  footerBg:   '#f8fafc',
  border:     '#e2e8f0',
  hairline:   '#f1f5f9', // línea sutil entre filas
  rowAlt:     '#fdf2f8', // fila alterna / fila total (tinte rosa)
  rowBorder:  '#fce7f3', // borde de tablas rosa

  // Texto
  text:       '#374151',
  textStrong: '#111827',
  textMuted:  '#6b7280',
  textFaint:  '#94a3b8',
  textFainter:'#cbd5e1',

  // Énfasis en texto (no cajas)
  positive:   '#16a34a', // verde (confirmado, descuento, adelanto pagado)
  pending:    '#9a3412', // ámbar oscuro (saldo pendiente)
  pendingText:'#ca8a04', // ámbar (estado "en verificación")
  danger:     '#dc2626', // rojo (encabezado cancelación)
  accent:     '#7c3aed', // violeta (encabezados de avisos internos al salón)

  // Paleta de estados (cajas de alerta) — fg=texto, bg=fondo, bd=borde
  success: { fg: '#166534', bg: '#f0fdf4', bd: '#bbf7d0' },
  warning: { fg: '#92400e', bg: '#fffbeb', bd: '#fde68a' },
  info:    { fg: '#1e40af', bg: '#eff6ff', bd: '#bfdbfe' },
  error:   { fg: '#991b1b', bg: '#fef2f2', bd: '#fecaca' },
  purple:  { fg: '#6b21a8', bg: '#faf5ff', bd: '#ddd6fe' },
};

const font = {
  serif: "Georgia,'Times New Roman',serif",
  sans:  'Arial,Helvetica,sans-serif',
};

const radius = {
  card: '20px',
  box:  '12px',
  pill: '50px',
};

module.exports = { color, font, radius };
