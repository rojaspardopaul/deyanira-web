import type { PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import { kmDesdeCieneguilla } from '../../../shared/domain/distritos';
import type { ConfiguracionEnvio, ConfiguracionEnvioSalon } from '../domain/ports/ConfiguracionEnvio';

interface TarifaEnvio {
  shipBasePen: unknown;
  shipBaseKm: unknown;
  shipPerKmPen: unknown;
}

// Tarifa de envío por distancia (km desde Cieneguilla): base + (km - kmBase) * tarifa/km.
function costoEnvio(distrito: string, s: TarifaEnvio): number {
  const km = kmDesdeCieneguilla(distrito);
  const base = Number(s.shipBasePen ?? 10);
  const baseKm = Number(s.shipBaseKm ?? 10);
  const perKm = Number(s.shipPerKmPen ?? 1.5);
  return Math.round((base + Math.max(0, km - baseKm) * perKm) * 100) / 100;
}

export class ConfiguracionEnvioPrisma implements ConfiguracionEnvio {
  constructor(private readonly prisma: PrismaClient) {}

  async obtener(_ctx: ContextoTenant): Promise<ConfiguracionEnvioSalon | null> {
    const s = await this.prisma.setting.findFirst();
    if (!s) return null;
    return {
      habilitado: s.shipEnabled,
      envioGratisDesde: Number(s.shipFreeOverPen ?? 150),
      costoPara: (distrito: string) => costoEnvio(distrito, s),
    };
  }
}
