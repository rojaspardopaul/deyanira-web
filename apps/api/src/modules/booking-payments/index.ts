// API pública del módulo `booking-payments` (adelantos) + composition root.
// ÚNICO punto de entrada: el resto del árbol es privado. DI ligera sin framework.

import prisma from '../../shared/database/prisma';

import { ObtenerAdelanto } from './application/ObtenerAdelanto';
import { PagarAdelantoCulqi } from './application/PagarAdelantoCulqi';
import { SubirComprobanteAdelanto } from './application/SubirComprobanteAdelanto';
import { GenerarReciboAdelanto } from './application/GenerarReciboAdelanto';
import { ListarAdelantosAdmin } from './application/ListarAdelantosAdmin';
import { VerificarComprobante } from './application/VerificarComprobante';
import { RegistrarAdelantoManual } from './application/RegistrarAdelantoManual';

import { PrismaAdelantoRepository } from './infrastructure/PrismaAdelantoRepository';
import { CulqiGateway } from './infrastructure/CulqiGateway';
import { CloudinaryComprobantes } from './infrastructure/CloudinaryComprobantes';
import { ConfiguracionPagoPrisma } from './infrastructure/ConfiguracionPagoPrisma';
import { ReciboRendererLib } from './infrastructure/ReciboRendererLib';
import { NotificadorAdelantosEmail } from './infrastructure/NotificadorAdelantosEmail';

export interface ModuloAdelantos {
  readonly obtenerAdelanto: ObtenerAdelanto;
  readonly pagarAdelantoCulqi: PagarAdelantoCulqi;
  readonly subirComprobante: SubirComprobanteAdelanto;
  readonly generarRecibo: GenerarReciboAdelanto;
  readonly listarAdelantosAdmin: ListarAdelantosAdmin;
  readonly verificarComprobante: VerificarComprobante;
  readonly registrarAdelantoManual: RegistrarAdelantoManual;
}

export function crearModuloAdelantos(): ModuloAdelantos {
  const repo = new PrismaAdelantoRepository(prisma);
  const pasarela = new CulqiGateway();
  const almacen = new CloudinaryComprobantes();
  const config = new ConfiguracionPagoPrisma(prisma);
  const renderer = new ReciboRendererLib();
  const notificador = new NotificadorAdelantosEmail();

  return {
    obtenerAdelanto: new ObtenerAdelanto(repo, config),
    pagarAdelantoCulqi: new PagarAdelantoCulqi(repo, pasarela, notificador),
    subirComprobante: new SubirComprobanteAdelanto(repo, almacen, notificador),
    generarRecibo: new GenerarReciboAdelanto(repo, config, renderer),
    listarAdelantosAdmin: new ListarAdelantosAdmin(repo),
    verificarComprobante: new VerificarComprobante(repo, notificador),
    registrarAdelantoManual: new RegistrarAdelantoManual(repo, notificador),
  };
}
