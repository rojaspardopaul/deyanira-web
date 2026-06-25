// Caso de uso: gestión de vouchers (comprobantes) de un movimiento. La subida y
// el borrado del archivo en Cloudinary los hace la capa HTTP; aquí se persiste.

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type {
  VoucherRepositorio,
  VoucherPersistido,
  NuevoVoucher,
} from '../domain/ports/VoucherRepositorio';

export class GestionarVouchers {
  constructor(private readonly repo: VoucherRepositorio) {}

  adjuntar(ctx: ContextoTenant, movementId: string, datos: NuevoVoucher): Promise<VoucherPersistido> {
    return this.repo.adjuntar(ctx, movementId, datos);
  }

  listar(ctx: ContextoTenant, movementId: string): Promise<VoucherPersistido[]> {
    return this.repo.listar(ctx, movementId);
  }

  /** Devuelve el voucher (con publicId) y lo elimina; el caller borra en Cloudinary. */
  async eliminar(ctx: ContextoTenant, id: string): Promise<VoucherPersistido | null> {
    const v = await this.repo.buscar(ctx, id);
    if (!v) return null;
    await this.repo.eliminar(ctx, id);
    return v;
  }
}
