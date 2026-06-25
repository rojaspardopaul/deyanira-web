// Puerto de persistencia de cuentas/cajas financieras (Caja Principal, Yape, Banco).

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';

export interface CuentaPersistida {
  readonly id: string;
  readonly name: string;
  readonly type: string; // cash | wallet | bank | card
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly balancePen: number; // saldo neto (ingresos - egresos) de sus movimientos
  readonly createdAt: string;
}

export interface DatosCuenta {
  readonly name: string;
  readonly type?: string;
  readonly isActive?: boolean;
  readonly sortOrder?: number;
}

export interface CuentaRepositorio {
  listar(ctx: ContextoTenant): Promise<CuentaPersistida[]>;
  crear(ctx: ContextoTenant, datos: DatosCuenta): Promise<CuentaPersistida>;
  actualizar(ctx: ContextoTenant, id: string, cambios: Partial<DatosCuenta>): Promise<CuentaPersistida>;
}
