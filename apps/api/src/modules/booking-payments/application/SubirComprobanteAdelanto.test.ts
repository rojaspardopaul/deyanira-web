import { describe, it, expect, vi } from 'vitest';
import { SubirComprobanteAdelanto } from './SubirComprobanteAdelanto';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { AdelantoRepositorio } from '../domain/ports/AdelantoRepositorio';
import type { AlmacenComprobantes } from '../domain/ports/AlmacenComprobantes';
import type { NotificadorAdelantos } from '../domain/ports/NotificadorAdelantos';
import { AdelantoNoEncontradoError, AdelantoYaPagadoError } from '../domain/errors';

const ctx: ContextoTenant = { tenantId: 'test' };
const ID = '11111111-1111-1111-1111-111111111111';

function crearDeps(o: { pago?: Record<string, unknown> | null } = {}) {
  const pago = o.pago === undefined ? { id: ID, status: 'pending' } : o.pago;
  const repo = {
    buscar: vi.fn(async () => pago),
    guardarComprobante: vi.fn(async () => ({ id: ID, status: 'awaiting_verification', customerEmail: 'ana@t.com', customerName: 'Ana' })),
  } as unknown as AdelantoRepositorio;
  const almacen = { subir: vi.fn(async () => 'https://cdn/x.jpg') } as unknown as AlmacenComprobantes;
  const notificador = { comprobanteRecibido: vi.fn(), comprobanteAlSalon: vi.fn() } as unknown as NotificadorAdelantos;
  const uc = new SubirComprobanteAdelanto(repo, almacen, notificador);
  return { uc, repo, almacen, notificador };
}

const cmd = { id: ID, imagenDataUrl: 'data:image/png;base64,xxx', method: 'yape' as const };

describe('SubirComprobanteAdelanto', () => {
  it('404 si no existe', async () => {
    const { uc } = crearDeps({ pago: null });
    await expect(uc.ejecutar(ctx, cmd)).rejects.toBeInstanceOf(AdelantoNoEncontradoError);
  });

  it('409 si ya está pagado', async () => {
    const { uc } = crearDeps({ pago: { id: ID, status: 'paid' } });
    await expect(uc.ejecutar(ctx, cmd)).rejects.toBeInstanceOf(AdelantoYaPagadoError);
  });

  it('happy: sube, guarda en verificación y avisa a cliente + salón', async () => {
    const { uc, repo, almacen, notificador } = crearDeps();
    const res = await uc.ejecutar(ctx, cmd);
    expect(almacen.subir).toHaveBeenCalledWith(cmd.imagenDataUrl);
    expect(repo.guardarComprobante).toHaveBeenCalledWith(ctx, ID, { url: 'https://cdn/x.jpg', method: 'yape' });
    expect(notificador.comprobanteRecibido).toHaveBeenCalledTimes(1);
    expect(notificador.comprobanteAlSalon).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ success: true, status: 'awaiting_verification' });
  });
});
