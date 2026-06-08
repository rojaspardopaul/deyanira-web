import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verificarFirmaCulqi } from './verificarFirmaCulqi';

const secret = 'webhook-secret-de-prueba';

function firmar(body: string, t: number): string {
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

describe('verificarFirmaCulqi', () => {
  it('firma válida y reciente -> válido', () => {
    const body = '{"id":"evt_1"}';
    const t = Math.floor(Date.now() / 1000);
    const r = verificarFirmaCulqi(secret, firmar(body, t), Buffer.from(body));
    expect(r.valido).toBe(true);
  });

  it('firma incorrecta -> 401', () => {
    const body = '{"id":"evt_1"}';
    const t = Math.floor(Date.now() / 1000);
    const v1Malo = 'a'.repeat(64);
    const r = verificarFirmaCulqi(secret, `t=${t},v1=${v1Malo}`, Buffer.from(body));
    expect(r.valido).toBe(false);
    expect(r.status).toBe(401);
  });

  it('sin secret -> 503', () => {
    expect(verificarFirmaCulqi(undefined, 'x', Buffer.from('')).status).toBe(503);
  });

  it('header mal formado -> 400', () => {
    expect(verificarFirmaCulqi(secret, 'no-es-firma', Buffer.from('{}')).status).toBe(400);
  });

  it('timestamp fuera de ventana (anti-replay) -> 400', () => {
    const body = '{}';
    const viejo = Math.floor(Date.now() / 1000) - 10000;
    const r = verificarFirmaCulqi(secret, firmar(body, viejo), Buffer.from(body));
    expect(r.valido).toBe(false);
    expect(r.status).toBe(400);
  });
});
