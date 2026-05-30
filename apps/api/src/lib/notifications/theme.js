// ÚNICO punto de verdad del estilo de los correos transaccionales.
// Cambiar la identidad visual de TODOS los emails = editar este archivo.
//
// Identidad: tema OSCURO cálido (negro #211915 estilo "Stripo"), acento DORADO
// dominante + ROSA para el estado activo/CTA. Los helpers de email.js consumen
// estos tokens en vez de hex literales.

const color = {
  // ── Marca ──────────────────────────────────────────────
  primary:     '#db2777', // rosa principal (CTA, nodo activo del stepper)
  primaryGlow: '#ec4899', // rosa claro (degradado del botón / nodo)
  gold:        '#d4af37', // dorado (acento dominante: header, divisores, totales)
  goldSoft:    '#e7c456', // dorado claro (degradado / hover)
  goldDeep:    '#caa12f', // dorado profundo (relleno de nodo "hecho")

  // ── Superficies OSCURAS ────────────────────────────────
  cardBg:     '#211915', // fondo plano del correo (referencia Stripo)
  headerInk:  '#19120d', // header/pie aún más oscuro
  footerBg:   '#19120d',
  pageBg:     '#e7e3ea', // fondo de página (alrededor de la card de 600px)
  todoNodeBg: '#2a1f17', // relleno sólido del nodo "pendiente" del stepper
  panelBg:    '#2b211b', // panel de detalles (sólido, fallback de rgba)
  panelLine:  '#4a3b2a', // borde del panel (dorado tenue, sólido)
  rowLine:    '#3a2e24', // línea entre filas del panel

  // ── Texto sobre oscuro ─────────────────────────────────
  cream:      '#f6ecf0', // texto principal claro
  white:      '#ffffff',
  textMuted:  '#b9a7af',
  textFaint:  '#8a7681',
  textFainter:'#6b5560',

  // ── Énfasis ────────────────────────────────────────────
  positive:   '#34d399', // verde (descuento, adelanto pagado) sobre oscuro
  danger:     '#fb7185', // rojo claro sobre oscuro

  // ── Subset CLARO para el recibo PDF (imprimible) ──────
  inkDark:    '#100815', // header oscuro del recibo
  inkDeep:    '#2a0f22',
  paper:      '#ffffff',
  paperAlt:   '#faf7f8',

  // ── Cajas de alerta (status) — fg=texto, bg=fondo, bd=borde — recoloreadas
  //    para CONTRASTAR sobre el fondo oscuro de la card ──
  success: { fg: '#86efac', bg: 'rgba(22,163,74,0.14)',  bd: 'rgba(34,197,94,0.40)' },
  warning: { fg: '#fcd34d', bg: 'rgba(217,119,6,0.14)',  bd: 'rgba(245,158,11,0.40)' },
  info:    { fg: '#7dd3fc', bg: 'rgba(2,132,199,0.14)',  bd: 'rgba(56,189,248,0.40)' },
  error:   { fg: '#fda4af', bg: 'rgba(220,38,38,0.14)',  bd: 'rgba(248,113,113,0.40)' },
  gold_:   { fg: '#f0d98a', bg: 'rgba(212,175,55,0.12)', bd: 'rgba(212,175,55,0.40)' },
  // alias legacy (algunos send* aún piden 'purple') → mapeado a gold tenue
  purple:  { fg: '#f0d98a', bg: 'rgba(212,175,55,0.12)', bd: 'rgba(212,175,55,0.40)' },
};

// Estados del stepper (línea principal de 3 pasos)
const stepper = {
  done:   { bg: color.goldDeep, fg: '#241016' },           // dorado, ✓ oscuro
  active: { bg: color.primary,  fg: '#ffffff' },           // rosa, ✓ blanco
  todo:   { bg: color.todoNodeBg, border: 'rgba(212,175,55,0.42)', fg: '#9a8790' },
  segDone: { from: color.gold, to: color.primary },        // barra dorado→rosa
  segTodo: 'rgba(212,175,55,0.5)',                          // barra punteada dorada
};

// Banners de estados secundarios (sin stepper)
const banner = {
  info:    color.info,    // Reprogramada → usamos gold (ver abajo) pero info disponible
  gold:    color.gold_,   // Reprogramada (dorado tenue)
  danger:  color.error,   // Cancelada
  warning: color.warning, // No asistió
  success: color.success, // En curso (positivo)
};

const font = {
  serif: "Georgia,'Times New Roman',serif",
  sans:  'Arial,Helvetica,sans-serif',
};

const radius = {
  card: '20px',
  box:  '16px',
  pill: '50px',
};

// Barra superior decorativa: UN SOLO dorado (fallback bgcolor en `topbarSolid`)
const topbar = `linear-gradient(90deg,#bd9a2f,${color.goldSoft} 50%,#bd9a2f)`;
const topbarSolid = color.gold;

module.exports = { color, font, radius, stepper, banner, topbar, topbarSolid };
