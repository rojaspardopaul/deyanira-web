// Caso de uso: crear una cita individual. Orquesta dominio + puertos preservando
// EXACTAMENTE las reglas de la ruta legacy POST /api/appointments, pero sin Express,
// sin Prisma y sin lógica inline: todo lo externo entra por puertos inyectados.

import { Dinero } from '../../../shared/domain/Dinero';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';

import { Cita } from '../domain/Cita';
import { FranjaHoraria } from '../domain/FranjaHoraria';
import {
  AnticipacionRequeridaError,
  CitaBloqueadaError,
  CitaEnPasadoError,
  DatosInvitadoRequeridosError,
  DemasiadasCitasActivasError,
  DireccionDomicilioRequeridaError,
  DomicilioNoDisponibleError,
  EstilistaNoRealizaServicioError,
  HorarioNoDisponibleError,
  SeleccionRequeridaError,
  ServicioNoDisponibleError,
} from '../domain/errors';

import type { CitaRepositorio } from '../domain/ports/CitaRepositorio';
import type { CalculadoraPrecios } from '../domain/ports/CalculadoraPrecios';
import type { ConfiguracionDomicilio } from '../domain/ports/ConfiguracionDomicilio';
import type { Notificador } from '../domain/ports/Notificador';
import type { Reloj } from '../domain/ports/Reloj';

import { CrearCitaComando } from './dto/CrearCitaComando';
import { CitaResultado } from './dto/CitaResultado';

const MAX_CITAS_ACTIVAS_CLIENTE = 10;
const MAX_CITAS_RECIENTES_INVITADO = 5;
const RECARGO_DOMICILIO_DEFECTO = 20;

