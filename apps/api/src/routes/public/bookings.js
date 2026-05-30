const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

const prisma = require('../../lib/prisma');
const { uploadImage } = require('../../lib/cloudinary');
const { isCustomer } = require('../../middleware/auth');
const { validate, UUID_RE } = require('../../lib/validate');
const { BadRequest, NotFound, Forbidden } = require('../../lib/errors');

const router = Router();

// Rate-limit estricto para evitar abuso del upload
const shareImageLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 min
  max: 10,                  // 10 uploads por ventana por IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta en unos minutos.' },
});

const ShareBody = z.object({
  appointmentId: z.string().regex(UUID_RE),
  image:         z.string().startsWith('data:image/').max(8 * 1024 * 1024), // base64 con prefijo
}).strict();

// POST /api/bookings/share-image
// Sube una imagen del ticket de la cita a Cloudinary y devuelve la URL pública.
// El cliente la usa para compartir por WhatsApp (wa.me + URL → WhatsApp
// previsualiza la imagen como tarjeta).
//
// Requisitos:
// - Autenticado (Supabase) — solo el dueño de la cita puede pedir la URL
// - La cita debe existir y pertenecer al usuario o coincidir con su email/teléfono
router.post('/share-image', shareImageLimiter, isCustomer, validate({ body: ShareBody }), async (req, res, next) => {
  try {
    const { appointmentId, image } = req.body;

    // Verificar que la cita existe y pertenece (o coincide con datos del) usuario
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        customerId: true,
        guestEmail: true,
        guestPhone: true,
      },
    });
    if (!appt) return next(NotFound('Cita no encontrada'));

    const userId = req.user.id;
    const userEmail = req.user.email;
    const isOwner =
      (appt.customerId && appt.customerId === userId) ||
      (appt.guestEmail && userEmail && appt.guestEmail.toLowerCase() === userEmail.toLowerCase());

    if (!isOwner) return next(Forbidden('No tienes permiso sobre esta cita'));

    // Subir a Cloudinary en una carpeta dedicada
    const uploaded = await uploadImage(image, 'booking-shares');

    res.json({ url: uploaded.url });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
