const { Router } = require('express');
const prisma = require('../../lib/prisma');
const { BadRequest, NotFound } = require('../../lib/errors');

const router = Router();

// GET /api/promotions/validate?code=PROMO10&total=150
// Sólo VALIDA. No incrementa usedCount: eso pasa atómicamente al crear el pedido.
router.get('/validate', async (req, res, next) => {
  try {
    const rawCode = req.query.code;
    if (!rawCode || typeof rawCode !== 'string') return next(BadRequest('Código requerido'));
    const code = rawCode.trim().toUpperCase().slice(0, 50);

    const totalRaw = req.query.total;
    const total = totalRaw ? Number(totalRaw) : 0;
    if (totalRaw && (isNaN(total) || total < 0 || total > 1_000_000)) {
      return next(BadRequest('Total inválido'));
    }

    const promo = await prisma.promotion.findUnique({ where: { code } });

    if (!promo || !promo.isActive) return next(NotFound('Código inválido o expirado'));
    if (promo.expiresAt && new Date() > promo.expiresAt) return next(BadRequest('Este código ha expirado'));
    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
      return next(BadRequest('Este código ya no está disponible'));
    }
    if (total && total < Number(promo.minOrderPen)) {
      return next(BadRequest(`Mínimo de compra: S/ ${promo.minOrderPen}`));
    }

    const discount = promo.type === 'percent'
      ? (total * Number(promo.value)) / 100
      : Number(promo.value);

    res.json({
      valid: true,
      type: promo.type,
      value: promo.value,
      discount: Math.min(discount, total || discount),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
