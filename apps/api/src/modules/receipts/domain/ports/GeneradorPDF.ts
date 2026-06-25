// Puerto: convierte HTML en un PDF (Buffer). La implementación (Puppeteer) vive
// en infrastructure/. El dominio no conoce la librería.

export interface GeneradorPDF {
  render(html: string): Promise<Buffer>;
}
