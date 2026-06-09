// Adaptador de configuración de pago del salón (Settings). Lee los campos de pago
// para instrucciones públicas y el settings completo para el recibo.

import type { PrismaClient } from '@prisma/client';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';
import type { ConfiguracionPago } from '../domain/ports/ConfiguracionPago';

const SALON_PAY_FIELDS = {
  yapeNumber: true, yapeName: true, plinNumber: true,
  bankName: true, bankAccount: true, bankCci: true, bankAccountHolder: true,
  salonName: true, whatsapp: true, phone: true,
} as const;

export class ConfiguracionPagoPrisma implements ConfiguracionPago {
  constructor(private readonly prisma: PrismaClient) {}

  async datosPago(_ctx: ContextoTenant): Promise<Record<string, unknown>> {
    const s = await this.prisma.setting.findFirst({ select: SALON_PAY_FIELDS });
    return (s as Record<string, unknown> | null) || {};
  }

  async salonCompleto(_ctx: ContextoTenant): Promise<Record<string, unknown>> {
    const s = await this.prisma.setting.findFirst();
    return (s as Record<string, unknown> | null) || {};
  }

  culqiPublicKey(): string | null {
    return process.env.CULQI_PUBLIC_KEY || process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY || null;
  }
}
