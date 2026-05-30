// MFA TOTP (RFC 6238) — compatible Google Authenticator / Authy / 1Password.
// Usa otplib (RFC-compliant, mantenido).
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

const { encrypt, decrypt, sha256Hex, randomToken } = require('./crypto');

// Ventana de ±1 (tolerancia de 30s antes/después)
authenticator.options = { window: 1, step: 30 };

const ISSUER = 'Deyanira Admin';

function generateSecret() {
  return authenticator.generateSecret(); // 32 chars base32
}

function otpauthUri(email, secret) {
  return authenticator.keyuri(email, ISSUER, secret);
}

async function qrDataUrl(email, secret) {
  const uri = otpauthUri(email, secret);
  return QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 1, width: 256 });
}

function verifyTotp(secret, code) {
  if (typeof secret !== 'string' || typeof code !== 'string') return false;
  // Quita espacios que copy/paste mete
  const clean = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  try {
    return authenticator.verify({ token: clean, secret });
  } catch {
    return false;
  }
}

// Genera 10 códigos de backup. Devolvemos los plain (mostrar UNA VEZ al usuario)
// y los hashes para persistir.
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // 10 chars base32-like — fácil de copiar
    codes.push(randomToken(6).replace(/[-_]/g, '').slice(0, 10).toUpperCase());
  }
  return {
    plain: codes,
    hashes: codes.map(c => sha256Hex(c)),
  };
}

// Verifica un backup code; si matchea, devuelve la lista nueva sin él (uso único).
function consumeBackupCode(plainHashes, candidate) {
  if (!Array.isArray(plainHashes) || !candidate) return null;
  const h = sha256Hex(candidate.replace(/\s/g, '').toUpperCase());
  const idx = plainHashes.indexOf(h);
  if (idx === -1) return null;
  const next = plainHashes.slice();
  next.splice(idx, 1);
  return next;
}

module.exports = {
  generateSecret,
  otpauthUri,
  qrDataUrl,
  verifyTotp,
  generateBackupCodes,
  consumeBackupCode,
  encrypt,    // re-exportadas para conveniencia
  decrypt,
};
