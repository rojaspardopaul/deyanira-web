const { Router } = require('express');
const { z } = require('zod');

const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');
const { isCustomer, optionalCustomer } = require('../../middleware/auth');
const { sendAppointmentConfirmation, sendAppointmentCancelled, sendNewBookingToSalon, sendBookingConfirmation } = require('../../lib/notifications/email');
const { getAvailableSlots } = require('../../lib/booking/availability');
const { validate, UUID_RE, TIME_RE, DATE_RE, EMAIL_RE, PHONE_RE } = require('../../lib/validate');
const { BadRequest, NotFound, Conflict, TooMany } = require('../../lib/errors');
const { honeypot } = require('../../middleware/abuseGuard');
const { turnstile } = require('../../middleware/turnstile');
const { calculatePrice, validateRequired } = require('../../lib/pricing/calculate');
const { scheduleItems, assertNoConflicts, diffInDays } = require('../../lib/booking/scheduleBatch');
const { randomUUID } = require('crypto');

const router = Router();

// ── Distancias aproximadas (km desde Surco) ──
const DISTRICT_DIST_KM = {
  'Surco':2,'La Molina':6,'San Borja':6,'San Luis':7,'Miraflores':7,
  'San Isidro':8,'Barranco':9,'Chorrillos':10,'Ate':8,'Santa Anita':12,
  'La Victoria':12,'Lince':12,'Jesús María':13,'Magdalena':13,'Pueblo Libre':14,
  'San Miguel':15,'El Agustino':13,'Lima Cercado':14,'Rímac':15,'Breña':15,
  'Villa María del Triunfo':16,'Villa El Salvador':18,'Los Olivos':22,
  'San Martín de Porres':20,'Independencia':21,'Comas':26,
  'San Juan de Lurigancho':20,'Lurigancho':22,'Puente Piedra':30,'Otro':20,
};

function calcAtHomeExtra(district, settings) {
  const distKm  = DISTRICT_DIST_KM[district] ?? 20;
  const basePen = Number(settings.atHomeBasePen ?? 20);
  const baseKm  = Number(settings.atHomeBaseKm  ?? 5);
  const ratePen = Number(settings.atHomeRatePen ?? 3);
  return Math.round((basePen + Math.max(0, distKm - baseKm) * ratePen) * 100) / 100;
}

// ── Zod schemas ───────────────────────────────────────────────
const AvailabilityQuery = z.object({
  staffId:   z.string().optional(),
  serviceId: z.string().regex(UUID_RE),
  date:      z.string().regex(DATE_RE),
  duration:  z.string().regex(/^\d+$/).optional(),
  // Cuando viene de un paquete, usar packageMinHour de Settings (puede ser 06:00)
  forPackage: z.enum(['1', 'true']).optional(),
});

const CreateBody = z.object({
  staffId:    z.string().optional().nullable(),
  serviceId:  z.string().regex(UUID_RE),
  date:       z.string().regex(DATE_RE),
  startTime:  z.string().regex(TIME_RE),
  endTime:    z.string().regex(TIME_RE),
  notes:      z.string().max(500).optional().nullable(),
  guestName:  z.string().trim().min(1).max(100).optional(),
  guestPhone: z.string().regex(PHONE_RE).max(20).optional(),
  guestEmail: z.string().regex(EMAIL_RE).max(150).optional(),
  atHome:         z.boolean().optional(),
  atHomeAddress:  z.string().max(200).optional(),
  atHomeDistrict: z.string().max(80).optional(),
  onDutyStaff: z.boolean().optional(),
  // Selecciones de modificadores dinámicos (opcional para retro-compat):
  //   { [groupId]: { optionIds?: string[], value?: any, quantity?: number } }
  modifierSelections: z.record(z.any()).optional(),
  // Token de Cloudflare Turnstile (verificado por middleware antes de validate)
  turnstileToken: z.string().max(2048).optional(),
  // Honeypot: campo señuelo oculto; un humano nunca lo rellena (verificado por middleware)
  website: z.string().max(100).optional(),
}).strict();

