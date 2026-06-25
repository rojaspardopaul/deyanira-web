// Adaptador HTML→PDF con Puppeteer (Chromium headless). Reusa una sola instancia
// de navegador (lazy) para no pagar el arranque en cada recibo. El import es
// dinámico para no cargar Chromium hasta que realmente se genere un PDF.

import type { GeneradorPDF } from '../domain/ports/GeneradorPDF';

/* eslint-disable @typescript-eslint/no-explicit-any */
let browserPromise: Promise<any> | null = null;

async function getBrowser(): Promise<any> {
  if (!browserPromise) {
    const puppeteer = (await import('puppeteer')).default as any;
    browserPromise = puppeteer.launch({
      headless: true,
      // En contenedor usamos el Chromium del sistema (Alpine). En local/Windows,
      // si no está seteada la env, puppeteer usa su Chromium empaquetado.
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
