// Puerto del modelo de lectura analítico (KPIs, series, desgloses). Lee del libro
// mayor (financial_movements) y de fuentes operativas para los KPIs que no son
// dinero movido (adelantos pendientes, cuentas por cobrar, caja por cuenta).

import type { ContextoTenant } from '../../../../shared/context/ContextoTenant';

export interface Totales {
  readonly ingresos: number;
  readonly egresos: number;
  readonly utilidad: number;
}

export interface DesgloseItem {
  readonly key: string;
  readonly label: string;
  readonly total: number;
  readonly count: number;
}

export interface ResumenFinancieroResultado {
  readonly periodo: { from: string; to: string };
  readonly hoy: Totales;
  readonly periodoActual: Totales & { variacion: Totales | null };
  readonly margen: number; // % utilidad / ingresos del período
  readonly cajaDisponible: number; // saldo neto acumulado (todas las cuentas)
  readonly adelantosPendientes: { total: number; count: number };
  readonly cuentasPorCobrar: { total: number; count: number };
  readonly ventasProductos: { total: number; count: number };
  readonly serviciosVendidos: { total: number; count: number };
  readonly clientesAtendidos: number;
  readonly ticketPromedio: number;
  readonly porCategoria: DesgloseItem[];
  readonly porMetodoPago: DesgloseItem[];
  readonly porTipo: DesgloseItem[];
}

export interface PuntoSerie {
  readonly month: number; // 1-12
  readonly year: number;
  readonly income: number;
  readonly expenses: number;
  readonly profit: number;
}

export interface AnaliticaFinanciera {
  resumen(ctx: ContextoTenant, from: string, to: string): Promise<ResumenFinancieroResultado>;
  serieMensual(ctx: ContextoTenant, year: number): Promise<PuntoSerie[]>;
}
