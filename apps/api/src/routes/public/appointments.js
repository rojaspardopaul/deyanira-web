const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { getAvailableSlots } = require('../../lib/booking/availability');
const { isCustomer, optionalCustomer } = require('../../middleware/auth');
const { sendAppointmentConfirmation } = require('../../lib/notifications/email');
const { appointmentWhatsAppLink } = require('../../lib/notifications/whatsapp');

const prisma = new PrismaClient();
const router = Router();

// GET /api/appointments/availability — slots disponibles
router.get('/availability', async (req, res, next) => {
  try {
    const { staffId, serviceId, date } = req.query;
    if (!staffId || !serviceId || !date) {
      return res.status(400).json({ error: 'staffId, serviceId y date son requeridos' });
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

    // Verificar disponibilidad del slot solicitado
    const slots = await getAvailableSlots(staffId, serviceId, date);
    const available = slots.some(s => s.start === startTime && s.end === endTime);
    if (!available) {
      return res.status(409).json({ error: 'El horario seleccionado no está disponible' });
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId } });

    const appointment = await prisma.appointment.create({
      data: {
        staffId,
        serviceId,
        date: new Date(date + 'T00:00:00Z'),
        startTime,
        endTime,
        status: 'pending',
        totalPen: service.pricePen,
        notes: notes || null,
        customerId: req.user?.id || null,
        guestName: guestName || null,
        guestPhone: guestPhone || null,
        guestEmail: guestEmail || null,
      },
      include: { service: true, staff: true },
    });

    // Notificación por email
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
