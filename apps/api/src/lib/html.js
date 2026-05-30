// Escape HTML para mitigar XSS en plantillas de email/HTML server-rendered.
// Usar SIEMPRE al interpolar datos del usuario (nombres, notas, captions, etc.).

const HTML_ESC = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`=/]/g, ch => HTML_ESC[ch]);
}

// Para usar dentro de atributos de URL: encodeURIComponent + escape básico.
function escapeAttr(value) {
  return escapeHtml(value);
}

module.exports = { escapeHtml, escapeAttr };
