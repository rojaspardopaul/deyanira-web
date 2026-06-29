const { Router } = require('express');
const { z } = require('zod');

const prisma = require('../../lib/prisma');
const { isCustomer } = require('../../middleware/auth');
const { validate, PHONE_RE } = require('../../lib/validate');

const router = Router();

const UpdateMeBody = z.object({
  name:      z.string().trim().min(1).max(100).optional(),
  phone:     z.string().regex(PHONE_RE).max(20).nullable().optional(),
  address:   z.string().trim().max(200).nullable().optional(),
  district:  z.string().trim().max(80).nullable().optional(),
  reference: z.string().trim().max(200).nullable().optional(),
}).strict();

// GET /api/customers/me — devuelve perfil; crea el registro si no existe
router.get('/me', isCustomer, async (req, res, next) => {
  try {
    const derivedName =
      req.user.user_metadata?.name ||
      req.user.user_metadata?.full_name ||
      req.user.email?.split('@')[0] ||
      'Cliente';

    const customer = await prisma.customer.upsert({
      where: { id: req.user.id },
      update: { email: req.user.email || undefined },
      create: { id: req.user.id, name: derivedName, email: req.user.email || null },
      select: { id: true, name: true, phone: true, email: true, address: true, district: true, reference: true },
    });
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/customers/me — actualiza nombre y/o teléfono
router.patch('/me', isCustomer, validate({ body: UpdateMeBody }), async (req, res, next) => {
  try {
    const data = {};
    if (req.body.name !== undefined)      data.name      = req.body.name;
    if (req.body.phone !== undefined)     data.phone     = req.body.phone ? req.body.phone.replace(/\D/g, '').slice(0, 20) : null;
    if (req.body.address !== undefined)   data.address   = req.body.address || null;
    if (req.body.district !== undefined)  data.district  = req.body.district || null;
    if (req.body.reference !== undefined) data.reference = req.body.reference || null;
    if (!Object.keys(data).length) return res.json({ ok: true });

    const customer = await prisma.customer.update({
      where: { id: req.user.id },
      data,
      select: { id: true, name: true, phone: true, email: true, address: true, district: true, reference: true },
    });
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
