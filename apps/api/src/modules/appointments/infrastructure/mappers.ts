// Mapper dominio -> persistencia (Prisma). Único punto donde la entidad Cita se
// traduce a la forma de la tabla `appointments`. Réplica fiel del `apptData` legacy.

import type { Prisma } from '@prisma/client';
import type { Cita } from '../domain/Cita';
import { aEstadoBd } from '../domain/mapeoEstado';

export function toPersistence(cita: Cita): Prisma.AppointmentUncheckedCreateInput {
  const data: Prisma.AppointmentUncheckedCreateInput = {
    onDutyStaff: cita.onDutyStaff,
    serviceId: cita.servicioId,
    // America/Lima: padding T12:00:00Z para fechas date-only (igual que la ruta legacy).
    date: new Date(`${cita.fecha}T12:00:00Z`),
    startTime: cita.franja.inicio,
    endTime: cita.franja.fin,
    status: aEstadoBd(cita.estado),
    totalPen: cita.total.monto,
    notes: cita.notas,
    customerId: cita.solicitante.customerId,
    guestName: cita.solicitante.guestName,
    guestPhone: cita.solicitante.guestPhone,
    guestEmail: cita.solicitante.guestEmail,
    atHome: cita.domicilio.aDomicilio,
    atHomeAddress: cita.domicilio.direccion,
    atHomeDistrict: cita.domicilio.distrito,
    atHomeExtraPen: cita.domicilio.recargo ? cita.domicilio.recargo.monto : null,
  };
  if (cita.staffId) data.staffId = cita.staffId;
  if (cita.bookingGroupId) data.bookingGroupId = cita.bookingGroupId;
  if (cita.packageId) data.packageId = cita.packageId;
  return data;
}
