// Audit log middleware para mutaciones admin.
// Captura: actor, acción, entidad, IP, UA, status y diff sanitizado.
// Append-only (no UPDATE/DELETE desde la app).

const prisma = require('./prisma');
const logger = require('./logger');

// Map de paths → action friendly name. Si no matchea, se infiere de method + path.
function inferAction(method, path) {
  // /api/admin/<entity>/<id?>...
  const m = path.match(/^\/api\/admin\/([a-z-]+)(?:\/([^/?]+))?(.*)?/i);
  if (!m) return `admin.${method.toLowerCase()}`;
  const entity = m[1];
  const verb = ({ GET: 'read', POST: 'create', PATCH: 'update', PUT: 'replace', DELETE: 'delete' })[method] || method.toLowerCase();
  return `admin.${entity}.${verb}`;
}

function inferEntity(path) {
  const m = path.match(/^\/api\/admin\/([a-z-]+)/i);
  if (!m) return null;
  return m[1];
}

function inferEntityId(path) {
  const m = path.match(/^\/api\/admin\/[a-z-]+\/([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

const SENSITIVE_FIELDS = new Set([
  'password', 'passwordHash', 'mfaSecret', 'mfaBackupCodes',
  'token', 'tokenHash', 'apiKey', 'apiSecret',
]);

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.slice(0, 50).map(sanitize);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(k)) out[k] = '[REDACTED]';
    else if (typeof v === 'object' && v !== null) out[k] = sanitize(v);
    else if (typeof v === 'string' && v.length > 500) out[k] = v.slice(0, 500) + '…';
    else out[k] = v;
  }
  return out;
}

// Sólo registramos mutaciones (no GETs). Configurable.
const TRACKED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function auditMiddleware(req, res, next) {
  if (!TRACKED_METHODS.has(req.method)) return next();
  if (!req.admin) return next();
  // El handler ya corrió antes de logging — interceptamos res.end()
  const start = Date.now();
  const bodySnapshot = sanitize(req.body);

  res.on('finish', () => {
    // Sólo persistimos 2xx/4xx — los 5xx ya están en logger.error
    if (res.statusCode >= 500) return;

    prisma.auditLog.create({
      data: {
        actorId:    req.admin?.id || null,
        actorEmail: req.admin?.email || null,
        action:     inferAction(req.method, req.path),
        entity:     inferEntity(req.path),
        entityId:   inferEntityId(req.path) || (typeof bodySnapshot?.id === 'string' ? bodySnapshot.id : null),
        method:     req.method,
        path:       req.path.slice(0, 500),
        ip:         req.ip,
        userAgent:  (req.headers['user-agent'] || '').slice(0, 300),
        changes:    bodySnapshot || null,
        statusCode: res.statusCode,
        requestId:  req.id || null,
      },
    }).catch((err) => {
      // Audit log NUNCA debe romper el response
      logger.error('audit_log_failed', { msg: err.message, path: req.path, ms: Date.now() - start });
    });
  });

  next();
}

module.exports = { auditMiddleware };
