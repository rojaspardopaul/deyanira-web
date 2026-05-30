const prisma = require('../prisma');

// Horario por defecto del salón: Lun–Sáb 08:00–20:00
const DEFAULT_SCHEDULE = {
  startTime: '08:00',
  endTime: '20:00',
  enabledDays: new Set([1, 2, 3, 4, 5, 6]), // 1=Lun … 6=Sáb
};

// Intervalo fijo de generación de slots: cada 30 min.
// Esto permite al cliente elegir 9:30, 10:00, 10:30… aunque el servicio dure 90 min.
const SLOT_INTERVAL_MIN = 30;

/**
 * Devuelve la hora mínima de inicio aplicable.
 *   `forPackage=true` usa `packageMinHour` (eventos requieren empezar más temprano).
 */
async function getMinStartTime(forPackage = false) {
  try {
    const s = await prisma.setting.findFirst({
      select: { bookingMinHour: true, packageMinHour: true },
    });
    if (!s) return DEFAULT_SCHEDULE.startTime;
    if (forPackage && s.packageMinHour) return s.packageMinHour;
    return s.bookingMinHour || DEFAULT_SCHEDULE.startTime;
  } catch {
    return DEFAULT_SCHEDULE.startTime;
  }
}

/**
 * Optimiza la duración total de un grupo de servicios considerando `parallelGroup`.
 * Servicios con el mismo `parallelGroup` se ejecutan en paralelo (solo cuenta el más largo).
 *
 * @param {Array<{duration: number, parallelGroup?: string|null}>} services
 * @returns {number} duración total en minutos
 */
function effectiveDurationWithParallel(services) {
  if (!services || services.length === 0) return 0;
  const sequential = [];
  const parallelMax = new Map(); // parallelGroup → max duration in that group
  for (const s of services) {
    const dur = Number(s.duration) || 0;
    const grp = s.parallelGroup;
    if (grp) {
      const prev = parallelMax.get(grp) || 0;
      if (dur > prev) parallelMax.set(grp, dur);
    } else {
      sequential.push(dur);
    }
  }
  return sequential.reduce((a, b) => a + b, 0) + Array.from(parallelMax.values()).reduce((a, b) => a + b, 0);
}

/**
 * Genera todos los slots posibles entre startTime y endTime en intervalos de
 * SLOT_INTERVAL_MIN. Cada slot dura `durationMin` minutos.
 * La condición de inclusión es: currentMin + durationMin <= limitMin
 */
function generateSlots(startTime, endTime, durationMin) {
  const slots = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM]     = endTime.split(':').map(Number);

  let currentMin  = startH * 60 + startM;
  const limitMin  = endH * 60 + endM;

  while (currentMin + durationMin <= limitMin) {
    const h  = Math.floor(currentMin / 60).toString().padStart(2, '0');
    const m  = (currentMin % 60).toString().padStart(2, '0');
    const endSlotMin = currentMin + durationMin;
    const eh = Math.floor(endSlotMin / 60).toString().padStart(2, '0');
    const em = (endSlotMin % 60).toString().padStart(2, '0');
    slots.push({ start: `${h}:${m}`, end: `${eh}:${em}` });
    currentMin += SLOT_INTERVAL_MIN; // avanzar 30 min, no durationMin
  }
  return slots;
}

// Convierte "HH:MM" a minutos totales
function toMin(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Verifica si dos rangos de tiempo se solapan (overlap)
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Genera slots del horario del salón para el caso "Estilista de turno".
 * No verifica disponibilidad de un staff específico; devuelve todos los
 * slots del horario del salón para la fecha (considerando unavailabilities globales).
 */
async function getSalonSlots(date, durationMin, { forPackage = false } = {}) {
  const dayOfWeek = new Date(date + 'T12:00:00Z').getDay();
  const dateObj   = new Date(date + 'T00:00:00Z');

  if (!DEFAULT_SCHEDULE.enabledDays.has(dayOfWeek)) return [];

  // Bloqueos globales (staffId: null = salón cerrado)
  const [unavailabilities, minStart] = await Promise.all([
    prisma.staffUnavailability.findMany({ where: { date: dateObj, staffId: null } }),
    getMinStartTime(forPackage),
  ]);

  if (unavailabilities.some(u => !u.startTime || !u.endTime)) return [];

  const allSlots = generateSlots(minStart, DEFAULT_SCHEDULE.endTime, durationMin);

  const unblocked = allSlots.filter(slot =>
    !unavailabilities.some(u =>
      u.startTime && u.endTime &&
      overlaps(toMin(slot.start), toMin(slot.end), toMin(u.startTime), toMin(u.endTime))
    )
  );

  const todayLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  if (date === todayLima) {
    const nowLima = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });
    return unblocked.filter(s => s.start > nowLima);
  }

  return unblocked;
}

