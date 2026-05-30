const { Router } = require('express');
const prisma = require('../../lib/prisma');
const cache = require('../../lib/cache');
const { publicCache } = require('../../middleware/httpCache');

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF_TTL = 5 * 60 * 1000;

// GET /api/staff — estilistas activos
// Cacheado 5 min; se invalida desde admin al modificar staff/horarios (cache.invalidate('staff')).
router.get('/', publicCache(60), async (_req, res, next) => {
  try {
    const staff = await cache.wrap('staff:list', STAFF_TTL, () =>
      prisma.staff.findMany({
        where: { isActive: true },
        include: {
          staffServices: { include: { service: true } },
          schedules: true,
        },
        orderBy: { name: 'asc' },
      })
    );
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

// GET /api/staff/by-service/:serviceId — estilistas que realizan un servicio
router.get('/by-service/:serviceId', publicCache(60), async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.serviceId)) {
      return res.status(400).json({ error: 'serviceId inválido' });
    }
    const staffList = await cache.wrap(`staff:by-service:${req.params.serviceId}`, STAFF_TTL, () =>
      prisma.staff.findMany({
        where: {
          isActive: true,
          staffServices: { some: { serviceId: req.params.serviceId } },
        },
        include: { schedules: true },
      })
    );
    res.json(staffList);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
