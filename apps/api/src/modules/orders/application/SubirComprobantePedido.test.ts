import { describe, it, expect, vi } from 'vitest';
import { SubirComprobantePedido } from './SubirComprobantePedido';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { PedidoPersistido, PedidoRepositorio } from '../domain/ports/PedidoRepositorio';
import type { AlmacenComprobantes } from '../domain/ports/AlmacenComprobantes';
import type { NotificadorPedidos } from '../domain/ports/NotificadorPedidos';
import { PedidoNoEncontradoError } from '../domain/errors';

const ctx: ContextoTenant = { tenantId: 'test' };

function deps(pedido: PedidoPersistido | null) {
  const repo = {
    buscarPorId: vi.fn(async () => pedido),
    adjuntarComprobante: vi.fn(async (_c: ContextoTenant, id: string, url: string) => ({
      id, proofImageUrl: url, paymentStatus: 'awaiting_verification',
    })),
  } as unknown as PedidoRepositorio;
  const almacen: AlmacenComprobantes = { subir: vi.fn(async () => 'https://cloud/proof.jpg') };
  const notificador = { comprobanteRecibido: vi.fn() } as unknown as NotificadorPedidos;
  return { repo, almacen, notificador };
}

describe('SubirComprobantePedido', () => {
  it('sube la imagen, adjunta la URL y avisa al salón', async () => {
    const d = deps({ id: 'ord-1' });
    const uc = new SubirComprobantePedido(d.repo, d.almacen, d.notificador);
    const res = await uc.ejecutar(ctx, { id: 'ord-1', imagenDataUrl: 'data:image/png;base64,xxx' });
    expect(d.almacen.subir).toHaveBeenCalledWith('data:image/png;base64,xxx');
    expect(d.repo.adjuntarComprobante).toHaveBeenCalledWith(ctx, 'ord-1', 'https://cloud/proof.jpg');
    expect(res.proofImageUrl).toBe('https://cloud/proof.jpg');
    expect(d.notificador.comprobanteRecibido).toHaveBeenCalledOnce();
  });

  it('pedido inexistente -> PedidoNoEncontradoError', async () => {
    const d = deps(null);
    const uc = new SubirComprobantePedido(d.repo, d.almacen, d.notificador);
    await expect(uc.ejecutar(ctx, { id: 'x', imagenDataUrl: 'data:image/png;base64,xxx' })).rejects.toBeInstanceOf(PedidoNoEncontradoError);
    expect(d.almacen.subir).not.toHaveBeenCalled();
  });
});