export class CrearCita {
  constructor(
    private readonly citas: CitaRepositorio,
    private readonly precios: CalculadoraPrecios,
    private readonly configDomicilio: ConfiguracionDomicilio,
    private readonly notificador: Notificador,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(ctx: ContextoTenant, comando: CrearCitaComando): Promise<CitaResultado> {
    // 1) Franja válida (inicio < fin) — invariante del value object.
    const franja = FranjaHoraria.de(comando.inicio, comando.fin);

    // 2) Identidad del solicitante y coherencia de domicilio (fail-fast, antes de tocar la BD).
    if (!comando.usuario && !comando.guestName) {
      throw new DatosInvitadoRequeridosError('Se requiere nombre para reservar como invitado');
    }
    if (comando.aDomicilio && !comando.direccion) {
      throw new DireccionDomicilioRequeridaError('La dirección es requerida para servicios a domicilio');
    }

    // 3) Anti-abuso: límite de citas activas.
    if (comando.usuario) {
      const activas = await this.citas.contarActivasDeCliente(ctx, comando.usuario.id);
      if (activas >= MAX_CITAS_ACTIVAS_CLIENTE) {
        throw new DemasiadasCitasActivasError('Tienes demasiadas citas activas. Cancela alguna antes de reservar.');
      }
    } else if (comando.guestPhone) {
      const recientes = await this.citas.contarActivasRecientesDeInvitado(ctx, comando.guestPhone.slice(0, 20));
      if (recientes >= MAX_CITAS_RECIENTES_INVITADO) {
        throw new DemasiadasCitasActivasError('Este número ya tiene citas activas. Por favor contáctanos.');
      }
    }

    // 4) No en el pasado (zona Lima).
    const ahora = this.reloj.ahoraLima();
    if (comando.fecha < ahora.fecha) {
      throw new CitaEnPasadoError('No se pueden crear citas en el pasado');
    }
    if (comando.fecha === ahora.fecha && comando.inicio <= ahora.hora) {
      throw new CitaEnPasadoError('La hora seleccionada ya pasó');
    }

    // 5) Garantizar Customer (upsert) para clientes registrados.
    if (comando.usuario) {
      await this.citas.asegurarCliente(ctx, {
        id: comando.usuario.id,
        nombre: comando.usuario.nombre,
        email: comando.usuario.email,
      });
    }

    // 6) Recargo a domicilio (una sola vez por reserva).
    let recargo: Dinero | null = null;
    if (comando.aDomicilio) {
      const config = await this.configDomicilio.obtener(ctx);
      if (config && !config.habilitado) {
        throw new DomicilioNoDisponibleError('El servicio a domicilio no está disponible');
      }
      recargo = config ? config.recargoPara(comando.distrito || 'Otro') : Dinero.de(RECARGO_DOMICILIO_DEFECTO);
    }

    // 7) La estilista (si se especifica) realiza el servicio y tiene el horario libre.
    if (comando.staffId) {
      const realiza = await this.citas.estilistaRealizaServicio(ctx, comando.staffId, comando.servicioId);
      if (!realiza) {
        throw new EstilistaNoRealizaServicioError('Esta estilista no realiza ese servicio');
      }
      const conflicto = await this.citas.hayConflicto(ctx, { staffId: comando.staffId, fecha: comando.fecha, franja });
      if (conflicto) {
        throw new HorarioNoDisponibleError('El horario seleccionado no está disponible para esta estilista');
      }
    }

    // 8) Precio autoritativo server-side (anti-tampering).
    const servicio = await this.precios.cargarServicio(ctx, comando.servicioId);
    if (!servicio || !servicio.isActive) {
      throw new ServicioNoDisponibleError('Servicio no disponible');
    }
    const faltantes = this.precios.validarRequeridos(servicio, comando.selecciones);
    if (faltantes.length > 0) {
      throw new SeleccionRequeridaError(`Faltan selecciones requeridas: ${faltantes.map((e) => e.name).join(', ')}`);
    }
    const precio = this.precios.calcular(servicio, comando.selecciones);
    if (precio.blocked) {
      throw new CitaBloqueadaError(`Reserva bloqueada: ${precio.blockedReasons.join(', ')}`);
    }
    if (precio.requiresLeadDays != null) {
      const apptTs = new Date(`${comando.fecha}T${comando.inicio}:00`).getTime();
      const minTs = ahora.ms + precio.requiresLeadDays * 24 * 60 * 60 * 1000;
      if (apptTs < minTs) {
        throw new AnticipacionRequeridaError(`Este servicio requiere reservar al menos ${precio.requiresLeadDays} días antes`);
      }
    }

    // 9) Total = precio del servicio (+ recargo a domicilio).
    let total = Dinero.de(precio.totalPrice);
    if (comando.aDomicilio && recargo) {
      total = total.sumar(recargo);
    }

    // 10) Construir la entidad (valida invariantes estructurales) y persistir.
    const cita = Cita.crear({
      servicioId: comando.servicioId,
      staffId: comando.staffId,
      onDutyStaff: comando.onDutyStaff,
      fecha: comando.fecha,
      franja,
      total,
      notas: comando.notas,
      solicitante: {
        customerId: comando.usuario?.id ?? null,
        guestName: comando.guestName,
        guestPhone: comando.guestPhone,
        guestEmail: comando.guestEmail,
      },
      domicilio: {
        aDomicilio: comando.aDomicilio,
        direccion: comando.aDomicilio ? comando.direccion : null,
        distrito: comando.aDomicilio ? comando.distrito : null,
        recargo: comando.aDomicilio ? recargo : null,
      },
    });

    const persistida = await this.citas.guardar(ctx, cita);

    // 11) Notificaciones fire-and-forget (no bloquean ni fallan la reserva).
    const contactEmail = comando.usuario?.email || comando.guestEmail;
    const contactName = comando.guestName || 'Cliente';
    if (contactEmail) {
      this.notificador.citaSolicitada(persistida, { email: contactEmail, nombre: contactName });
    }
    this.notificador.nuevaReservaAlSalon(persistida);

    const atHomeExtraPen = comando.aDomicilio && recargo ? recargo.monto : null;
    return CitaResultado.desde(persistida, atHomeExtraPen);
  }
}
