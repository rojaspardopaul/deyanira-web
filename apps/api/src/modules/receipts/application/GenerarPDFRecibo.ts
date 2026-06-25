// Caso de uso: generar el PDF de un recibo (HTML del salón → Puppeteer).

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { ReciboRepositorio, ReciboPersistido } from '../domain/ports/ReciboRepositorio';
import type { ReciboRenderer } from '../domain/ports/ReciboRenderer';
import type { GeneradorPDF } from '../domain/ports/GeneradorPDF';
import { ReciboNoEncontradoError } from '../domain/errors';

export class GenerarPDFRecibo {
  constructor(
    private readonly repo: ReciboRepositorio,
    private readonly renderer: ReciboRenderer,
    private readonly pdf: GeneradorPDF,
  ) {}

  async ejecutar(ctx: ContextoTenant, id: string): Promise<{ recibo: ReciboPersistido; pdf: Buffer }> {
    const recibo = await this.repo.buscar(ctx, id);
    if (!recibo) throw new ReciboNoEncontradoError('Recibo no encontrado');
    const html = await this.renderer.html(recibo);
    const pdf = await this.pdf.render(html);
    return { recibo, pdf };
  }
}
