// Adaptador de persistencia de cuentas/cajas financieras con Prisma.

import type { PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { CuentaNoEncontradaError } from '../domain/errors';
import type {
  CuentaRepositorio,
  CuentaPersistida,
  DatosCuenta,
} from '../domain/ports/CuentaRepositorio';
import { num, iso } from './mappers';

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapCuenta(row: any, balancePen: number): CuentaPersistida {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    balancePen,
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
  };
}

export class PrismaCuentaRepository implements CuentaRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  // Saldo neto por cuenta: Σ ingresos − Σ egresos de sus movimientos no anulados.
  private async saldos(): Promise<Map<string, number>> {
    const groups = await this.prisma.financialMovement.groupBy({
      by: ['accountId', 'direction'],
      where: { status: { not: 'void' }, accountId: { not: null } },
      _sum: { amountPen: true },
    });
    const map = new Map<string, number>();
    for (const g of groups) {
      if (!g.accountId) continue;
      const signed = (g.direction === 'in' ? 1 : -1) * num(g._sum.amountPen);
      map.set(g.accountId, (map.get(g.accountId) || 0) + signed);
    }
    return map;
  }

  async listar(_ctx: ContextoTenant): Promise<CuentaPersistida[]> {
    const [rows, saldos] = await Promise.all([
      this.prisma.financialAccount.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.saldos(),
    ]);
    return rows.map((r) => mapCuenta(r, Math.round((saldos.get(r.id) || 0) * 100) / 100));
  }

  async crear(_ctx: ContextoTenant, datos: DatosCuenta): Promise<CuentaPersistida> {
    const row = await this.prisma.financialAccount.create({
      data: {
        name: datos.name,
        type: datos.type ?? 'cash',
        isActive: datos.isActive ?? true,
        sortOrder: datos.sortOrder ?? 0,
      },
    });
    return mapCuenta(row, 0);
  }

  async actualizar(_ctx: ContextoTenant, id: string, cambios: Partial<DatosCuenta>): Promise<CuentaPersistida> {
    const existente = await this.prisma.financialAccount.findUnique({ where: { id } });
    if (!existente) throw new CuentaNoEncontradaError('Cuenta no encontrada');
    const row = await this.prisma.financialAccount.update({ where: { id }, data: cambios });
    const saldos = await this.saldos();
    return mapCuenta(row, Math.round((saldos.get(id) || 0) * 100) / 100);
  }
}
