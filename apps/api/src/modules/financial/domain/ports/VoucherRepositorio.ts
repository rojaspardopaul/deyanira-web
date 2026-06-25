// Puerto de persistencia de vouchers (comprobantes adjuntos a un movimiento).
// La subida/borrado del archivo en Cloudinary se hace en la capa HTTP (igual que
// /admin/upload); este puerto solo persiste/lee las filas.

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';

export interface VoucherPersistido {
  readonly id: string;
  readonly movementId: string;
  readonly url: string;
  readonly fileType: string; // image | pdf
  readonly fileName: string | null;
  readonly publicId: string | null;
  readonly createdAt: string;
}

export interface NuevoVoucher {
  readonly url: string;
  readonly fileType: string;
  readonly fileName?: string | null;
  readonly publicId?: string | null;
  readonly uploadedBy?: string | null;
}

export interface VoucherRepositorio {
  /** Adjunta un voucher a un movimiento (valida que el movimiento exista). */
  adjuntar(ctx: ContextoTenant, movementId: string, datos: NuevoVoucher): Promise<VoucherPersistido>;
  listar(ctx: ContextoTenant, movementId: string): Promise<VoucherPersistido[]>;
  buscar(ctx: ContextoTenant, id: string): Promise<VoucherPersistido | null>;
  eliminar(ctx: ContextoTenant, id: string): Promise<void>;
}
