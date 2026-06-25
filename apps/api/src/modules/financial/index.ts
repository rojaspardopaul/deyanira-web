// API pública del módulo `financial` (Centro Financiero / libro mayor) +
// composition root. ÚNICO punto de entrada: el resto del árbol es privado.
// DI ligera sin framework (igual que appointments/receipts).

import prisma from '../../shared/database/prisma';
import { TENANT_DEFECTO } from '../../shared/context/ContextoTenant';

import { RegistrarMovimiento } from './application/RegistrarMovimiento';
import { ProyectarDesdeOperacion } from './application/ProyectarDesdeOperacion';
import { ListarMovimientos } from './application/ListarMovimientos';
import { AnularMovimiento } from './application/AnularMovimiento';
import { ResumenFinanciero } from './application/ResumenFinanciero';
import { GestionarCuentas } from './application/GestionarCuentas';
import { GestionarVouchers } from './application/GestionarVouchers';
import { EditarMovimiento } from './application/EditarMovimiento';
import { RevisarConciliacion } from './application/RevisarConciliacion';
import { AsistirConIA } from './application/AsistirConIA';

import { PrismaMovimientoRepository } from './infrastructure/PrismaMovimientoRepository';
import { PrismaCuentaRepository } from './infrastructure/PrismaCuentaRepository';
import { PrismaAnaliticaFinanciera } from './infrastructure/PrismaAnaliticaFinanciera';
import { PrismaVoucherRepository } from './infrastructure/PrismaVoucherRepository';
import { PrismaConciliador } from './infrastructure/PrismaConciliador';
import { GeminiAsistente } from './infrastructure/GeminiAsistente';

import type { DatosNuevoMovimiento } from './domain/Movimiento';

export interface ModuloFinanciero {
  readonly registrarMovimiento: RegistrarMovimiento;
  readonly proyectarDesdeOperacion: ProyectarDesdeOperacion;
  readonly listarMovimientos: ListarMovimientos;
  readonly anularMovimiento: AnularMovimiento;
  readonly resumen: ResumenFinanciero;
  readonly cuentas: GestionarCuentas;
  readonly vouchers: GestionarVouchers;
  readonly editarMovimiento: EditarMovimiento;
  readonly conciliacion: RevisarConciliacion;
  readonly ia: AsistirConIA;
}

let cache: ModuloFinanciero | null = null;

export function crearModuloFinanciero(): ModuloFinanciero {
  if (cache) return cache;
  const repo = new PrismaMovimientoRepository(prisma);
  const cuentasRepo = new PrismaCuentaRepository(prisma);
  const analitica = new PrismaAnaliticaFinanciera(prisma);
  const vouchersRepo = new PrismaVoucherRepository(prisma);
  const conciliador = new PrismaConciliador(prisma);
  const asistente = new GeminiAsistente();

  cache = {
    registrarMovimiento: new RegistrarMovimiento(repo),
    proyectarDesdeOperacion: new ProyectarDesdeOperacion(repo),
    listarMovimientos: new ListarMovimientos(repo),
    anularMovimiento: new AnularMovimiento(repo),
    resumen: new ResumenFinanciero(analitica),
    cuentas: new GestionarCuentas(cuentasRepo),
    vouchers: new GestionarVouchers(vouchersRepo),
    editarMovimiento: new EditarMovimiento(repo),
    conciliacion: new RevisarConciliacion(conciliador),
    ia: new AsistirConIA(asistente),
  };
  return cache;
}

// ── Facade para hooks de auto-generación (consumible desde JS legacy) ──────────
// Los puntos de la operación (markDepositPaid, accounting.js, módulos de pedidos/
// pagos) proyectan su movimiento llamando aquí. Fire-and-forget: nunca debe
// romper la operación de negocio, igual que las notificaciones por correo.

/** Proyecta (idempotente) un movimiento desde la operación. Tolerante a fallos. */
export async function proyectarMovimiento(datos: DatosNuevoMovimiento): Promise<void> {
  try {
    await crearModuloFinanciero().proyectarDesdeOperacion.ejecutar(TENANT_DEFECTO, datos);
  } catch (err) {
    // No propagar: el ledger no debe bloquear el flujo de negocio.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    try { require('../../lib/logger').error('financial_projection_failed', { msg: (err as Error)?.message }); } catch { /* noop */ }
  }
}

/** Sincroniza/anula el movimiento espejo de una captura manual editada/eliminada. */
export async function sincronizarCaptura(
  clave: Parameters<PrismaMovimientoRepository['sincronizarDesdeCaptura']>[1],
  cambios: Parameters<PrismaMovimientoRepository['sincronizarDesdeCaptura']>[2],
): Promise<void> {
  try {
    await new PrismaMovimientoRepository(prisma).sincronizarDesdeCaptura(TENANT_DEFECTO, clave, cambios);
  } catch { /* fire-and-forget */ }
}

export async function anularMovimientosDeOrigen(
  clave: Parameters<PrismaMovimientoRepository['anularPorOrigen']>[1],
): Promise<void> {
  try {
    await new PrismaMovimientoRepository(prisma).anularPorOrigen(TENANT_DEFECTO, clave);
  } catch { /* fire-and-forget */ }
}

export type { DatosNuevoMovimiento } from './domain/Movimiento';
