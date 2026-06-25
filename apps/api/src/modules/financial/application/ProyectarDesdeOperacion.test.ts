import { describe, it, expect, vi } from 'vitest';
import { ProyectarDesdeOperacion } from './ProyectarDesdeOperacion';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type {
  MovimientoRepositorio,
  MovimientoPersistido,
  ClaveOrigen,
} from '../domain/ports/MovimientoRepositorio';
import type { DatosNuevoMovimiento } from '../domain/Movimiento';

const ctx: ContextoTenant = { tenantId: 'test' };

// Repo en memoria que respeta la idempotencia por clave de origen.
function repoEnMemoria() {
  const filas: { clave: string; mov: MovimientoPersistido }[] = [];
  const claveStr = (k: ClaveOrigen) =>
    [k.source, k.type, k.appointmentId, k.bookingPaymentId, k.orderId, k.expenseId, k.otherIncomeId].join('|');

  const repo = {
    guardarIdempotente: vi.fn(async (_c: ContextoTenant, mov, clave: ClaveOrigen) => {
      const key = claveStr(clave);
      const existente = filas.find((f) => f.clave === key);
      if (existente) return existente.mov;
      const persistido = { id: `mov-${filas.length + 1}`, amountPen: mov.monto } as MovimientoPersistido;
      filas.push({ clave: key, mov: persistido });
      return persistido;
    }),
  } as unknown as MovimientoRepositorio;

  return { repo, filas };
}

const datos: DatosNuevoMovimiento = {
  tipo: 'adelanto',
  monto: 100,
  descripcion: 'Adelanto reserva DMB-1',
  fecha: '2026-06-20',
  source: 'booking_payment',
  bookingPaymentId: 'bp-1',
};

describe('ProyectarDesdeOperacion (idempotencia)', () => {
  it('crea el movimiento la primera vez', async () => {
    const { repo, filas } = repoEnMemoria();
    const uc = new ProyectarDesdeOperacion(repo);
    const res = await uc.ejecutar(ctx, datos);
    expect(res.id).toBe('mov-1');
    expect(filas).toHaveLength(1);
  });

  it('NO duplica al reprocesar el mismo origen (reintento / backfill)', async () => {
    const { repo, filas } = repoEnMemoria();
    const uc = new ProyectarDesdeOperacion(repo);
    const a = await uc.ejecutar(ctx, datos);
    const b = await uc.ejecutar(ctx, datos);
    const c = await uc.ejecutar(ctx, datos);
    expect(a.id).toBe(b.id);
    expect(b.id).toBe(c.id);
    expect(filas).toHaveLength(1);
  });

  it('distingue orígenes diferentes (otro bookingPaymentId crea otra fila)', async () => {
    const { repo, filas } = repoEnMemoria();
    const uc = new ProyectarDesdeOperacion(repo);
    await uc.ejecutar(ctx, datos);
    await uc.ejecutar(ctx, { ...datos, bookingPaymentId: 'bp-2' });
    expect(filas).toHaveLength(2);
  });
});
