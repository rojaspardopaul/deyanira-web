const { Router } = require('express');
const prisma = require('../../lib/prisma');
const cache = require('../../lib/cache');
const { publicCache } = require('../../middleware/httpCache');

const router = Router();

// Allow-list explícita de campos públicos. NUNCA devolver todo el record.
const PUBLIC_FIELDS = [
  'salonName', 'phone', 'whatsapp', 'email', 'address', 'district', 'city',
  'lat', 'lng', 'hoursWeekday', 'hoursSaturday', 'hoursSunday',
  'facebookUrl', 'instagramUrl', 'tiktokUrl',
  'bookingNoticeHours', 'cancellationHours',
  'atHomeEnabled', 'atHomeBasePen', 'atHomeBaseKm', 'atHomeRatePen',
  'bookingTimerSeconds',
  'logoUrl', 'logoDarkUrl', 'logoIconUrl',
  'homeSlides',
  // Datos de pago mostrados al cliente (transferencia/Yape/Plin)
  'yapeNumber', 'yapeName', 'plinNumber',
  'bankName', 'bankAccount', 'bankCci', 'bankAccountHolder',
];

// GET /api/settings/public — configuración pública del salón
// Cacheado 5 min (in-memory) + Cache-Control para CDN/navegador. Se invalida
// desde el panel admin al guardar settings (cache.invalidate('settings')).
router.get('/public', publicCache(60), async (_req, res, next) => {
  try {
    const setting = await cache.wrap('settings:public', 5 * 60 * 1000, () =>
      prisma.setting.findFirst({
        select: Object.fromEntries(PUBLIC_FIELDS.map(f => [f, true])),
      })
    );
    res.json(setting || {});
  } catch (err) {
    next(err);
  }
});

module.exports = router;
