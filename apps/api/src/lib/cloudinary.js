const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_DECODED_BYTES = 8 * 1024 * 1024; // 8MB decoded
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function validateFileInput(file) {
  if (typeof file !== 'string' || file.length === 0) {
    const err = new Error('El archivo debe ser una cadena base64 o URL HTTPS');
    err.status = 400;
    throw err;
  }

  if (file.startsWith('data:')) {
    const mimeMatch = file.match(/^data:([^;]{1,50});base64,/);
    if (!mimeMatch) {
      const err = new Error('Formato base64 inválido');
      err.status = 400;
      throw err;
    }
    const mime = mimeMatch[1].toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      const err = new Error('Solo se permiten imágenes JPG, PNG, WebP o GIF');
      err.status = 400;
      throw err;
    }
    // base64 encodes 3 bytes as 4 chars → decoded size ≈ len * 0.75
    const base64Part = file.indexOf(',') + 1;
    const estimatedBytes = Math.ceil((file.length - base64Part) * 0.75);
    if (estimatedBytes > MAX_DECODED_BYTES) {
      const err = new Error('La imagen no puede superar 8MB');
      err.status = 400;
      throw err;
    }
  } else if (file.startsWith('https://')) {
    try {
      new URL(file);
    } catch {
      const err = new Error('URL de imagen inválida');
      err.status = 400;
      throw err;
    }
  } else {
    const err = new Error('El archivo debe ser base64 o URL HTTPS');
    err.status = 400;
    throw err;
  }
}

async function uploadImage(file, folder = 'general') {
  validateFileInput(file);

  const result = await cloudinary.uploader.upload(file, {
    folder: `deyanira/${folder}`,
    resource_type: 'image',
    transformation: [
      { quality: 'auto', fetch_format: 'auto' },
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

function imageUrl(publicId, { width = 800, height, quality = 'auto', format = 'auto' } = {}) {
  return cloudinary.url(publicId, {
    width, height, quality, fetch_format: format,
    crop: 'fill', gravity: 'auto',
  });
}

module.exports = { uploadImage, deleteImage, imageUrl };
