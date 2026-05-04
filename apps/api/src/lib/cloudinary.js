const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Sube un archivo base64 o URL a Cloudinary
 * @param {string} file — base64 data URI o URL pública
 * @param {string} folder — carpeta en Cloudinary (ej: "galeria", "productos")
 */
async function uploadImage(file, folder = 'general') {
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

/**
 * Elimina una imagen de Cloudinary
 */
async function deleteImage(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

/**
 * Genera URL transformada (resize, formato, calidad)
 */
function imageUrl(publicId, { width = 800, height, quality = 'auto', format = 'auto' } = {}) {
  return cloudinary.url(publicId, {
    width, height, quality, fetch_format: format,
    crop: 'fill', gravity: 'auto',
  });
}

module.exports = { uploadImage, deleteImage, imageUrl };
