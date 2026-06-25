// Adaptador Prisma del repositorio de vouchers. Al adjuntar el primero, también
// rellena FinancialMovement.receiptUrl (miniatura/indicador rápido en listas).

import type { PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { MovimientoNoEncontradoError } from '../domain/errors';
import type {
  VoucherRepositorio,
  VoucherPersistido,
  NuevoVoucher,
} from '../domain/ports/VoucherRepositorio';
import { iso } from './mappers';

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(row: any): VoucherPersistido {
  return {
    id: row.id,
    movementId: row.movementId,
    url: row.url,
    fileType: row.fileType,
    fileName: row.fileName ?? null,
    publicId: row.publicId ?? null,
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
  };
}

export class PrismaVoucherRepository implements VoucherRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async adjuntar(_ctx: ContextoTenant, movementId: string, datos: NuevoVoucher): Promise<VoucherPersistido> {
    const mov = await this.prisma.financialMovement.findUnique({ where: { id: movementId }, select: { id: true, receiptUrl: true } });
    if (!mov) throw new MovimientoNoEncontradoError('Movimiento no encontrado');

    const row = await this.prisma.financialVoucher.create({
      data: {
        movementId,
        url: datos.url,
        fileType: datos.fileType,
        fileName: datos.fileName ?? null,
        publicId: datos.publicId ?? null,
        uploadedBy: datos.uploadedBy ?? null,
      },
    });
    // Primer comprobante → lo dejamos como receiptUrl del movimiento (indicador rápido).
    if (!mov.receiptUrl) {
      await this.prisma.financialMovement.update({ where: { id: movementId }, data: { receiptUrl: datos.url } });
    }
    return mapRow(row);
  }

  async listar(_ctx: ContextoTenant, movementId: string): Promise<VoucherPersistido[]> {
    const rows = await this.prisma.financialVoucher.findMany({ where: { movementId }, orderBy: { createdAt: 'asc' } });
    return rows.map(mapRow);
  }

  async buscar(_ctx: ContextoTenant, id: string): Promise<VoucherPersistido | null> {
    const row = await this.prisma.financialVoucher.findUnique({ where: { id } });
    return row ? mapRow(row) : null;
  }

  async eliminar(_ctx: ContextoTenant, id: string): Promise<void> {
    const v = await this.prisma.financialVoucher.findUnique({ where: { id } });
    if (!v) return;
    await this.prisma.financialVoucher.delete({ where: { id } });
    // Si era el receiptUrl del movimiento, reasigna al siguiente voucher (o null).
    const mov = await this.prisma.financialMovement.findUnique({ where: { id: v.movementId }, select: { receiptUrl: true } });
    if (mov?.receiptUrl === v.url) {
      const next = await this.prisma.financialVoucher.findFirst({ where: { movementId: v.movementId }, orderBy: { createdAt: 'asc' } });
      await this.prisma.financialMovement.update({ where: { id: v.movementId }, data: { receiptUrl: next?.url ?? null } });
    }
  }
}