/**
 * Retorna slots disponibles para un staff + servicio + fecha.
 *
 * @param {string|null} staffId   — null para "Estilista de turno"
 * @param {string}      serviceId
 * @param {string}      date      — "YYYY-MM-DD"
 * @param {number|null} durationOverride — si se provee, reemplaza la duración del servicio.
 *   Útil cuando un estilista realiza varios servicios de forma secuencial:
 *   el llamador pasa la duración total acumulada.
 */
async function getAvailableSlots(staffId, serviceId, date, durationOverride = null, opts = {}) {
  const { forPackage = false } = opts;
  // Estilista de turno: no se verifica disponibilidad individual
  if (!staffId) {
    const dur = durationOverride ?? 60;
    return getSalonSlots(date, dur, { forPackage });
  }

  const dayOfWeek = new Date(date + 'T12:00:00Z').getDay();
  const dateObj   = new Date(date + 'T00:00:00Z');

  const [service, schedules, existingAppointments, unavailabilities, minStart] = await Promise.all([
    prisma.service.findUnique({ where: { id: serviceId }, select: { duration: true } }),
    prisma.staffSchedule.findMany({ where: { staffId, dayOfWeek } }),
    prisma.appointment.findMany({
      where: {
        staffId,
        date: dateObj,
        status: { in: ['pending', 'confirmed'] },
      },
      select: { startTime: true, endTime: true },
    }),
    prisma.staffUnavailability.findMany({
      where: {
        date: dateObj,
        OR: [{ staffId }, { staffId: null }],
      },
    }),
    getMinStartTime(forPackage),
  ]);

  if (!service) return [];

  // La duración efectiva: override tiene prioridad (ej. múltiples servicios secuenciales)
  const effectiveDuration = durationOverride ?? service.duration;

  let daySchedules = schedules;
  if (daySchedules.length === 0) {
    if (!DEFAULT_SCHEDULE.enabledDays.has(dayOfWeek)) return [];
    daySchedules = [{ startTime: DEFAULT_SCHEDULE.startTime, endTime: DEFAULT_SCHEDULE.endTime }];
  }
  // Aplicamos el minStart como floor del schedule diario
  daySchedules = daySchedules.map(s => ({
    startTime: s.startTime < minStart ? minStart : s.startTime,
    endTime: s.endTime,
  })).filter(s => s.startTime < s.endTime);

  if (unavailabilities.some(u => !u.startTime || !u.endTime)) return [];

  // Generar slots cada 30 min, verificando que la ventana completa (effectiveDuration) esté libre
  const allSlots = [];
  for (const schedule of daySchedules) {
    allSlots.push(...generateSlots(schedule.startTime, schedule.endTime, effectiveDuration));
  }

  // Filtrar slots ocupados por citas existentes
  const freeSlots = allSlots.filter(slot =>
    !existingAppointments.some(apt =>
      overlaps(toMin(slot.start), toMin(slot.end), toMin(apt.startTime), toMin(apt.endTime))
    )
  );

  // Filtrar bloqueos de unavailability
  const unblocked = freeSlots.filter(slot =>
    !unavailabilities.some(u =>
      u.startTime && u.endTime &&
      overlaps(toMin(slot.start), toMin(slot.end), toMin(u.startTime), toMin(u.endTime))
    )
  );

  // Para hoy, ocultar slots cuya hora de inicio ya pasó (zona Lima)
  const todayLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  if (date === todayLima) {
    const nowLima = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });
    return unblocked.filter(s => s.start > nowLima);
  }

  return unblocked;
}

module.exports = {
  getAvailableSlots,
  getSalonSlots,
  getMinStartTime,
  effectiveDurationWithParallel,
  DEFAULT_SCHEDULE,
};
