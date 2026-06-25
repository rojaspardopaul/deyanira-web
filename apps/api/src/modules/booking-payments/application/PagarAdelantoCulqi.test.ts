import { describe, it, expect, vi } from 'vitest';
import { PagarAdelantoCulqi } from './PagarAdelantoCulqi';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { AdelantoRepositorio, LiquidacionAdelanto } from '../domain/ports/AdelantoRepositorio';
import type { PasarelaPagos, ErrorPasarela } from '../domain/ports/PasarelaPagos';
import type { NotificadorAdelantos } from '../domain/ports/NotificadorAdelantos';
import {
  AdelantoNoEncontradoError, AdelantoYaPagadoError, EmailNoCoincideError, MontoMinimoError, PagoRechazadoError,
} from '../domain/errors';

const ctx: ContextoTenant = { tenantId: 'test' };
const ID = '11111111-1111-1111-1111-111111111111';

const liquidacion: LiquidacionAdelanto = {
  payment: { id: ID, receiptNumber: 'DMB-001', customerEmail: 'ana@t.com', customerName: 'Ana' },
  appointments: [{ id: 'a1' }],
  packageInfo: null,
};

function crearDeps(o: { pago?: Record<string, unknown> | null; cargoError?: ErrorPasarela; registrarThrows?: Error } = {}) {
  const pago = o.pago === undefined
    ? { id: ID, status: 'pending', depositPen: 500, customerEmail: 'ana@t.com', customerName: 'Ana' }
    : o.pago;
  const buscar = vi.fn(async () => pago);
  const registrarPago = o.registrarThrows
    ? vi.fn(async () => { throw o.registrarThrows; })
    : vi.fn(async () => liquidacion);
  const repo = { buscar, registrarPago } as unknown as AdelantoRepositorio;

  const crearCargo = o.cargoError
    ? vi.fn(async () => { throw o.cargoError; })
    : vi.fn(async () => ({ id: 'chg_1' }));
  const pasarela = { crearCargo } as unknown as PasarelaPagos;

  const notificador = { confirmacionYRecibo: vi.fn() } as unknown as NotificadorAdelantos;
  const uc = new PagarAdelantoCulqi(repo, pasarela, notificador);
  return { uc, repo, pasarela, notificador, registrarPago, crearCargo };
}

const cmd = { id: ID, culqiToken: 'tok_123456789', email: 'ana@t.com' };

describe('PagarAdelantoCulqi', () => {
  it('404 si no existe', async () => {
    const { uc } = crearDeps({ pago: null });
    await expect(uc.ejecutar(ctx, cmd)).rejects.toBeInstanceOf(AdelantoNoEncontradoError);
  });

  it('409 si ya está pagado', async () => {
    const { uc } = crearDeps({ pago: { id: ID, status: 'paid', depositPen: 500, customerEmail: 'ana@t.com' } });
    await expect(uc.ejecutar(ctx, cmd)).rejects.toBeInstanceOf(AdelantoYaPagadoError);
  });

  it('400 si el email no coincide con el de la reserva', async () => {
    const { uc } = crearDeps();
    await expect(uc.ejecutar(ctx, { ...cmd, email: 'otro@t.com' })).rejects.toBeInstanceOf(EmailNoCoincideError);
  });

  it('400 si el monto no alcanza el mínimo', async () => {
    const { uc } = crearDeps({ pago: { id: ID, status: 'pending', depositPen: 0.5, customerEmail: 'ana@t.com' } });
    await expect(uc.ejecutar(ctx, cmd)).rejects.toBeInstanceOf(MontoMinimoError);
  });

  it('happy: cobra, liquida, notifica y devuelve el recibo', async () => {
    const { uc, registrarPago, notificador } = crearDeps();
    const res = await uc.ejecutar(ctx, cmd);
    expect(res).toEqual({ success: true, receiptNumber: 'DMB-001' });
    expect(registrarPago).toHaveBeenCalledWith(ctx, ID, { method: 'culqi', culqiChargeId: 'chg_1' });
    expect(notificador.confirmacionYRecibo).toHaveBeenCalledTimes(1);
  });

  it('already_exists: liquida igual (idempotente) y marca alreadyPaid', async () => {
    const err = Object.assign(new Error('ya'), { culqiCode: 'already_exists' }) as ErrorPasarela;
    const { uc } = crearDeps({ cargoError: err });
    const res = await uc.ejecutar(ctx, cmd);
    expect(res).toEqual({ success: true, alreadyPaid: true, receiptNumber: 'DMB-001' });
  });

  it('already_exists + ya liquidado: devuelve alreadyPaid sin fallar', async () => {
    const err = Object.assign(new Error('ya'), { culqiCode: 'already_exists' }) as ErrorPasarela;
    const { uc } = crearDeps({ cargoError: err, registrarThrows: new AdelantoYaPagadoError('ya') });
    const res = await uc.ejecutar(ctx, cmd);
    expect(res).toEqual({ success: true, alreadyPaid: true });
  });

  it('otro error de Culqi → PagoRechazado', async () => {
    const err = Object.assign(new Error('tarjeta rechazada'), { culqiCode: 'card_declined' }) as ErrorPasarela;
    const { uc } = crearDeps({ cargoError: err });
    await expect(uc.ejecutar(ctx, cmd)).rejects.toBeInstanceOf(PagoRechazadoError);
  });
});
