// Caché in-memory con TTL (proceso único). Pensada para lecturas calientes y
// casi-estáticas (settings, servicios, staff, catálogos) y para contadores de
// abuso por IP. NO usar para datos por-usuario sensibles ni para coordinación
// entre instancias — si se escala horizontalmente, migrar a Redis.

const { LRUCache } = require('lru-cache');

const DEFAULT_TTL = 5 * 60 * 1000; // 5 min

const store = new LRUCache({
  max: 5000,            // tope de entradas; evita crecer sin límite
  ttl: DEFAULT_TTL,     // TTL por defecto (sobreescribible por entrada)
  ttlAutopurge: true,   // purga entradas vencidas en background
});

function get(key) {
  return store.get(key);
}

function set(key, value, ttlMs) {
  store.set(key, value, ttlMs ? { ttl: ttlMs } : undefined);
  return value;
}

function del(key) {
  store.delete(key);
}

// Devuelve el valor cacheado o ejecuta loader(), cachea y devuelve.
// Coalesce de peticiones concurrentes: si dos requests piden la misma key a la
// vez, comparten la misma promesa (evita estampida de queries a la BD).
const _inflight = new Map();
async function wrap(key, ttlMs, loader) {
  const cached = store.get(key);
  if (cached !== undefined) return cached;

  if (_inflight.has(key)) return _inflight.get(key);

  const p = (async () => {
    try {
      const value = await loader();
      set(key, value, ttlMs);
      return value;
    } finally {
      _inflight.delete(key);
    }
  })();
  _inflight.set(key, p);
  return p;
}

// Invalida todas las entradas cuya key empieza por alguno de los prefijos dados.
// Ej.: invalidate('services') borra 'services:list', 'services:categories', etc.
function invalidate(...prefixes) {
  if (!prefixes.length) return;
  for (const key of store.keys()) {
    if (prefixes.some(p => key === p || key.startsWith(`${p}:`))) {
      store.delete(key);
    }
  }
}

function clear() {
  store.clear();
}

module.exports = { get, set, del, wrap, invalidate, clear, store };
