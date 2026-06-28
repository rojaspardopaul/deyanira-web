const { Router } = require('express');
const prisma = require('../../lib/prisma');
const { validate } = require('../../lib/validate');
const { honeypot } = require('../../middleware/abuseGuard');
const { turnstile } = require('../../middleware/turnstile');
const { ReclamacionSchema } = require('@deyanira/contracts');
const email = require('../../lib/notifications/email');
const logger = require('../../lib/logger');

const router = Router();

// Correlativo secuencial por año: LR-YYYY-NNNNNN
async function nextCorrelativo() {
  const year = new Date().getFullYear();
  const count = await prisma.hojaReclamacion.count({
    where: { correlativo: { startsWith: `LR-${year}-` } },
  });
  return `LR-${year}-${String(count + 1).padStart(6, '0')}`;
}

// POST /api/reclamaciones — registra una hoja del Libro de Reclamaciones (INDECOPI).
router.post('/', honeypot('website'), turnstile(), validate({ body: ReclamacionSchema }), async (req, res, next) => {
  try {
    const b = req.body;
    let reclamo = null;
    // Reintenta ante colisión de correlativo (condición de carrera poco probable).
    for (let attempt = 0; attempt < 3 && !reclamo; attempt++) {
      const correlativo = await nextCorrelativo();
      try {
        reclamo = await prisma.hojaReclamacion.create({
          data: {
            correlativo,
            consumidorNombre: b.consumidorNombre,
            consumidorTipoDoc: b.consumidorTipoDoc,
            consumidorNumDoc: b.consumidorNumDoc,
            consumidorDomicilio: b.consumidorDomicilio,
            consumidorTelefono: b.consumidorTelefono || null,
            consumidorEmail: b.consumidorEmail,
            esMenor: Boolean(b.esMenor),
            apoderadoNombre: b.apoderadoNombre || null,
            bienTipo: b.bienTipo,
            montoReclamado: b.montoReclamado ?? null,
            bienDescripcion: b.bienDescripcion,
            tipo: b.tipo,
            detalle: b.detalle,
            pedido: b.pedido,
          },
        });
      } catch (e) {
        if (e && e.code === 'P2002') continue; // correlativo duplicado → reintenta
        throw e;
      }
    }
    if (!reclamo) throw new Error('No se pudo registrar la reclamación');

    // Notificaciones (no bloquean la respuesta).
    email.sendReclamacionAcuse({ reclamo }).catch((e) => logger.error('reclamo_acuse_failed', { msg: e.message }));
    email.sendReclamacionAlSalon({ reclamo }).catch((e) => logger.error('reclamo_salon_failed', { msg: e.message }));

    res.status(201).json({ ok: true, correlativo: reclamo.correlativo });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
