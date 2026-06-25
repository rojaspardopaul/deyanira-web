import { describe, it, expect, vi } from 'vitest';
import { ProcesarPagoCulqi } from './ProcesarPagoCulqi';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { PedidoPago, PedidosParaPago } from '../domain/ports/PedidosParaPago';
import type { PasarelaPagos } from '../domain/ports/PasarelaPagos';
import type { NotificadorPagos } from '../domain/ports/NotificadorPagos';
import {
  EmailNoCoincideError,
  MontoMinimoError,
  PagoRechazadoError,
  PedidoCanceladoError,
  PedidoNoEncontradoError,
  PedidoYaPagadoError,
} from '../domain/errors';

const ctx: ContextoTenant = { tenantId: 'test' };

const order = (over: Partial<PedidoPago> = {}): PedidoPago => ({
  id: 'ord-1', paymentStatus: 'pending', status: 'pending', shipEmail: 'a@t.com', totalPen: 150, ...over,
});

interface Over {
  pedido?: PedidoPago | null;
  cargoError?: { culqiCode?: string; message?: string };
  marcarCount?: number;
}

function deps(o: Over = {}) {
  const pedidos = {
    buscar: vi.fn(async () => (o.pedido === undefined ? order() : o.pedido)),
    marcarPagado: vi.fn(async () => ({ count: o.marcarCount ?? 1, pedido: { id: 'ord-1', shipEmail: 'a@t.com' } })),
  } as unknown as PedidosParaPago;
  const pasarela = {
    crearCargo: vi.fn(async () => {
      if (o.cargoError) {
        const e = new Error(o.cargoError.message || 'rechazado') as Error & { culqiCode?: string };
        e.culqiCode = o.cargoError.culqiCode;
        throw e;
      }
      return { id: 'chg_123' };
    }),
  } as unknown as PasarelaPagos;
  const notificador: NotificadorPagos = { pedidoConfirmado: vi.fn() };
  return { pedidos, pasarela, notificador };
}

const cmd = { orderId: 'ord-1', culqiToken: 'tkn_1234567890', email: 'a@t.com' };

function run(d: ReturnType<typeof deps>, c = cmd) {
  return new ProcesarPagoCulqi(d.pedidos, d.pasarela, d.notificador).ejecutar(ctx, c);
}

describe('ProcesarPagoCulqi', () => {
  it('happy path: cobra, marca pagado y notifica', async () => {
    const d = deps();
    const r = await run(d);
    expect(r).toEqual({ success: true, orderId: 'ord-1' });
    expect(d.pasarela.crearCargo).toHaveBeenCalledOnce();
    expect(d.notificador.pedidoConfirmado).toHaveBeenCalledOnce();
  });

  it('pedido inexistente', async () => {
    await expect(run(deps({ pedido: null }))).rejects.toBeInstanceOf(PedidoNoEncontradoError);
  });

  it('ya pagado', async () => {
    await expect(run(deps({ pedido: order({ paymentStatus: 'paid' }) }))).rejects.toBeInstanceOf(PedidoYaPagadoError);
  });

  it('cancelado', async () => {
    await expect(run(deps({ pedido: order({ status: 'cancelled' }) }))).rejects.toBeInstanceOf(PedidoCanceladoError);
  });

  it('email no coincide', async () => {
    await expect(run(deps(), { ...cmd, email: 'otro@t.com' })).rejects.toBeInstanceOf(EmailNoCoincideError);
  });

  it('monto mínimo no alcanzado', async () => {
    await expect(run(deps({ pedido: order({ totalPen: 0.5 }) }))).rejects.toBeInstanceOf(MontoMinimoError);
  });

  it('cargo already_exists -> alreadyPaid', async () => {
    const d = deps({ cargoError: { culqiCode: 'already_exists' } });
    const r = await run(d);
    expect(r).toEqual({ success: true, alreadyPaid: true });
    expect(d.notificador.pedidoConfirmado).toHaveBeenCalledOnce();
  });

  it('cargo rechazado por Culqi -> PagoRechazadoError', async () => {
    await expect(run(deps({ cargoError: { culqiCode: 'card_declined', message: 'Tarjeta rechazada' } }))).rejects.toBeInstanceOf(PagoRechazadoError);
  });

  it('carrera: marcarPagado count 0 -> ya pagado', async () => {
    await expect(run(deps({ marcarCount: 0 }))).rejects.toBeInstanceOf(PedidoYaPagadoError);
  });
});
