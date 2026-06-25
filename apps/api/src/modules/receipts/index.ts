// API pública del módulo `receipts` (recibos de cobros/abonos) + composition root.
// ÚNICO punto de entrada: el resto del árbol es privado. DI ligera sin framework.

import prisma from '../../shared/database/prisma';

import { CrearRecibo } from './application/CrearRecibo';
import { ListarRecibos } from './application/ListarRecibos';
import { ObtenerRecibo } from './application/ObtenerRecibo';
import { AgregarPagoRecibo } from './application/AgregarPagoRecibo';
import { AnularRecibo } from './application/AnularRecibo';
import { GenerarPDFRecibo } from './application/GenerarPDFRecibo';
import { EnviarReciboPorCorreo } from './application/EnviarReciboPorCorreo';
import { ListarBookingsCliente } from './application/ListarBookingsCliente';

import { PrismaReciboRepository } from './infrastructure/PrismaReciboRepository';
import { ReciboRendererLib } from './infrastructure/ReciboRendererLib';
import { PdfPuppeteer } from './infrastructure/PdfPuppeteer';
import { NotificadorRecibosEmail } from './infrastructure/NotificadorRecibosEmail';

export interface ModuloRecibos {
  readonly crearRecibo: CrearRecibo;
  readonly listarRecibos: ListarRecibos;
  readonly obtenerRecibo: ObtenerRecibo;
  readonly agregarPago: AgregarPagoRecibo;
  readonly anularRecibo: AnularRecibo;
  readonly generarPDF: GenerarPDFRecibo;
  readonly enviarPorCorreo: EnviarReciboPorCorreo;
  readonly listarBookingsCliente: ListarBookingsCliente;
}

let cache: ModuloRecibos | null = null;

export function crearModuloRecibos(): ModuloRecibos {
  if (cache) return cache;
  const repo = new PrismaReciboRepository(prisma);
  const renderer = new ReciboRendererLib();
  const pdf = new PdfPuppeteer();
  const notificador = new NotificadorRecibosEmail();

  cache = {
    crearRecibo: new CrearRecibo(repo),
    listarRecibos: new ListarRecibos(repo),
    obtenerRecibo: new ObtenerRecibo(repo),
    agregarPago: new AgregarPagoRecibo(repo),
    anularRecibo: new AnularRecibo(repo),
    generarPDF: new GenerarPDFRecibo(repo, renderer, pdf),
    enviarPorCorreo: new EnviarReciboPorCorreo(repo, renderer, pdf, notificador),
    listarBookingsCliente: new ListarBookingsCliente(repo),
  };
  return cache;
}
