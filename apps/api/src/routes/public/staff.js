const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = Router();

// GET /api/staff — estilistas activos
router.get('/', async (_req, res, next) => {
  try {
    const staff = await prisma.staff.findMany({
      where: { isActive: true },
      include: {
        staffServices: { include: { service: true } },
        schedules: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

// GET /api/staff/by-service/:serviceId — estilistas que realizan un servicio
router.get('/by-service/:serviceId', async (req, res, next) => {
  try {
    const staffList = await prisma.staff.findMany({
      where: {
        isActive: true,
        staffServices: { some: { serviceId: req.params.serviceId } },
      },
      include: { schedules: true },
    });
    res.json(staffList);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
