// Caso de uso: crear una reserva en lote (varios servicios / paquete con adelanto).
// Réplica fiel de POST /api/appointments/batch: programación secuencial, totales
// (paquete vs por-servicio anti-tampering), recargo a domicilio, depósito y
// persistencia transaccional con verificación de conflictos.

import { randomUUID } from 'crypto';
import { Dinero } from '../../../shared/domain/Dinero';
import type { ContextoTenant } from '../../../shared/context/ContextoTenant';

import {
  CitaBloqueadaError,
  CitaEnPasadoError,
  DatosInvitadoRequeridosError,
  DemasiadasCitasActivasError,
  DireccionDomicilioRequeridaError,
  DomicilioNoDisponibleError,
  FechaItemInvalidaError,
  PaqueteNoEncontradoError,
  SeleccionRequeridaError,
  ServicioNoEncontradoError,
} from '../domain/errors';

import type { CitaRepositorio, LineaReserva } from '../domain/ports/CitaRepositorio';
import type { CalculadoraPrecios } from '../domain/ports/CalculadoraPrecios';
import type { ConfiguracionDomicilio } from '../domain/ports/ConfiguracionDomicilio';
import { infoPaqueteDesde, type Notificador } from '../domain/ports/Notificador';
import type { Reloj } from '../domain/ports/Reloj';
import type { CatalogoReservas, PaqueteReserva } from '../domain/ports/CatalogoReservas';
import type { Scheduler } from '../domain/ports/Scheduler';

import { CrearReservaComando } from './dto/CrearReservaComando';
import { ReservaResultado } from './dto/ReservaResultado';

const MAX_CITAS_ACTIVAS_LOTE = 20;
const RECARGO_DOMICILIO_DEFECTO = 20;
const DEPOSITO_PORCENTAJE_DEFECTO = 50;

