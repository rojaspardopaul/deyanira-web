// Adaptador HTML→PDF con Puppeteer (Chromium headless). Reusa una sola instancia
// de navegador (lazy) para no pagar el arranque en cada recibo. El import es
// dinámico para no cargar Chromium hasta que realmente se genere un PDF.

import { existsSync } from 'node:fs';
import type { GeneradorPDF } from '../domain/ports/GeneradorPDF';

/* eslint-disable @typescript-eslint/no-explicit-any */
let browserPromise: Promise<any> | null = null;

// Resuelve el binario de Chromium: primero PUPPETEER_EXECUTABLE_PATH, luego rutas
// típicas de Alpine (varía entre versiones: chromium vs chromium-browser). En
// local (Windows/Mac) devuelve undefined → puppeteer usa su Chromium empaquetado.
function resolveChromium(): string | undefined {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/lib/chromium/chromium']) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

async function getBrowser(): Promise<any> {
  if (!browserPromise) {
    const puppeteer = (await import('puppeteer')).default as any;
    const executablePath = resolveChromium();
    browserPromise = puppeteer
      .launch({
        headless: true,
        executablePath,
        // Flags imprescindibles en contenedor: sin sandbox (corre headless como
        // root) y sin /dev/shm (diminuto en contenedores → Chromium crashea).
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      })
      .catch((e: unknown) => {
        browserPromise = null; // permite reintentar en la próxima llamada
        // eslint-disable-next-line no-console
        console.error('[pdf] puppeteer.launch falló', { executablePath, msg: (e as Error).message });
        throw e;
      });
  }
  return browserPromise;
}

export class PdfPuppeteer implements GeneradorPDF {
  async render(html: string): Promise<Buffer> {
    let browser = await getBrowser();
    let page;
    try {
      page = await browser.newPage();
    } catch {
      // El navegador pudo cerrarse/crashear: reinícialo y reintenta una vez.
      browserPromise = null;
      browser = await getBrowser();
      page = await browser.newPage();
    }
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => {});
    }
  }
}
