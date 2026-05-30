// Cabeceras Cache-Control para respuestas GET públicas cacheables.
// Permite que CDN/navegador colaboren con la caché de aplicación (src/lib/cache.js).
// `stale-while-revalidate` deja servir contenido ligeramente viejo mientras se
// revalida en background → latencia percibida casi nula.
//
// Uso: router.get('/', publicCache(60), handler)

function publicCache(maxAgeSec = 60, swrSec = 300) {
  return (_req, res, next) => {
    res.setHeader('Cache-Control', `public, max-age=${maxAgeSec}, stale-while-revalidate=${swrSec}`);
    next();
  };
}

module.exports = { publicCache };