export class CrearReservaEnLote {
  constructor(
    private readonly catalogo: CatalogoReservas,
    private readonly citas: CitaRepositorio,
    private readonly configDomicilio: ConfiguracionDomicilio,
    private readonly precios: CalculadoraPrecios,
    private readonly scheduler: Scheduler,
    private readonly notificador: Notificador,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(ctx: ContextoTenant, comando: CrearReservaComando): Promise<ReservaResultado> {
    if (!comando.usuario && !comando.guestName) {
      throw new DatosInvitadoRequeridosError('Se requiere nombre para reservar como invitado');
    }
    if (comando.aDomicilio && !comando.direccion) {
      throw new DireccionDomicilioRequeridaError('La dirección es requerida para servicios a domicilio');
    }

    const ahora = this.reloj.ahoraLima();
    if (comando.fecha < ahora.fecha) throw new CitaEnPasadoError('No se pueden crear citas en el pasado');
    if (comando.fecha === ahora.fecha && comando.inicio <= ahora.hora) {
      throw new CitaEnPasadoError('La hora seleccionada ya pasó');
    }

    // Paquete (opcional)
    let pkg: PaqueteReserva | null = null;
    if (comando.packageId) {
      pkg = await this.catalogo.cargarPaquete(ctx, comando.packageId);
      if (!pkg || !pkg.isActive) throw new PaqueteNoEncontradoError('Paquete no encontrado');
    }

    // Garantizar Customer
    if (comando.usuario) {
      await this.citas.asegurarCliente(ctx, {
        id: comando.usuario.id,
        nombre: comando.usuario.nombre,
        email: comando.usuario.email,
      });
    }

    // Anti-abuso
    if (comando.usuario) {
      const activas = await this.citas.contarActivasDeCliente(ctx, comando.usuario.id);
      if (activas + comando.items.length > MAX_CITAS_ACTIVAS_LOTE) {
        throw new DemasiadasCitasActivasError('Tienes demasiadas citas activas. Cancela alguna antes de reservar.');
      }
    }

    // Recargo a domicilio (una vez por reserva)
    let recargo: Dinero | null = null;
    if (comando.aDomicilio) {
      const config = await this.configDomicilio.obtener(ctx);
      if (config && !config.habilitado) throw new DomicilioNoDisponibleError('El servicio a domicilio no está disponible');
      recargo = config ? config.recargoPara(comando.distrito || 'Otro') : Dinero.de(RECARGO_DOMICILIO_DEFECTO);
    }

    // Servicios (cuando hay paquete se aceptan inactivos, p. ej. "prueba de maquillaje")
    const serviceIds = Array.from(new Set(comando.items.map((i) => i.serviceId)));
    const servicios = await this.catalogo.cargarServiciosParaLote(ctx, serviceIds, Boolean(pkg));
    const serviceById = new Map(servicios.map((s) => [s.id, s]));
    for (const it of comando.items) {
      if (!serviceById.has(it.serviceId)) {
        throw new ServicioNoEncontradoError(`Servicio no encontrado: ${it.serviceId}`);
      }
    }

    // Validación de fechas por item respetando daysBeforeMain
    for (const it of comando.items) {
      const svc = serviceById.get(it.serviceId)!;
      const required = svc.daysBeforeMain || 0;
      const itemDate = it.date || comando.fecha;
      if (required > 0) {
        if (!it.date) {
          throw new FechaItemInvalidaError(`El servicio "${svc.name}" requiere una fecha propia (mínimo ${required} día(s) antes)`);
        }
        if (this.scheduler.diasEntre(comando.fecha, itemDate) < required) {
          throw new FechaItemInvalidaError(`"${svc.name}" debe reservarse al menos ${required} día(s) antes del día principal`);
        }
      }
      if (itemDate < ahora.fecha) {
        throw new FechaItemInvalidaError(`La fecha de "${svc.name}" está en el pasado`);
      }
    }

    // Programación secuencial por estilista/fecha + parallelGroup
    const scheduled = this.scheduler.programar({
      items: comando.items,
      serviceById,
      date: comando.fecha,
      startTime: comando.inicio,
    });

    // Totales
    const mainDate = comando.fecha;
    let totals: number[];
    if (pkg) {
      const pkgPrice = Number(pkg.pricePen);
      totals = scheduled.map((s, i) => {
        if ((s.addonPricePen || 0) > 0) return Number(s.addonPricePen) || 0; // trial-addon por separado
        if (i === 0) return pkgPrice; // precio del paquete a la primera cita
        return 0;
      });
    } else {
      totals = [];
      for (let i = 0; i < scheduled.length; i++) {
        const s = scheduled[i];
        const svc = s.service;
        const sel = comando.items[i].modifierSelections;
        let priceBase = Number(svc.pricePen) || 0;
        if (sel && Object.keys(sel).length > 0 && svc.modifierGroups) {
          const valErrs = this.precios.validarRequeridos(svc, sel);
          if (valErrs.length > 0) {
            throw new SeleccionRequeridaError(`"${svc.name}": ${valErrs.map((e) => e.name).join(', ')} requerido(s)`);
          }
          const priced = this.precios.calcular(svc, sel);
          if (priced.blocked) throw new CitaBloqueadaError(`"${svc.name}": ${priced.blockedReasons.join(', ')}`);
          priceBase = priced.totalPrice;
        }
        totals.push(priceBase + (Number(s.addonPricePen) || 0));
      }
    }
    // Recargo a domicilio: a la primera cita del día principal
    if (comando.aDomicilio && recargo) {
      const idx = scheduled.findIndex((s) => s.date === mainDate);
      totals[idx >= 0 ? idx : 0] += recargo.monto;
    }

    const bookingGroupId = randomUUID();
    const requiresDeposit = !!(pkg && pkg.requiresDeposit);
    const grandTotal = totals.reduce((sum, n) => sum + Number(n || 0), 0);
    const depositPercent = pkg ? pkg.depositPercent ?? DEPOSITO_PORCENTAJE_DEFECTO : 0;
    const depositPen = requiresDeposit ? Math.round(grandTotal * depositPercent) / 100 : 0;

    // Persistencia transaccional (citas + pago)
    const lineas: LineaReserva[] = scheduled.map((s, i) => ({
      onDutyStaff: s.onDutyStaff,
      staffId: s.staffId,
      serviceId: s.serviceId,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      totalPen: totals[i],
    }));

    const { created, payment } = await this.citas.crearLote(ctx, {
      lineas,
      packageId: pkg?.id ?? null,
      bookingGroupId,
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
      },
      recargoMonto: comando.aDomicilio && recargo ? recargo.monto : null,
      mainDate,
      deposito: requiresDeposit ? { requerido: true, percent: depositPercent, pen: depositPen, grandTotal } : null,
    });

    // Notificaciones (fire-and-forget)
    const batchEmail = comando.usuario?.email || comando.guestEmail;
    const batchName = comando.guestName || comando.usuario?.nombre || 'Cliente';
    if (batchEmail) {
      this.notificador.reservaSolicitada(
        created,
        { email: batchEmail, nombre: batchName },
        infoPaqueteDesde(pkg),
        comando.aDomicilio && recargo ? recargo.monto : null,
      );
    }
    if (created[0]) this.notificador.nuevaReservaAlSalon(created[0]);

    return ReservaResultado.desde({
      appointments: created,
      atHomeExtraPen: comando.aDomicilio && recargo ? recargo.monto : null,
      total: grandTotal,
      bookingGroupId,
      package: pkg ? { id: pkg.id, name: pkg.name, pricePen: Number(pkg.pricePen) } : null,
      requiresDeposit,
      depositPen,
      depositPercent,
      bookingPaymentId: payment?.id ?? null,
    });
  }
}