// ── GET /api/appointments/availability ───────────────────────
router.get('/availability', validate({ query: AvailabilityQuery }), async (req, res, next) => {
  try {
    const { staffId, serviceId, date, duration, forPackage } = req.query;
    const resolvedStaffId = (!staffId || staffId === 'on-duty') ? null : staffId;

    if (resolvedStaffId && !UUID_RE.test(resolvedStaffId)) {
      return next(BadRequest('staffId inválido'));
    }
    const durationOverride = duration ? parseInt(duration, 10) : null;
    if (durationOverride !== null && (isNaN(durationOverride) || durationOverride < 1 || durationOverride > 480)) {
      return next(BadRequest('Duración inválida (1–480 min)'));
    }

    const slots = await getAvailableSlots(resolvedStaffId, serviceId, date, durationOverride, {
      forPackage: forPackage === '1' || forPackage === 'true',
    });
    res.json(slots);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/appointments ───────────────────────────────────
router.post('/', optionalCustomer, honeypot('website'), turnstile(), validate({ body: CreateBody }), async (req, res, next) => {
  try {
    const {
      staffId, serviceId, date, startTime, endTime, notes,
      guestName, guestPhone, guestEmail,
      atHome, atHomeAddress, atHomeDistrict, onDutyStaff,
      modifierSelections,
    } = req.body;

    const isOnDuty = Boolean(onDutyStaff) || !staffId || staffId === 'on-duty';
    const resolvedStaffId = (staffId && staffId !== 'on-duty') ? staffId : null;

    if (!isOnDuty && !resolvedStaffId) return next(BadRequest('staffId requerido cuando onDutyStaff no está activo'));
    if (resolvedStaffId && !UUID_RE.test(resolvedStaffId)) return next(BadRequest('staffId inválido'));
    if (startTime >= endTime) return next(BadRequest('endTime debe ser posterior a startTime'));

    if (!req.user && !guestName) return next(BadRequest('Se requiere nombre para reservar como invitado'));
    if (atHome && !atHomeAddress) return next(BadRequest('La dirección es requerida para servicios a domicilio'));

    // Anti-abuse
    if (req.user) {
      const activeCount = await prisma.appointment.count({
        where: { customerId: req.user.id, status: { in: ['pending', 'confirmed'] } },
      });
      if (activeCount >= 10) return next(TooMany('Tienes demasiadas citas activas. Cancela alguna antes de reservar.'));
    } else if (guestPhone) {
      const recentGuest = await prisma.appointment.count({
        where: {
          guestPhone: guestPhone.slice(0, 20),
          status: { in: ['pending', 'confirmed'] },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });
      if (recentGuest >= 5) return next(TooMany('Este número ya tiene citas activas. Por favor contáctanos.'));
    }

    const todayLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    if (date < todayLima) return next(BadRequest('No se pueden crear citas en el pasado'));
    if (date === todayLima) {
      const nowLima = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });
      if (startTime <= nowLima) return next(BadRequest('La hora seleccionada ya pasó'));
    }
    const appointmentDate = new Date(date + 'T12:00:00Z');

    // Garantizar Customer
    if (req.user) {
      const derivedName =
        req.user.user_metadata?.name ||
        req.user.user_metadata?.full_name ||
        req.user.email?.split('@')[0] ||
        'Cliente';
      await prisma.customer.upsert({
        where: { id: req.user.id },
        update: { email: req.user.email || undefined },
        create: { id: req.user.id, name: derivedName, email: req.user.email || null },
      });
    }

    let atHomeExtraPen = null;
    if (atHome) {
      const settings = await prisma.setting.findFirst();
      if (settings && !settings.atHomeEnabled) return next(BadRequest('El servicio a domicilio no está disponible'));
      atHomeExtraPen = settings ? calcAtHomeExtra(atHomeDistrict || 'Otro', settings) : 20;
    }

    let appointment;
    try {
      appointment = await prisma.$transaction(async (tx) => {
        // Verificar que el staff (si se especifica) puede hacer este servicio
        if (resolvedStaffId) {
          const link = await tx.staffService.findFirst({
            where: { staffId: resolvedStaffId, serviceId },
          });
          if (!link) {
            const err = new Error('Esta estilista no realiza ese servicio'); err.status = 409; throw err;
          }
          // Conflictos
          const conflict = await tx.appointment.findFirst({
            where: {
              staffId: resolvedStaffId,
              date: appointmentDate,
              status: { in: ['pending', 'confirmed'] },
              startTime: { lt: endTime },
              endTime:   { gt: startTime },
            },
          });
          if (conflict) {
            const err = new Error('El horario seleccionado no está disponible para esta estilista'); err.status = 409; throw err;
          }
        }

        const service = await tx.service.findUnique({
          where: { id: serviceId },
          include: {
            modifierGroups: {
              include: { options: { orderBy: { sortOrder: 'asc' } } },
              orderBy: { sortOrder: 'asc' },
            },
            conditionalRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
          },
        });
        if (!service || !service.isActive) {
          const err = new Error('Servicio no disponible'); err.status = 404; throw err;
        }

        // Motor de precios autoritativo (anti-tampering): nunca confiamos
        // en el total enviado por el cliente; lo recalculamos server-side.
        const selections = modifierSelections || {};
        const validationErrors = validateRequired(service, selections);
        if (validationErrors.length > 0) {
          const err = new Error(`Faltan selecciones requeridas: ${validationErrors.map(e => e.name).join(', ')}`);
          err.status = 400; throw err;
        }
        const priced = calculatePrice(service, selections);
        if (priced.blocked) {
          const err = new Error(`Reserva bloqueada: ${priced.blockedReasons.join(', ')}`);
          err.status = 409; throw err;
        }
        if (priced.requiresLeadDays != null) {
          const apptTs = new Date(date + 'T' + startTime + ':00').getTime();
          const minTs = Date.now() + priced.requiresLeadDays * 24 * 60 * 60 * 1000;
          if (apptTs < minTs) {
            const err = new Error(`Este servicio requiere reservar al menos ${priced.requiresLeadDays} días antes`);
            err.status = 400; throw err;
          }
        }
        const serviceTotal = priced.totalPrice + (atHome ? (atHomeExtraPen || 0) : 0);

        const apptData = {
          onDutyStaff: isOnDuty,
          serviceId,
          date: appointmentDate,
          startTime, endTime,
          status: 'pending',
          totalPen: serviceTotal,
          notes: notes || null,
          customerId: req.user?.id || null,
          guestName:  guestName || null,
          guestPhone: guestPhone || null,
          guestEmail: guestEmail || null,
          atHome: Boolean(atHome),
          atHomeAddress:  atHome && atHomeAddress  ? atHomeAddress  : null,
          atHomeDistrict: atHome && atHomeDistrict ? atHomeDistrict : null,
          atHomeExtraPen: atHome ? atHomeExtraPen : null,
        };
        if (resolvedStaffId) apptData.staffId = resolvedStaffId;

        return tx.appointment.create({ data: apptData, include: { service: true, staff: true } });
      });
    } catch (err) {
      if (err.status === 404) return next(NotFound(err.message));
      if (err.status === 409) return next(Conflict(err.message));
      throw err;
    }

    const contactEmail = req.user?.email || guestEmail;
    const contactName  = guestName || 'Cliente';

    if (contactEmail) {
      sendAppointmentConfirmation({ appointment, email: contactEmail, name: contactName })
        .catch(err => logger.error('email_failed', { msg: err.message }));
    }
    sendNewBookingToSalon({ appointment })
      .catch(err => logger.error('email_failed', { msg: err.message }));

    res.status(201).json({ appointment, atHomeExtraPen });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/appointments/me ─────────────────────────────────
router.get('/me', isCustomer, async (req, res, next) => {
  try {
    const orConditions = [{ customerId: req.user.id }];
    if (req.user.email) orConditions.push({ guestEmail: req.user.email });
    const appointments = await prisma.appointment.findMany({
      where: { OR: orConditions },
      include: { service: true, staff: true },
      orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
    });
    res.json(appointments);
  } catch (err) { next(err); }
});

// ── PATCH /api/appointments/:id/cancel ──────────────────────
router.patch('/:id/cancel', isCustomer, async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return next(BadRequest('ID inválido'));
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { service: true, staff: true },
    });
    if (!appointment || appointment.customerId !== req.user.id) return next(NotFound('Cita no encontrada'));
    if (['cancelled', 'completed'].includes(appointment.status)) return next(BadRequest('Esta cita no se puede cancelar'));

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data:  { status: 'cancelled' },
      include: { service: true, staff: true },
    });
    const clientEmail = req.user?.email || appointment.guestEmail;
    const clientName  = appointment.guestName || 'Cliente';
    if (clientEmail) {
      sendAppointmentCancelled({ appointment: updated, email: clientEmail, name: clientName, reason: 'Cancelado por el cliente' })
        .catch(err => logger.error('email_failed', { msg: err.message }));
    }
    res.json(updated);
  } catch (err) { next(err); }
});

