const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = Router();

// GET /api/promotions/validate?code=PROMO10&total=150
router.get('/validate', async (req, res, next) => {
  try {
    const { code, total } = req.query;
    if (!code) return res.status(400).json({ error: 'Código requerido' });

    const promo = await prisma.promotion.findUnique({ where: { code: code.toUpperCase() } });

    if (!promo || !promo.isActive) {
      return res.status(404).json({ error: 'Código inválido o expirado' });
    }
    if (promo.expiresAt && new Date() > promo.expiresAt) {
      return res.status(400).json({ error: 'Este código ha expirado' });
    }
    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
      return res.status(400).json({ error: 'Este código ya no está disponible' });
    }
    if (total && Number(total) < Number(promo.minOrderPen)) {
      return res.status(400).json({
        error: `Mínimo de compra: S/ ${promo.minOrderPen}`,
      });
    }

    const discount = promo.type === 'percent'
      ? (Number(total || 0) * Number(promo.value)) / 100
      : Number(promo.value);

    res.json({ valid: true, type: promo.type, value: promo.value, discount });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
