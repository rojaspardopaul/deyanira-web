// Adaptador de configuración de servicio a domicilio. Reemplaza el
// `prisma.setting.findFirst()` + `calcAtHomeExtra` inline de la ruta legacy.
//
// La tabla de distancias y la fórmula de tarifa viven aquí (su nuevo hogar
// canónico). La ruta legacy conserva su copia hasta que se retire en la Fase 1D.

import type { PrismaClient } from '@prisma/client';
import { Dinero } from '../../../shared/domain/Dinero';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type {
  ConfiguracionDomicilio,
  ConfiguracionDomicilioSalon,
} from '../domain/ports/ConfiguracionDomicilio';

// Distancias aproximadas (km desde Surco).
const DISTRICT_DIST_KM: Record<string, number> = {
  Surco: 2, 'La Molina': 6, 'San Borja': 6, 'San Luis': 7, Miraflores: 7,
  'San Isidro': 8, Barranco: 9, Chorrillos: 10, Ate: 8, 'Santa Anita': 12,
  'La Victoria': 12, Lince: 12, 'Jesús María': 13, Magdalena: 13, 'Pueblo Libre': 14,
  'San Miguel': 15, 'El Agustino': 13, 'Lima Cercado': 14, Rímac: 15, Breña: 15,
  'Villa María del Triunfo': 16, 'Villa El Salvador': 18, 'Los Olivos': 22,
  'San Martín de Porres': 20, Independencia: 21, Comas: 26,
  'San Juan de Lurigancho': 20, Lurigancho: 22, 'Puente Piedra': 30, Otro: 20,
};

interface TarifaDomicilio {
  atHomeBasePen: unknown;
  atHomeBaseKm: unknown;
  atHomeRatePen: unknown;
}

function calcularRecargo(distrito: string, s: TarifaDomicilio): number {
  const distKm = DISTRICT_DIST_KM[distrito] ?? 20;
  const basePen = Number(s.atHomeBasePen ?? 20);
  const baseKm = Number(s.atHomeBaseKm ?? 5);
  const ratePen = Number(s.atHomeRatePen ?? 3);
  return Math.round((basePen + Math.max(0, distKm - baseKm) * ratePen) * 100) / 100;
}

export class ConfiguracionDomicilioPrisma implements ConfiguracionDomicilio {
  constructor(private readonly prisma: PrismaClient) {}

  async obtener(_ctx: ContextoTenant): Promise<ConfiguracionDomicilioSalon | null> {
    const s = await this.prisma.setting.findFirst();
    if (!s) return null;
    return {
      habilitado: s.atHomeEnabled,
      recargoPara: (distrito: string) => Dinero.de(calcularRecargo(distrito, s)),
    };
  }
}
