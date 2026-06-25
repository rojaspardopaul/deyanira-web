// Adaptador de la IA Contable con Gemini (REST, sin SDK). Pide salida JSON
// estructurada y la normaliza a MovimientoSugerido. ÚNICO lugar del módulo que
// conoce Gemini. Si no hay GEMINI_API_KEY, `disponible()` devuelve false.

import { IANoDisponibleError, IAErrorError } from '../domain/errors';
import { direccionDeTipo, TIPOS_MOVIMIENTO, METODOS_PAGO, type TipoMovimiento } from '../domain/TipoMovimiento';
import type { AsistenteContable, MovimientoSugerido } from '../domain/ports/AsistenteContable';

/* eslint-disable @typescript-eslint/no-var-requires */
const env = require('../../../lib/env') as { GEMINI_API_KEY?: string; GEMINI_MODEL?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const METODOS = new Set<string>(METODOS_PAGO as unknown as string[]);

// Instrucción común: el modelo debe responder SOLO el JSON pedido.
const SISTEMA = [
  'Eres un asistente contable para un salón de belleza en Lima, Perú (moneda PEN).',
  'Extrae los datos del movimiento financiero y responde EXCLUSIVAMENTE un JSON con esta forma:',
  '{ "tipo": "ingreso|egreso|venta|adelanto|pago_final|reembolso|ajuste|comision|impuesto",',
  '  "monto": number, "moneda": "PEN", "descripcion": string,',
  '  "fecha": "YYYY-MM-DD"|null, "categoria": string|null,',
  '  "metodoPago": "efectivo|transferencia|tarjeta|yape|plin|culqi"|null,',
  '  "contraparte": string|null, "confianza": number(0..1) }',
  'Categorías de egreso: alquiler, salarios, productos, servicios_pub, marketing, equipos, mantenimiento, transporte, impuestos, otro.',
  'Si compran insumos/productos para el salón, categoria="productos" y tipo="egreso".',
  'No inventes el monto: si no es claro, monto=null y confianza baja.',
].join('\n');

function endpoint(model: string, key: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
}

interface CrudoIA {
  tipo?: string; monto?: unknown; moneda?: string; descripcion?: string;
  fecha?: string | null; categoria?: string | null; metodoPago?: string | null;
  contraparte?: string | null; confianza?: unknown;
}

function normalizar(crudo: CrudoIA): MovimientoSugerido {
  const tipo: TipoMovimiento = TIPOS_MOVIMIENTO.includes(crudo.tipo as TipoMovimiento)
    ? (crudo.tipo as TipoMovimiento) : 'egreso';
  const montoNum = Number(crudo.monto);
  const metodo = crudo.metodoPago && METODOS.has(crudo.metodoPago) ? crudo.metodoPago : null;
  const fecha = typeof crudo.fecha === 'string' && DATE_RE.test(crudo.fecha) ? crudo.fecha : null;
  const conf = Number(crudo.confianza);
  return {
    tipo,
    direccion: direccionDeTipo(tipo),
    monto: Number.isFinite(montoNum) && montoNum > 0 ? Math.round(montoNum * 100) / 100 : null,
    moneda: 'PEN',
    descripcion: (crudo.descripcion || '').toString().slice(0, 300) || 'Movimiento',
    fecha,
    categoria: crudo.categoria ? String(crudo.categoria).slice(0, 60) : null,
    metodoPago: metodo,
    contraparte: crudo.contraparte ? String(crudo.contraparte).slice(0, 120) : null,
    confianza: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5,
  };
}

export class GeminiAsistente implements AsistenteContable {
  private readonly key = env.GEMINI_API_KEY;
  private readonly model = env.GEMINI_MODEL || 'gemini-2.5-flash';

  disponible(): boolean {
    return !!this.key;
  }

  private async generar(parts: unknown[]): Promise<MovimientoSugerido> {
    if (!this.key) throw new IANoDisponibleError('IA Contable no configurada (falta GEMINI_API_KEY)');
    let resp: Response;
    try {
      resp = await fetch(endpoint(this.model, this.key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SISTEMA }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        }),
      });
    } catch (err) {
      throw new IAErrorError(`No se pudo contactar a Gemini: ${(err as Error).message}`);
    }
    if (!resp.ok) {
      // Rescatamos el motivo real de Gemini (quota/rate limit/permiso) para no
      // dejar al usuario con un código a secas.
      let detalle = '';
      try {
        const errJson = (await resp.json()) as { error?: { message?: string; status?: string } };
        detalle = errJson?.error?.message || errJson?.error?.status || '';
      } catch {
        /* respuesta sin cuerpo JSON */
      }
      if (resp.status === 429) {
        throw new IAErrorError(
          detalle
            ? `Límite de Gemini alcanzado (429): ${detalle}`
            : 'Límite de Gemini alcanzado (429). El plan gratuito permite pocas solicitudes por minuto/día; espera un momento y reintenta.',
        );
      }
      throw new IAErrorError(detalle ? `Gemini respondió ${resp.status}: ${detalle}` : `Gemini respondió ${resp.status}`);
    }
    const data = (await resp.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new IAErrorError('Gemini no devolvió contenido');
    let crudo: CrudoIA;
    try {
      crudo = JSON.parse(text) as CrudoIA;
    } catch {
      // A veces envuelve el JSON en ```json … ```; intentamos rescatarlo.
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new IAErrorError('La IA no devolvió un JSON válido');
      crudo = JSON.parse(match[0]) as CrudoIA;
    }
    return normalizar(crudo);
  }

  interpretarTexto(prompt: string): Promise<MovimientoSugerido> {
    return this.generar([{ text: `Instrucción del usuario: "${prompt}"` }]);
  }

  analizarComprobante(fileBase64: string, mimeType: string): Promise<MovimientoSugerido> {
    // fileBase64 puede venir como data URL; extraemos solo la parte base64.
    const base64 = fileBase64.includes(',') ? fileBase64.slice(fileBase64.indexOf(',') + 1) : fileBase64;
    return this.generar([
      { text: 'Extrae el movimiento financiero de este comprobante.' },
      { inlineData: { mimeType, data: base64 } },
    ]);
  }
}
