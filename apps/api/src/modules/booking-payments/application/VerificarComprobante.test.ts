import { describe, it, expect, vi } from 'vitest';
import { VerificarComprobante } from './VerificarComprobante';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { AdelantoRepositorio, LiquidacionAdelanto } from '../domain/ports/AdelantoRepositorio';
import type { NotificadorAdelantos } from '../domain/ports/NotificadorAdelantos';
import { AdelantoNoEncontradoError } from '../domain/errors';

const ctx: ContextoTenant = { tenantId: 'test' };
const ID = '11111111-1111-1111-1111-111111111111';
const liquidacion: LiquidacionAdelanto = {
  payment: { id: ID, receiptNumber: 'DMB-001', customerEmail: 'ana@t.com', customerName: 'Ana' },
  appointments: [{ id: 'a1' }],
  packageInfo: null,
};

function crearDeps(o: { pago?: Record<string, unknown> | null } = {}) {
  const pago = o.pago === undefined ? { id: ID, status: 'awaiting_verification', method: 'yape', notes: null } : o.pago;
  const repo = {
    buscar: vi.fn(async () => pago),
    rechazar: vi.fn(async () => ({ id: ID, status: 'rejected' })),
    registrarPago: vi.fn(async () => liquidacion),
  } as unknown as AdelantoRepositorio;
  const notificador = { confirmacionYRecibo: vi.fn() } as unknown as NotificadorAdelantos;
  const uc = new VerificarComprobante(repo, notificador);
  return { uc, repo, notificador };
}

describe('VerificarComprobante', () => {
  it('404 si no existe', async () => {
    const { uc } = crearDeps({ pago: null });
    await expect(uc.ejecutar(ctx, { id: ID, approved: true, verifiedBy: 'a1' })).rejects.toBeInstanceOf(AdelantoNoEncontradoError);
  });

  it('rechazar: marca rejected y NO notifica', async () => {
    const { uc, repo, notificador } = crearDeps();
    await uc.ejecutar(ctx, { id: ID, approved: false, notes: 'borroso', verifiedBy: 'a1' });
    expect(repo.rechazar).toHaveBeenCalledWith(ctx, ID, { notes: 'borroso', verifiedBy: 'a1' });
    expect(repo.registrarPago).not.toHaveBeenCalled();
    expect(notificador.confirmacionYRecibo).not.toHaveBeenCalled();
  });

  it('aprobar: liquida y envía confirmación + recibo', async () => {
    const { uc, repo, notificador } = crearDeps();
    const pago = await uc.ejecutar(ctx, { id: ID, approved: true, verifiedBy: 'a1' });
    expect(repo.registrarPago).toHaveBeenCalledWith(ctx, ID, { method: 'yape', verifiedBy: 'a1' });
    expect(notificador.confirmacionYRecibo).toHaveBeenCalledTimes(1);
    expect(pago).toMatchObject({ id: ID, receiptNumber: 'DMB-001' });
  });
});
