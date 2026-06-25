// Caso de uso: gestión de cuentas/cajas financieras (listar, crear, actualizar).

import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type {
  CuentaRepositorio,
  CuentaPersistida,
  DatosCuenta,
} from '../domain/ports/CuentaRepositorio';
import { DatosMovimientoInvalidosError } from '../domain/errors';

const TIPOS_CUENTA = ['cash', 'wallet', 'bank', 'card'];

export class GestionarCuentas {
  constructor(private readonly repo: CuentaRepositorio) {}

  listar(ctx: ContextoTenant): Promise<CuentaPersistida[]> {
    return this.repo.listar(ctx);
  }

  crear(ctx: ContextoTenant, datos: DatosCuenta): Promise<CuentaPersistida> {
    const name = (datos.name || '').trim();
    if (!name) throw new DatosMovimientoInvalidosError('El nombre de la cuenta es requerido');
    const type = datos.type && TIPOS_CUENTA.includes(datos.type) ? datos.type : 'cash';
    return this.repo.crear(ctx, { ...datos, name: name.slice(0, 60), type });
  }

  actualizar(ctx: ContextoTenant, id: string, cambios: Partial<DatosCuenta>): Promise<CuentaPersistida> {
    const limpio: { name?: string; type?: string; isActive?: boolean; sortOrder?: number } = {};
    if (cambios.name != null) {
      const name = cambios.name.trim();
      if (!name) throw new DatosMovimientoInvalidosError('El nombre no puede estar vacío');
      limpio.name = name.slice(0, 60);
    }
    if (cambios.type != null && TIPOS_CUENTA.includes(cambios.type)) limpio.type = cambios.type;
    if (cambios.isActive != null) limpio.isActive = cambios.isActive;
    if (cambios.sortOrder != null) limpio.sortOrder = cambios.sortOrder;
    return this.repo.actualizar(ctx, id, limpio);
  }
}
