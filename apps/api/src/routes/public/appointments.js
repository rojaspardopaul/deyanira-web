const { Router } = require('express');
const { PrismaClient, Prisma } = require('@prisma/client');
const { isCustomer, optionalCustomer } = require('../../middleware/auth');
const { sendAppointmentConfirmation } = require('../../lib/notifications/email');
const { appointmentWhatsAppLink } = require('../../lib/notifications/whatsapp');
const { getAvailableSlots } = require('../../lib/booking/availability');

const prisma = new PrismaClient();
const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/appointments/availability — slots disponibles
router.get('/availability', async (req, res, next) => {
  try {
    const { staffId, serviceId, date } = req.query;

    if (!staffId || !serviceId || !date) {
      return res.status(400).json({ error: 'staffId, serviceId y date son requeridos' });
    }
    if (!UUID_RE.test(staffId) || !UUID_RE.test(serviceId)) {
      return res.status(400).json({ error: 'IDs inválidos' });
    }
    if (!DATE_RE.test(date)) {
      return res.status(400).json({ error: 'Formato de fecha inválido (YYYY-MM-DD)' });
    }

    const slots = await getAvailableSlots(staffId, serviceId, date);
    res.json(slots);
  } catch (err) {
    next(err);
  }
});

// POST /api/appointments — crear cita (cliente logueado o invitado)
router.post('/', optionalCustomer, async (req, res, next) => {
  try {
    const {
      staffId, serviceId, date, startTime, endTime,
      notes, guestName, guestPhone, guestEmail,
    } = req.body;

    if (!staffId || !serviceId || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }
    if (!UUID_RE.test(staffId) || !UUID_RE.test(serviceId)) {
      return res.status(400).json({ error: 'IDs inválidos' });
    }
    if (!DATE_RE.test(date) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      return res.status(400).json({ error: 'Formato de fecha u hora inválido' });
    }
    if (!req.user && !guestName) {
      return res.status(400).json({ error: 'Nombre es requerido para reservas como invitado' });
    }

    const appointmentDate = new Date(date + 'T00:00:00Z');

    // Verificar que la fecha no sea en el pasado
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (appointmentDate < today) {
      return res.status(400).json({ error: 'No se pueden crear citas en el pasado' });
    }

    // Verificar disponibilidad y crear en transacción serializable — previene double-booking
    let appointment;
    try {
      appointment = await prisma.$transaction(async (tx) => {
        const conflict = await tx.appointment.findFirst({
          where: {
            staffId,
            date: appointmentDate,
            status: { in: ['pending', 'confirmed'] },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        });

        if (conflict) {
          const err = new Error('El horario seleccionado no está disponible');
          err.status = 409;
          throw err;
        }

        const service = await tx.service.findUnique({ where: { id: serviceId } });
        if (!service || !service.isActive) {
          const err = new Error('Servicio no disponible');
          err.status = 404;
          throw err;
        }

        return tx.appointment.create({
          data: {
            staffId,
            serviceId,
            date: appointmentDate,
            startTime,
            endTime,
            status: 'pending',
            totalPen: service.pricePen,
            notes: notes ? String(notes).slice(0, 500) : null,
            customerId: req.user?.id || null,
            guestName: guestName ? String(guestName).slice(0, 100) : null,
            guestPhone: guestPhone ? String(guestPhone).slice(0, 20) : null,
            guestEmail: guestEmail ? String(guestEmail).slice(0, 100) : null,
          },
          include: { service: true, staff: true },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }

    const contactEmail = req.user?.email || guestEmail;
    const contactName = guestName || 'Cliente';
    if (contactEmail) {
      sendAppointmentConfirmation({ appointment, email: contactEmail, name: contactName })
        .catch(console.error);
    }

    res.status(201).json({
      appointment,
      whatsappLink: appointmentWhatsAppLink({ appointment, name: contactName }),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/appointments/me — citas del cliente logueado
router.get('/me', isCustomer, async (req, res, next) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { customerId: req.user.id },
      include: { service: true, staff: true },
      orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
    });
    res.json(appointments);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/appointments/:id/cancel — cancelar cita propia
router.patch('/:id/cancel', isCustomer, async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
    });

    if (!appointment || appointment.customerId !== req.user.id) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    if (['cancelled', 'completed'].includes(appointment.status)) {
      return res.status(400).json({ error: 'Esta cita no se puede cancelar' });
    }

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'cancelled' },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
