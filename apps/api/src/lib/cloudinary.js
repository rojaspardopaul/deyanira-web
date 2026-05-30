const cloudinary = require('cloudinary').v2;
const env = require('../lib/env');
const { BadRequest } = require('./errors');

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key:    env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

const MAX_DECODED_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
]);

// Magic bytes esperados por tipo (primeros bytes)
const MAGIC = {
  'image/jpeg':  [[0xFF, 0xD8, 0xFF]],
  'image/png':   [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif':   [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp':  [[0x52, 0x49, 0x46, 0x46]],   // 'RIFF' — luego se verifica 'WEBP' en offset 8
};

function matchesMagic(buf, mime) {
  const sigs = MAGIC[mime];
  if (!sigs) return false;
  for (const sig of sigs) {
    if (buf.length < sig.length) continue;
    let ok = true;
    for (let i = 0; i < sig.length; i++) {
      if (buf[i] !== sig[i]) { ok = false; break; }
    }
    if (ok) {
      if (mime === 'image/webp') {
        // Verificar 'WEBP' en bytes 8-11
        if (buf.length < 12) return false;
        if (buf[8] !== 0x57 || buf[9] !== 0x45 || buf[10] !== 0x42 || buf[11] !== 0x50) return false;
      }
      return true;
    }
  }
  return false;
}

function validateFileInput(file) {
  if (typeof file !== 'string' || file.length === 0) {
    throw BadRequest('El archivo debe ser una cadena base64 o URL HTTPS');
  }

  if (file.startsWith('data:')) {
    const mimeMatch = file.match(/^data:([^;]{1,50});base64,/);
    if (!mimeMatch) throw BadRequest('Formato base64 inválido');
    const mime = mimeMatch[1].toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      throw BadRequest('Solo se permiten imágenes JPG, PNG, WebP o GIF');
    }
    const base64Part = file.indexOf(',') + 1;
    const estimatedBytes = Math.ceil((file.length - base64Part) * 0.75);
    if (estimatedBytes > MAX_DECODED_BYTES) throw BadRequest('La imagen no puede superar 8MB');

    // Verificar magic bytes contra el MIME declarado
    let head;
    try {
      head = Buffer.from(file.slice(base64Part, base64Part + 64), 'base64');
    } catch {
      throw BadRequest('Base64 inválido');
    }
    if (!matchesMagic(head, mime)) {
      throw BadRequest('El contenido del archivo no coincide con el tipo declarado');
    }
  } else if (file.startsWith('https://')) {
    let url;
    try { url = new URL(file); } catch { throw BadRequest('URL de imagen inválida'); }
    // Whitelist de hosts permitidos (no fetch arbitrario → SSRF)
    const ALLOWED_HOSTS = ['res.cloudinary.com'];
    const isAllowed = ALLOWED_HOSTS.some(h => url.hostname === h || url.hostname.endsWith(`.${h}`))
      || url.hostname.endsWith('.supabase.co');
    if (!isAllowed) throw BadRequest('URL de imagen no permitida');
  } else {
    throw BadRequest('El archivo debe ser base64 o URL HTTPS');
  }
}

async function uploadImage(file, folder = 'general') {
  validateFileInput(file);
  const result = await cloudinary.uploader.upload(file, {
    folder: `deyanira/${folder}`,
    resource_type: 'image',
    overwrite: false,
    invalidate: true,
    transformation: [
      { quality: 'auto', fetch_format: 'auto' },
      { width: 2400, crop: 'limit' },  // límite máximo razonable
    ],
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
  };
}

async function deleteImage(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska',
]);
const MAX_VIDEO_DECODED_BYTES = 50 * 1024 * 1024; // 50 MB

function validateVideoInput(file) {
  if (typeof file !== 'string' || file.length === 0) {
    throw BadRequest('El archivo debe ser una cadena base64');
  }
  if (!file.startsWith('data:')) {
    throw BadRequest('El archivo debe ser base64 (data:video/…;base64,…)');
  }
  const mimeMatch = file.match(/^data:([^;]{1,60});base64,/);
  if (!mimeMatch) throw BadRequest('Formato base64 inválido');
  const mime = mimeMatch[1].toLowerCase();
  if (!ALLOWED_VIDEO_MIME.has(mime)) {
    throw BadRequest('Solo se permiten videos MP4, WebM, MOV o MKV');
  }
  const base64Part = file.indexOf(',') + 1;
  const estimatedBytes = Math.ceil((file.length - base64Part) * 0.75);
  if (estimatedBytes > MAX_VIDEO_DECODED_BYTES) throw BadRequest('El video no puede superar 50 MB');
}

async function uploadVideo(file, folder = 'general') {
  validateVideoInput(file);
  const result = await cloudinary.uploader.upload(file, {
    folder: `deyanira/${folder}`,
    resource_type: 'video',
    overwrite: false,
    invalidate: true,
    // Optimización automática + h.264 para máxima compatibilidad
    eager: [
      { quality: 'auto', fetch_format: 'mp4' },
    ],
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    duration: result.duration,
  };
}

function imageUrl(publicId, { width = 800, height, quality = 'auto', format = 'auto' } = {}) {
  return cloudinary.url(publicId, {
    width, height, quality, fetch_format: format,
    crop: 'fill', gravity: 'auto',
  });
}

module.exports = { uploadImage, uploadVideo, deleteImage, imageUrl };