// ── POST /api/appointments/batch ─────────────────────────────
// Crea N citas en una sola transacción y dispara UN solo email consolidado.
// Body: { packageId?, items: [{ serviceId, staffId?|null, onDuty }],
//         date, startTime, guestName, guestPhone, guestEmail,
//         atHome?, atHomeAddress?, atHomeDistrict?, notes? }
//
// Las citas se programan secuencialmente por estilista:
//   - Servicios para el mismo staffId van uno después del otro
//   - Servicios "on duty" comparten un slot común (por simplicidad)
const BatchItem = z.object({
  serviceId: z.string().regex(UUID_RE),
  staffId:   z.string().optional().nullable(),
  onDuty:    z.boolean().optional(),
  // Fecha y hora propias del item (para servicios con anticipación: prueba de maquillaje 15 días antes,
  // manicura acrílica 1 día antes…). Si se omiten, usan los del batch.
  date:      z.string().regex(DATE_RE).optional(),
  startTime: z.string().regex(TIME_RE).optional(),
  // Sobrecargo opcional sobre el precio normal del servicio (ej. trial addon)
  addonPricePen: z.number().min(0).optional(),
  // Selecciones de modificadores dinámicos por servicio
  modifierSelections: z.record(z.any()).optional(),
}).strict();

const BatchBody = z.object({
  packageId:  z.string().regex(UUID_RE).optional().nullable(),
  items:      z.array(BatchItem).min(1).max(20),
  // Fecha principal (día central del evento). Los items con su propio `date` la sobreescriben.
  date:       z.string().regex(DATE_RE),
  startTime:  z.string().regex(TIME_RE),
  notes:      z.string().max(500).optional().nullable(),
  guestName:  z.string().trim().min(1).max(100).optional(),
  guestPhone: z.string().regex(PHONE_RE).max(20).optional(),
  guestEmail: z.string().regex(EMAIL_RE).max(150).optional(),
  atHome:         z.boolean().optional(),
  atHomeAddress:  z.string().max(200).optional(),
  atHomeDistrict: z.string().max(80).optional(),
  // Token de Cloudflare Turnstile (verificado por middleware antes de validate)
  turnstileToken: z.string().max(2048).optional(),
  // Honeypot: campo señuelo oculto (verificado por middleware antes de validate)
  website: z.string().max(100).optional(),
}).strict();

