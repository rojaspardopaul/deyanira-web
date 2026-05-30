// Logger estructurado JSON-line. Evita console.error con strings interpolados
// que pueden filtrar secretos.

const SENSITIVE_KEYS = new Set([
  'password', 'passwordhash', 'password_hash',
  'token', 'access_token', 'refresh_token', 'admin_token', 'culqitoken',
  'authorization', 'cookie', 'set-cookie',
  'api_key', 'apikey', 'secret', 'jwt', 'session',
]);

function redact(value, depth = 0) {
  if (depth > 4) return '[Truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > 2000 ? value.slice(0, 2000) + '…' : value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map(v => redact(v, depth + 1));

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

function emit(level, msg, meta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ? { meta: redact(meta) } : {}),
  };
  // Una línea, JSON-parseable por colectores (Datadog, CloudWatch, etc.)
  const line = JSON.stringify(entry);
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

const logger = {
  info:  (msg, meta) => emit('info',  msg, meta),
  warn:  (msg, meta) => emit('warn',  msg, meta),
  error: (msg, meta) => emit('error', msg, meta),
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== 'production') emit('debug', msg, meta);
  },
};

module.exports = logger;
