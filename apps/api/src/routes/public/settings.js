const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = Router();

// GET /api/settings/public — configuración pública del salón
router.get('/public', async (_req, res, next) => {
  try {
    const setting = await prisma.setting.findFirst();
    if (!setting) return res.json({});
    // Solo devolver campos públicos (no credenciales internas)
    const { id, updatedAt, ...publicData } = setting;
    res.json(publicData);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
