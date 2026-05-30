// Invoca el webhook /api/revalidate del frontend Next para purgar su caché de
// datos on-demand tras una mutación admin. Fire-and-forget: nunca bloquea ni
// rompe la respuesta admin. No-op si falta configuración (dev/local).

const env = require('./env');
const logger = require('./logger');

async function revalidateFrontend(tags) {
  const base = env.NEXT_PUBLIC_WEB_URL || env.FRONTEND_URL;
  const secret = env.REVALIDATE_SECRET;
  if (!base || !secret || !Array.isArray(tags) || tags.length === 0) return; // no-op

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ tags }),
      signal: ctrl.signal,
    });
    if (!res.ok) logger.warn('revalidate_failed', { status: res.status, tags });
  } catch (err) {
    logger.warn('revalidate_error', { msg: err.message, tags });
  } finally {
    clearTimeout(t);
  }
}

module.exports = { revalidateFrontend };
