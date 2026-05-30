// Cifrado simétrico AES-256-GCM para secretos en reposo (MFA secret).
// La clave se deriva de ADMIN_JWT_SECRET con scrypt para no agregar otra env var.
// Si rotas ADMIN_JWT_SECRET, los secretos cifrados quedan inservibles — esto es
// intencional: rotar JWT también invalida MFA secrets y obliga re-enrollment.

const crypto = require('crypto');
const env = require('./env');

let _key = null;
function getKey() {
  if (_key) return _key;
  // 32 bytes para AES-256
  _key = crypto.scryptSync(env.ADMIN_JWT_SECRET, 'deyanira-mfa-v1', 32);
  return _key;
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12); // 96 bits, GCM standard
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Formato: v1.<base64url(iv)>.<base64url(ct)>.<base64url(tag)>
  return `v1.${iv.toString('base64url')}.${ct.toString('base64url')}.${tag.toString('base64url')}`;
}

function decrypt(token) {
  if (typeof token !== 'string' || !token.startsWith('v1.')) {
    throw new Error('Token cifrado inválido');
  }
  const [, ivB64, ctB64, tagB64] = token.split('.');
  const iv  = Buffer.from(ivB64,  'base64url');
  const ct  = Buffer.from(ctB64,  'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

// Hash sha256 hex (para tokens de reset, códigos de backup MFA, etc.)
function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

// Generador de tokens criptográficamente seguros, devuelve base64url
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

module.exports = { encrypt, decrypt, sha256Hex, randomToken };
