// Caso de uso: enviar el recibo al cliente por correo con el PDF adjunto (acción
// manual del admin). Requiere que el recibo tenga correo del cliente.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { ReciboRepositorio } from '../domain/ports/ReciboRepositorio';
import type { ReciboRenderer } from '../domain/ports/ReciboRenderer';
import type { GeneradorPDF } from '../domain/ports/GeneradorPDF';
import type { NotificadorRecibos } from '../domain/ports/NotificadorRecibos';
import { ReciboNoEncontradoError, ReciboSinCorreoError } from '../domain/errors';

export class EnviarReciboPorCorreo {
  constructor(
    private readonly repo: ReciboRepositorio,
    private readonly renderer: ReciboRenderer,
    private readonly pdf: GeneradorPDF,
    private readonly notificador: NotificadorRecibos,
  ) {}

  async ejecutar(ctx: ContextoTenant, id: string): Promise<{ sent: true; email: string }> {
    const recibo = await this.repo.buscar(ctx, id);
    if (!recibo) throw new ReciboNoEncontradoError('Recibo no encontrado');
    const email = recibo.customerEmail?.trim();
    if (!email) throw new ReciboSinCorreoError('El recibo no tiene correo del cliente');

    const html = await this.renderer.html(recibo);
    const pdf = await this.pdf.render(html);
    await this.notificador.enviarRecibo(recibo, pdf, { email, nombre: recibo.customerName || 'Cliente' });
    return { sent: true, email };
  }
}
