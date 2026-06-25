// Entidad del libro mayor: un movimiento financiero. Encapsula las invariantes
// (monto > 0, descripción presente, dirección coherente con el tipo) y usa el
// value object Dinero para la aritmética en céntimos. La persistencia vive en
// infrastructure/ — esta clase no conoce Prisma.

import { Dinero } from '../../../shared/domain/Dinero';
import { MontoInvalidoError, DatosMovimientoInvalidosError } from './errors';
import {
  type Direccion,
  type TipoMovimiento,
  type FuenteMovimiento,
  direccionDeTipo,
} from './TipoMovimiento';

export interface DatosNuevoMovimiento {
  readonly tipo: TipoMovimiento;
  readonly direccion?: Direccion;
  readonly monto: number;
  readonly descripcion: string;
  readonly fecha: string; // 'YYYY-MM-DD' (fecha contable, America/Lima)
  readonly categoria?: string | null;
  readonly metodoPago?: string | null;
  readonly source: FuenteMovimiento;
  readonly appointmentId?: string | null;
  readonly bookingPaymentId?: string | null;
  readonly orderId?: string | null;
  readonly expenseId?: string | null;
  readonly otherIncomeId?: string | null;
  readonly customerId?: string | null;
  readonly staffId?: string | null;
  readonly accountId?: string | null;
  readonly receiptUrl?: string | null;
  readonly createdBy?: string | null;
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export class Movimiento {
  private constructor(
    readonly direccion: Direccion,
    readonly tipo: TipoMovimiento,
    readonly dinero: Dinero,
    readonly descripcion: string,
    readonly fecha: string,
    readonly datos: DatosNuevoMovimiento,
  ) {}

  /** Crea un movimiento nuevo validando las invariantes del dominio. */
  static crear(d: DatosNuevoMovimiento): Movimiento {
    if (!d.descripcion || d.descripcion.trim().length === 0) {
      throw new DatosMovimientoInvalidosError('La descripción es requerida');
    }
    if (!FECHA_RE.test(d.fecha)) {
      throw new DatosMovimientoInvalidosError('Fecha inválida (YYYY-MM-DD)');
    }
    const dinero = Dinero.de(d.monto);
    if (dinero.esCero() || dinero.esNegativo()) {
      throw new MontoInvalidoError('El monto debe ser mayor a 0');
    }
    const direccion = d.direccion ?? direccionDeTipo(d.tipo);
    return new Movimiento(direccion, d.tipo, dinero, d.descripcion.trim().slice(0, 300), d.fecha, d);
  }

  get monto(): number {
    return this.dinero.monto;
  }
}