// diffInDays / addMinutesToTime / scheduleItems / assertNoConflicts viven en
// lib/booking/scheduleBatch.js (compartidos con el alta de paquetes del admin).

router.post('/batch', optionalCustomer, honeypot('website'), turnstile(), validate({ body: BatchBody }), async (req, res, next) => {
  try {
    const {
      packageId, items, date, startTime, notes,
      guestName, guestPhone, guestEmail,
      atHome, atHomeAddress, atHomeDistrict,
    } = req.body;

    if (!req.user && !guestName) return next(BadRequest('Se requiere nombre para reservar como invitado'));
    if (atHome && !atHomeAddress) return next(BadRequest('La dirección es requerida para servicios a domicilio'));

    const todayLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    if (date < todayLima) return next(BadRequest('No se pueden crear citas en el pasado'));
    if (date === todayLima) {
      const nowLima = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });
      if (startTime <= nowLima) return next(BadRequest('La hora seleccionada ya pasó'));
    }
    const appointmentDate = new Date(date + 'T12:00:00Z');

    // Validar package y obtener precio
    let pkg = null;
    if (packageId) {
      pkg = await prisma.servicePackage.findUnique({
        where: { id: packageId },
        include: { eventType: { select: { id: true, name: true, slug: true } } },
      });
      if (!pkg || !pkg.isActive) return next(NotFound('Paquete no encontrado'));
    }

    // Garantizar Customer
    if (req.user) {
      const derivedName =
        req.user.user_metadata?.name ||
        req.user.user_metadata?.full_name ||
        req.user.email?.split('@')[0] ||
        'Cliente';
      await prisma.customer.upsert({
        where: { id: req.user.id },
        update: { email: req.user.email || undefined },
        create: { id: req.user.id, name: derivedName, email: req.user.email || null },
      });
    }

    // Anti-abuse: límite por usuario
    if (req.user) {
      const activeCount = await prisma.appointment.count({
        where: { customerId: req.user.id, status: { in: ['pending', 'confirmed'] } },
      });
      if (activeCount + items.length > 20) {
        return next(TooMany('Tienes demasiadas citas activas. Cancela alguna antes de reservar.'));
      }
    }

    // Calcular recargo a domicilio (una sola vez por reserva)
    let atHomeExtraPen = null;
    if (atHome) {
      const settings = await prisma.setting.findFirst();
      if (settings && !settings.atHomeEnabled) return next(BadRequest('El servicio a domicilio no está disponible'));
      atHomeExtraPen = settings ? calcAtHomeExtra(atHomeDistrict || 'Otro', settings) : 20;
    }

    // Fetch de todos los servicios para conocer duración, precio, parallelGroup y daysBeforeMain.
    // Cuando viene con packageId, aceptamos servicios inactivos también (ej. "Prueba de maquillaje"
    // que el admin maneja sólo dentro del paquete sin exponer en el catálogo público).
    // Incluimos modifierGroups + conditionalRules para calcular precios anti-tampering.
    const serviceIds = Array.from(new Set(items.map((i) => i.serviceId)));
    const services = await prisma.service.findMany({
      where: pkg ? { id: { in: serviceIds } } : { id: { in: serviceIds }, isActive: true },
      include: {
        modifierGroups: {
          include: { options: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
        conditionalRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    const serviceById = new Map(services.map((s) => [s.id, s]));
    for (const it of items) {
      if (!serviceById.has(it.serviceId)) {
        return next(NotFound(`Servicio no encontrado: ${it.serviceId}`));
      }
    }

    // Validar fechas/horas por item respetando daysBeforeMain
    for (const it of items) {
      const svc = serviceById.get(it.serviceId);
      const required = svc.daysBeforeMain || 0;
      const itemDate = it.date || date;
      if (required > 0) {
        if (!it.date) {
          return next(BadRequest(`El servicio "${svc.name}" requiere una fecha propia (mínimo ${required} día(s) antes)`));
        }
        const diff = diffInDays(date, itemDate);
        if (diff < required) {
          return next(BadRequest(`"${svc.name}" debe reservarse al menos ${required} día(s) antes del día principal`));
        }
      }
      if (itemDate < todayLima) {
        return next(BadRequest(`La fecha de "${svc.name}" está en el pasado`));
      }
    }

    // Programación secuencial por estilista/fecha + parallelGroup (lógica compartida)
    const scheduled = scheduleItems({ items, serviceById, date, startTime });

    // Calcular totales:
    // - Si hay paquete, su precio se asigna íntegro a la primera cita; las demás del paquete quedan en 0
    // - Si hay items con `addonPricePen > 0` (ej. trial), ese sobrecargo se asigna a esa cita específicamente
    // - El recargo a domicilio se añade a la primera cita del día principal
    const mainDate = date;
    let appointmentsTotalsPen;
    if (pkg) {
      const pkgPriceNumber = Number(pkg.pricePen);
      appointmentsTotalsPen = scheduled.map((s, i) => {
        const isFirstMain = (i === 0); // primera cita del batch
        const isAddon = (s.addonPricePen || 0) > 0;
        // El trial-addon se factura por separado; el resto va a la primera cita del paquete
        if (isAddon) return Number(s.addonPricePen) || 0;
        if (isFirstMain) return pkgPriceNumber;
        return 0;
      });
    } else {
      // Sin paquete: cada cita tiene su propio precio (recalculado server-side
      // si el cliente envió modifierSelections — anti-tampering).
      appointmentsTotalsPen = [];
      for (let i = 0; i < scheduled.length; i++) {
        const s = scheduled[i];
        const it = items[i];
        const svc = s.service;
        const sel = it.modifierSelections;
        let priceBase = Number(svc.pricePen) || 0;
        if (sel && Object.keys(sel).length > 0 && svc.modifierGroups) {
          const valErrs = validateRequired(svc, sel);
          if (valErrs.length > 0) {
            return next(BadRequest(`"${svc.name}": ${valErrs.map(e => e.name).join(', ')} requerido(s)`));
          }
          const priced = calculatePrice(svc, sel);
          if (priced.blocked) {
            return next(Conflict(`"${svc.name}": ${priced.blockedReasons.join(', ')}`));
          }
          priceBase = priced.totalPrice;
        }
        appointmentsTotalsPen.push(priceBase + (Number(s.addonPricePen) || 0));
      }
    }
    // Recargo a domicilio: a la primera cita del día principal
    if (atHome && atHomeExtraPen) {
      const idx = scheduled.findIndex((s) => s.date === mainDate);
      appointmentsTotalsPen[idx >= 0 ? idx : 0] += atHomeExtraPen;
    }

    // UUID estable que agrupa todas las citas de esta reserva (para confirmar/pagar).
    const bookingGroupId = randomUUID();

    // ¿Esta reserva (paquete) requiere adelanto?
    const requiresDeposit = !!(pkg && pkg.requiresDeposit);
    const grandTotalPen = appointmentsTotalsPen.reduce((sum, n) => sum + Number(n || 0), 0);
    const depositPercent = pkg ? (pkg.depositPercent ?? 50) : 0;
    const depositPen = requiresDeposit
      ? Math.round(grandTotalPen * depositPercent) / 100
      : 0;

    // Crear todo en una transacción (citas + registro de pago si aplica)
    let createdAppointments;
    let bookingPayment = null;
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Verificar conflictos por estilista (lógica compartida)
        await assertNoConflicts(tx, scheduled);

        const created = [];
        for (let i = 0; i < scheduled.length; i++) {
          const s = scheduled[i];
          const itemDateObj = new Date(s.date + 'T12:00:00Z');
          const isMainDate = s.date === mainDate;
          const appt = await tx.appointment.create({
            data: {
              onDutyStaff: s.onDutyStaff,
              staffId: s.staffId,
              serviceId: s.serviceId,
              packageId: pkg?.id || null,
              bookingGroupId,
              date: itemDateObj,
              startTime: s.startTime,
              endTime: s.endTime,
              status: 'pending',
              totalPen: appointmentsTotalsPen[i],
              notes: i === 0 ? (notes || null) : null,
              customerId: req.user?.id || null,
              guestName:  guestName || null,
              guestPhone: guestPhone || null,
              guestEmail: guestEmail || null,
              atHome: Boolean(atHome),
              atHomeAddress:  atHome && atHomeAddress  ? atHomeAddress  : null,
              atHomeDistrict: atHome && atHomeDistrict ? atHomeDistrict : null,
              atHomeExtraPen: isMainDate && i === 0 && atHome ? atHomeExtraPen : null,
            },
            include: { service: true, staff: true },
          });
          created.push(appt);
        }

        let payment = null;
        if (requiresDeposit) {
          payment = await tx.bookingPayment.create({
            data: {
              bookingGroupId,
              packageId: pkg.id,
              customerId: req.user?.id || null,
              customerName: guestName || created[0].guestName || 'Cliente',
              customerEmail: guestEmail || null,
              customerPhone: guestPhone || null,
              totalPen: grandTotalPen,
              depositPercent,
              depositPen,
              paidPen: 0,
              balancePen: grandTotalPen,
              status: 'pending',
            },
          });
        }

        return { created, payment };
      });
      createdAppointments = result.created;
      bookingPayment = result.payment;
    } catch (err) {
      if (err.status === 409) return next(Conflict(err.message));
      if (err.status === 404) return next(NotFound(err.message));
      throw err;
    }

    // POLÍTICA: al RESERVAR no enviamos correo al cliente todavía.
    // El cliente recibirá el correo de confirmación cuando se pague/verifique el
    // adelanto (o cuando el admin confirme). Mientras tanto, solo notificamos al salón.
    sendNewBookingToSalon({ appointment: createdAppointments[0] })
      .catch((err) => logger.error('email_failed', { msg: err.message }));

    res.status(201).json({
      appointments: createdAppointments,
      atHomeExtraPen,
      total: grandTotalPen,
      bookingGroupId,
      package: pkg ? { id: pkg.id, name: pkg.name, pricePen: Number(pkg.pricePen) } : null,
      // Datos para el paso de pago del adelanto
      requiresDeposit,
      depositPen,
      depositPercent,
      bookingPaymentId: bookingPayment?.id || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
