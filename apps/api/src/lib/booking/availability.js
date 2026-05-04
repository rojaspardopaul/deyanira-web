const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Genera slots de tiempo cada `durationMin` minutos entre start y end
function generateSlots(startTime, endTime, durationMin) {
  const slots = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let currentMin = startH * 60 + startM;
  const limitMin = endH * 60 + endM;

  while (currentMin + durationMin <= limitMin) {
    const h = Math.floor(currentMin / 60).toString().padStart(2, '0');
    const m = (currentMin % 60).toString().padStart(2, '0');
    const endSlotMin = currentMin + durationMin;
    const eh = Math.floor(endSlotMin / 60).toString().padStart(2, '0');
    const em = (endSlotMin % 60).toString().padStart(2, '0');
    slots.push({ start: `${h}:${m}`, end: `${eh}:${em}` });
    currentMin += durationMin;
  }
  return slots;
}

// Verifica si dos rangos de tiempo se solapan
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

// Convierte "HH:MM" a minutos totales para comparación
function toMin(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Retorna los slots disponibles para un staff + servicio + fecha
 * @param {string} staffId
 * @param {string} serviceId
 * @param {string} date — "YYYY-MM-DD"
 */
async function getAvailableSlots(staffId, serviceId, date) {
  const dayOfWeek = new Date(date + 'T12:00:00Z').getDay();

  const [service, schedules, existingAppointments] = await Promise.all([
    prisma.service.findUnique({ where: { id: serviceId }, select: { duration: true } }),
    prisma.staffSchedule.findMany({ where: { staffId, dayOfWeek } }),
    prisma.appointment.findMany({
      where: {
        staffId,
        date: new Date(date + 'T00:00:00Z'),
        status: { in: ['pending', 'confirmed'] },
      },
      select: { startTime: true, endTime: true },
    }),
  ]);

  if (!service || schedules.length === 0) return [];

  const allSlots = [];
  for (const schedule of schedules) {
    const slots = generateSlots(schedule.startTime, schedule.endTime, service.duration);
    allSlots.push(...slots);
  }

  // Filtrar slots que se solapan con citas existentes
  return allSlots.filter(slot =>
    !existingAppointments.some(apt =>
      overlaps(
        toMin(slot.start), toMin(slot.end),
        toMin(apt.startTime), toMin(apt.endTime)
      )
    )
  );
}

module.exports = { getAvailableSlots };
