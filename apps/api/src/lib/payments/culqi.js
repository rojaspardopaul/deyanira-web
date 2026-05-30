const https = require('https');
const env = require('../env');
const logger = require('../logger');

const CULQI_HOST = 'api.culqi.com';
const REQUEST_TIMEOUT_MS = 15_000;

function culqiRequest(path, body, idempotencyKey) {
  return new Promise((resolve, reject) => {
    if (!env.CULQI_SECRET_KEY) {
      return reject(new Error('Culqi no configurado (falta CULQI_SECRET_KEY)'));
    }

    const data = JSON.stringify(body);
    const headers = {
      Authorization: `Bearer ${env.CULQI_SECRET_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'User-Agent': 'deyanira-web/1.0',
    };
    if (idempotencyKey) headers['Idempotency-Key'] = String(idempotencyKey).slice(0, 100);

    const options = {
      hostname: CULQI_HOST,
      path,
      method: 'POST',
      headers,
      timeout: REQUEST_TIMEOUT_MS,
    };

    const req = https.request(options, (res) => {
      let raw = '';
      let bytes = 0;
      res.on('data', (chunk) => {
        bytes += chunk.length;
        // Protege de respuestas absurdamente grandes
        if (bytes > 256 * 1024) {
          req.destroy(new Error('Culqi response too large'));
          return;
        }
        raw += chunk;
      });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(raw); }
        catch {
          logger.error('culqi_invalid_json', { status: res.statusCode });
          return reject(new Error('Respuesta inválida de Culqi'));
        }
        if (res.statusCode >= 400) {
          const msg = parsed.user_message || parsed.merchant_message || `Error Culqi ${res.statusCode}`;
          const err = new Error(msg);
          err.culqiCode = parsed.code;
          err.culqiStatus = res.statusCode;
          return reject(err);
        }
        resolve(parsed);
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Culqi request timeout'));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function createCharge({ token, amountCentimos, email, description, idempotencyKey }) {
  return culqiRequest('/v2/charges', {
    amount: amountCentimos,
    currency_code: 'PEN',
    email,
    source_id: token,
    description,
    capture: true,
  }, idempotencyKey);
}

module.exports = { createCharge };
