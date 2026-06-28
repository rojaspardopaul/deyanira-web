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

// Distancias aproximadas (km DESDE Cieneguilla, sede del salón).
// Debe mantenerse IDÉNTICA a la del frontend
// (apps/web/features/appointments/utils/booking.ts) para que el estimado = el cobro.
const DISTRICT_DIST_KM: Record<string, number> = {
  Cieneguilla: 0, Pachacámac: 12, 'La Molina': 14, Chaclacayo: 16, Ate: 18, Lurín: 18,
  Lurigancho: 20, 'Santa Anita': 20, Surco: 22, 'San Borja': 22, 'San Luis': 22, 'El Agustino': 22,
  'San Juan de Lurigancho': 24, 'La Victoria': 26, Surquillo: 26, 'Lima Cercado': 27, Lince: 27,
  Breña: 28, 'Jesús María': 28, 'Villa María del Triunfo': 28, Rímac: 29, Miraflores: 30,
  'San Isidro': 30, 'Pueblo Libre': 31, Barranco: 32, Magdalena: 32, Chorrillos: 33,
  'Villa El Salvador': 33, 'San Miguel': 34, 'San Martín de Porres': 36, Independencia: 37,
  'Los Olivos': 38, Comas: 42, Carabayllo: 46, 'Puente Piedra': 48, Otro: 30,
};

interface TarifaDomicilio {
  atHomeBasePen: unknown;
  atHomeBaseKm: unknown;
  atHomeRatePen: unknown;
}

function calcularRecargo(distrito: string, s: TarifaDomicilio): number {
  const distKm = DISTRICT_DIST_KM[distrito] ?? 30;
  const basePen = Number(s.atHomeBasePen ?? 120);
  const baseKm = Number(s.atHomeBaseKm ?? 15);
  const ratePen = Number(s.atHomeRatePen ?? 4);
  return Math.round((basePen + Math.max(0, distKm - baseKm) * ratePen) * 100) / 100;
}

export class ConfiguracionDomicilioPrisma implements ConfiguracionDomicilio {
  constructor(private readonly prisma: PrismaClient) {}

  async obtener(_ctx: ContextoTenant): Promise<ConfiguracionDomicilioSalon | null> {
    const s = await this.prisma.setting.findFirst();
    if (!s) return null;
    const pickup = Array.isArray(s.pickupDistricts) ? s.pickupDistricts : [];
    return {
      habilitado: s.atHomeEnabled,
      recargoPara: (distrito: string) => Dinero.de(calcularRecargo(distrito, s)),
      permiteRecojo: (distrito: string) => pickup.includes(distrito),
    };
  }
}
