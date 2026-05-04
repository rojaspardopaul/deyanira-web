const https = require('https');

const CULQI_BASE = 'api.culqi.com';

function culqiRequest(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: CULQI_BASE,
      path,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CULQI_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.user_message || parsed.merchant_message || 'Error Culqi'));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error('Respuesta inválida de Culqi'));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Crea un cargo en Culqi
 * @param {string} token — token generado en el frontend con Culqi.js
 * @param {number} amountCentimos — monto en céntimos de sol (ej: 5000 = S/ 50.00)
 * @param {string} email
 * @param {string} description
 */
async function createCharge({ token, amountCentimos, email, description }) {
  return culqiRequest('/v2/charges', {
    amount: amountCentimos,
    currency_code: 'PEN',
    email,
    source_id: token,
    description,
    capture: true,
  });
}

module.exports = { createCharge };
