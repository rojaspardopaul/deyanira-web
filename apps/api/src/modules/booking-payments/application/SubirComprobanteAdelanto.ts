// Caso de uso: subir comprobante de adelanto (Yape/Plin/transferencia). Queda en
// verificación del admin. Equivale a POST /api/booking-payments/:id/proof.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { AdelantoNoEncontradoError, AdelantoYaPagadoError } from '../domain/errors';
import type { AdelantoRepositorio } from '../domain/ports/AdelantoRepositorio';
import type { AlmacenComprobantes } from '../domain/ports/AlmacenComprobantes';
import type { NotificadorAdelantos } from '../domain/ports/NotificadorAdelantos';

export interface SubirComprobanteComando {
  readonly id: string;
  readonly imagenDataUrl: string;
  readonly method: 'yape' | 'plin' | 'transfer';
}

export class SubirComprobanteAdelanto {
  constructor(
    private readonly repo: AdelantoRepositorio,
    private readonly almacen: AlmacenComprobantes,
    private readonly notificador: NotificadorAdelantos,
  ) {}

  async ejecutar(ctx: ContextoTenant, c: SubirComprobanteComando): Promise<{ success: true; status: string }> {
    const pago = await this.repo.buscar(ctx, c.id);
    if (!pago) throw new AdelantoNoEncontradoError('Reserva no encontrada');
    if (pago.status === 'paid') throw new AdelantoYaPagadoError('Este adelanto ya fue confirmado');

    const url = await this.almacen.subir(c.imagenDataUrl);
    const actualizado = await this.repo.guardarComprobante(ctx, c.id, { url, method: c.method });

    const email = actualizado.customerEmail as string | null;
    if (email) {
      this.notificador.comprobanteRecibido(actualizado, {
        email,
        nombre: (actualizado.customerName as string | null) || 'Cliente',
      });
    }
    this.notificador.comprobanteAlSalon(actualizado);

    return { success: true, status: 'awaiting_verification' };
  }
}
