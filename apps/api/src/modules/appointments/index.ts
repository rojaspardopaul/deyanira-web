// API pública del módulo `appointments` + composition root.
//
// ÚNICO punto de entrada del módulo: el resto del árbol (domain/, application/,
// infrastructure/) es privado y no debe importarse desde fuera. `crearModuloCitas`
// inyecta las implementaciones concretas en los casos de uso (DI ligera, sin framework).

import prisma from '../../shared/database/prisma';

import { CrearCita } from './application/CrearCita';
import { CancelarCita } from './application/CancelarCita';
import { ConsultarDisponibilidad } from './application/ConsultarDisponibilidad';
import { ListarMisCitas } from './application/ListarMisCitas';

import { PrismaCitaRepository } from './infrastructure/PrismaCitaRepository';
import { PrismaCalculadoraPrecios } from './infrastructure/PrismaCalculadoraPrecios';
import { ConfiguracionDomicilioPrisma } from './infrastructure/ConfiguracionDomicilioPrisma';
import { NotificadorEmail } from './infrastructure/NotificadorEmail';
import { RelojLima } from './infrastructure/RelojLima';
import { DisponibilidadSlotsLib } from './infrastructure/DisponibilidadSlotsLib';

export interface ModuloCitas {
  readonly crearCita: CrearCita;
  readonly cancelarCita: CancelarCita;
  readonly consultarDisponibilidad: ConsultarDisponibilidad;
  readonly listarMisCitas: ListarMisCitas;
}

/** Construye el módulo de citas con sus dependencias reales (Prisma, email, reloj). */
export function crearModuloCitas(): ModuloCitas {
  const repo = new PrismaCitaRepository(prisma);
  const precios = new PrismaCalculadoraPrecios(prisma);
  const configDomicilio = new ConfiguracionDomicilioPrisma(prisma);
  const notificador = new NotificadorEmail();
  const reloj = new RelojLima();
  const disponibilidad = new DisponibilidadSlotsLib();

  return {
    crearCita: new CrearCita(repo, precios, configDomicilio, notificador, reloj),
    cancelarCita: new CancelarCita(repo, notificador),
    consultarDisponibilidad: new ConsultarDisponibilidad(disponibilidad),
    listarMisCitas: new ListarMisCitas(repo),
  };
}

// Tipos públicos que la presentación (Fase 1C) necesita.
export { CrearCitaComando } from './application/dto/CrearCitaComando';
export type { CuerpoCrearCita, UsuarioAutenticado } from './application/dto/CrearCitaComando';
