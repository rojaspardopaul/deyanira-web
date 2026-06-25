// API pública del módulo `payments` + composition root.

import prisma from '../../shared/database/prisma';

import { ProcesarPagoCulqi } from './application/ProcesarPagoCulqi';
import { ConfirmarPagoYape } from './application/ConfirmarPagoYape';
import { ProcesarWebhookCulqi } from './application/ProcesarWebhookCulqi';

import { CulqiGateway } from './infrastructure/CulqiGateway';
import { PrismaPedidosParaPago } from './infrastructure/PrismaPedidosParaPago';
import { PrismaRegistroWebhook } from './infrastructure/PrismaRegistroWebhook';
import { NotificadorPagosEmail } from './infrastructure/NotificadorPagosEmail';

export interface ModuloPagos {
  readonly procesarPagoCulqi: ProcesarPagoCulqi;
  readonly confirmarPagoYape: ConfirmarPagoYape;
  readonly procesarWebhookCulqi: ProcesarWebhookCulqi;
}

export function crearModuloPagos(): ModuloPagos {
  const pedidos = new PrismaPedidosParaPago(prisma);
  const pasarela = new CulqiGateway();
  const notificador = new NotificadorPagosEmail();
  const registro = new PrismaRegistroWebhook(prisma);

  return {
    procesarPagoCulqi: new ProcesarPagoCulqi(pedidos, pasarela, notificador),
    confirmarPagoYape: new ConfirmarPagoYape(pedidos, notificador),
    procesarWebhookCulqi: new ProcesarWebhookCulqi(registro, pedidos, notificador),
  };
}
