// Verificación de la firma HMAC del webhook de Culqi. Lógica de seguridad pura,
// réplica fiel del legacy: anti-replay por timestamp + HMAC en tiempo constante.
// Vive en infraestructura (concern de transporte/seguridad, usa crypto).

import crypto from 'crypto';

const MAX_SIGNATURE_AGE_S = 5 * 60;

export interface ResultadoVerificacion {
  readonly valido: boolean;
  readonly motivo?: string;
  readonly status?: number;
}

interface FirmaParseada {
  t: number;
  v1: string;
}

function parseSignature(header: unknown): FirmaParseada | null {
  if (typeof header !== 'string') return null;
  const out: Record<string, string> = {};
  for (const p of header.split(',').map((s) => s.trim())) {
    const [k, v] = p.split('=');
    if (k && v) out[k] = v;
  }
  if (!out.t || !out.v1) return null;
  return { t: parseInt(out.t, 10), v1: out.v1 };
}

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export function verificarFirmaCulqi(
  secret: string | undefined,
  signatureHeader: unknown,
  rawBody: Buffer,
): ResultadoVerificacion {
  if (!secret) return { valido: false, motivo: 'Webhook deshabilitado', status: 503 };

  const sig = parseSignature(signatureHeader);
  if (!sig) return { valido: false, motivo: 'Firma ausente o mal formada', status: 400 };

  const nowS = Math.floor(Date.now() / 1000);
  if (Math.abs(nowS - sig.t) > MAX_SIGNATURE_AGE_S) {
    return { valido: false, motivo: 'Timestamp fuera de ventana', status: 400 };
  }

  // El payload firmado es "<t>.<rawBody>".
  const payload = `${sig.t}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  if (!constantTimeEq(expected, sig.v1)) {
    return { valido: false, motivo: 'Firma inválida', status: 401 };
  }

  return { valido: true };
}
