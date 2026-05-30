// Lógica compartida para programar un lote de citas (reserva web /batch y alta
// de paquete desde el admin). Mantiene UNA sola fuente de verdad para:
//   · el cálculo secuencial de horarios por estilista/fecha,
//   · los servicios en paralelo (parallelGroup),
//   · y la detección de conflictos de horario por estilista.
const { calculatePrice } = require('../pricing/calculate');

function addMinutesToTime(time, mins) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function diffInDays(mainDate, otherDate) {
  // Días entre dos YYYY-MM-DD (positivo = otherDate es anterior a mainDate)
  const a = new Date(mainDate + 'T12:00:00Z').getTime();
  const b = new Date(otherDate + 'T12:00:00Z').getTime();
  return Math.round((a - b) / 86400000);
}

// Programa los items en horarios concretos.
//   items:       [{ serviceId, staffId?, onDuty?, date?, startTime?, addonPricePen?, modifierSelections? }]
//   serviceById: Map<serviceId, service(con modifierGroups)>
//   date/startTime: fecha y hora principal del lote
// Devuelve scheduled[]: [{ serviceId, staffId, onDutyStaff, date, startTime, endTime, addonPricePen, service }]
function scheduleItems({ items, serviceById, date, startTime }) {
  const staffNextStartByDate = new Map(); // "fecha|staffKey" → nextStartTime
  const parallelOpenSlots = new Map();    // "fecha|staffKey|grupo" → { startTime, maxEndTime }

  return items.map((it) => {
    const isOnDuty = !!it.onDuty || !it.staffId;
    const staffKey = isOnDuty ? 'on-duty' : it.staffId;
    const itemDate = it.date || date;
    const baseStart = it.startTime || startTime;
    const cursorKey = `${itemDate}|${staffKey}`;
    const svc = serviceById.get(it.serviceId);

    let dur = svc.duration || 60;
    if (it.modifierSelections && Object.keys(it.modifierSelections).length > 0 && svc.modifierGroups) {
      const priced = calculatePrice(svc, it.modifierSelections);
      dur = priced.totalDuration || dur;
    }
    const grp = svc.parallelGroup;

    let s, e;
    if (grp) {
      const pKey = `${itemDate}|${staffKey}|${grp}`;
      const open = parallelOpenSlots.get(pKey);
      if (open) {
        s = open.startTime;
        e = addMinutesToTime(s, dur);
        if (e > open.maxEndTime) {
          open.maxEndTime = e;
          staffNextStartByDate.set(cursorKey, e);
        } else {
          e = open.maxEndTime;
        }
      } else {
        s = staffNextStartByDate.get(cursorKey) || baseStart;
        e = addMinutesToTime(s, dur);
        parallelOpenSlots.set(pKey, { startTime: s, maxEndTime: e });
        staffNextStartByDate.set(cursorKey, e);
      }
    } else {
      s = staffNextStartByDate.get(cursorKey) || baseStart;
      e = addMinutesToTime(s, dur);
      staffNextStartByDate.set(cursorKey, e);
    }

    return {
      serviceId: it.serviceId,
      staffId: isOnDuty ? null : it.staffId,
      onDutyStaff: isOnDuty,
      date: itemDate,
      startTime: s,
      endTime: e,
      addonPricePen: it.addonPricePen || 0,
      service: svc,
    };
  });
}

// Verifica que ninguna cita programada se solape con citas activas existentes
// del mismo estilista. Lanza Error con .status=409 si hay conflicto.
// `tx` es un cliente Prisma (o transacción).
async function assertNoConflicts(tx, scheduled) {
  for (const s of scheduled) {
    if (!s.staffId) continue; // on-duty: el admin asigna luego; no se valida capacidad
    const itemDateObj = new Date(s.date + 'T12:00:00Z');
    const conflict = await tx.appointment.findFirst({
      where: {
        staffId: s.staffId,
        date: itemDateObj,
        status: { in: ['pending', 'confirmed'] },
        startTime: { lt: s.endTime },
        endTime: { gt: s.startTime },
      },
      include: { service: true },
    });
    if (conflict) {
      const err = new Error(
        `Conflicto de horario: la estilista ya tiene "${conflict.service?.name || 'una cita'}" el ${s.date} entre ${conflict.startTime} y ${conflict.endTime}`,
      );
      err.status = 409;
      throw err;
    }
  }
}

module.exports = { addMinutesToTime, diffInDays, scheduleItems, assertNoConflicts };
