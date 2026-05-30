const { Router } = require('express');
const prisma = require('../../lib/prisma');

const router = Router();
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helpers
function publicEventType(et) {
  return {
    id: et.id,
    name: et.name,
    slug: et.slug,
    tagline: et.tagline,
    shortDesc: et.shortDesc,
    heroImageUrl: et.heroImageUrl,
    accentColor: et.accentColor,
    icon: et.icon,
    highlight: et.highlight,
    sortOrder: et.sortOrder,
    packagesCount: et._count?.packages ?? undefined,
    fromPricePen: et.packages?.length
      ? Math.min(...et.packages.map((p) => Number(p.pricePen)))
      : undefined,
  };
}

function publicPackage(pkg) {
  return {
    id: pkg.id,
    slug: pkg.slug,
    name: pkg.name,
    subtitle: pkg.subtitle,
    description: pkg.description,
    imageUrl: pkg.imageUrl,
    pricePen: Number(pkg.pricePen),
    comparePricePen: pkg.comparePricePen != null ? Number(pkg.comparePricePen) : null,
    groupSize: pkg.groupSize,
    groupLabel: pkg.groupLabel,
    hasTrial: pkg.hasTrial,
    highlighted: pkg.highlighted,
    sortOrder: pkg.sortOrder,
    requiresDeposit: pkg.requiresDeposit,
    depositPercent: pkg.depositPercent,
    // Toggle "Con prueba de maquillaje" — el cliente puede activarlo en la card
    trialAddon: pkg.trialAddonService
      ? {
          serviceId: pkg.trialAddonService.id,
          name: pkg.trialAddonService.name,
          duration: pkg.trialAddonService.duration,
          longDescriptionMd: pkg.trialAddonService.longDescriptionMd,
          imageUrl: pkg.trialAddonService.imageUrl,
          daysBeforeMain: pkg.trialAddonService.daysBeforeMain,
          extraPricePen: pkg.trialAddonPricePen != null ? Number(pkg.trialAddonPricePen) : 0,
        }
      : null,
    items: (pkg.items || []).map((it) => ({
      id: it.id,
      label: it.label,
      quantity: it.quantity,
      sortOrder: it.sortOrder,
      serviceId: it.serviceId,
      serviceSlug: it.service?.slug,
      duration: it.service?.duration,
      parallelGroup: it.service?.parallelGroup,
      daysBeforeMain: it.service?.daysBeforeMain,
      // Info enriquecida (para acordeón/tooltip)
      longDescriptionMd: it.service?.longDescriptionMd,
      recommendationMd: it.service?.recommendationMd,
      scheduleInfoMd: it.service?.scheduleInfoMd,
      catalogSlug: it.service?.catalogSlug,
    })),
  };
}

// GET /api/event-types — lista de tipos de evento activos
router.get('/', async (_req, res, next) => {
  try {
    const eventTypes = await prisma.eventType.findMany({
      where: { isActive: true },
      include: {
        packages: {
          where: { isActive: true },
          select: { pricePen: true },
        },
        _count: { select: { packages: { where: { isActive: true } } } },
      },
      orderBy: [{ highlight: 'desc' }, { sortOrder: 'asc' }],
    });
    res.json(eventTypes.map(publicEventType));
  } catch (err) {
    next(err);
  }
});

// GET /api/event-types/:slug — detalle (paquetes + addons + beneficios + políticas)
router.get('/:slug', async (req, res, next) => {
  try {
    if (!SLUG_RE.test(req.params.slug)) {
      return res.status(400).json({ error: 'Slug inválido' });
    }
    const et = await prisma.eventType.findUnique({
      where: { slug: req.params.slug },
      include: {
        packages: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            items: {
              orderBy: { sortOrder: 'asc' },
              include: {
                service: {
                  select: {
                    id: true, slug: true, duration: true,
                    parallelGroup: true, daysBeforeMain: true,
                    longDescriptionMd: true, recommendationMd: true,
                    scheduleInfoMd: true, catalogSlug: true,
                  },
                },
              },
            },
            trialAddonService: {
              select: {
                id: true, name: true, duration: true,
                longDescriptionMd: true, imageUrl: true, daysBeforeMain: true,
              },
            },
          },
        },
        benefits: { orderBy: { sortOrder: 'asc' } },
        addons: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!et || !et.isActive) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    // Add-ons globales (eventTypeId null) que aplican a todos
    const globalAddons = await prisma.serviceAddon.findMany({
      where: { eventTypeId: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({
      ...publicEventType({ ...et, _count: { packages: et.packages.length } }),
      presentationMd: et.presentationMd,
      policiesMd: et.policiesMd,
      packages: et.packages.map(publicPackage),
      benefits: et.benefits.map((b) => ({
        id: b.id, title: b.title, description: b.description, icon: b.icon,
      })),
      addons: [...et.addons, ...globalAddons].map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        pricePen: Number(a.pricePen),
        icon: a.icon,
        global: a.eventTypeId === null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/event-types/packages/:id — detalle de un paquete (usado por BookingWizard)
router.get('/packages/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const pkg = await prisma.servicePackage.findUnique({
      where: { id: req.params.id },
      include: {
        eventType: { select: { id: true, name: true, slug: true, accentColor: true } },
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            service: {
              select: {
                id: true, name: true, slug: true, duration: true, pricePen: true, categoryId: true,
                parallelGroup: true, daysBeforeMain: true,
                longDescriptionMd: true, recommendationMd: true,
                scheduleInfoMd: true, catalogSlug: true, imageUrl: true,
              },
            },
          },
        },
        trialAddonService: {
          select: {
            id: true, name: true, duration: true,
            longDescriptionMd: true, imageUrl: true, daysBeforeMain: true,
          },
        },
      },
    });
    if (!pkg || !pkg.isActive) {
      return res.status(404).json({ error: 'Paquete no encontrado' });
    }
    res.json({
      ...publicPackage(pkg),
      eventType: pkg.eventType,
      // Trial addon resuelto
      trialAddon: pkg.trialAddonService
        ? {
            serviceId: pkg.trialAddonService.id,
            name: pkg.trialAddonService.name,
            duration: pkg.trialAddonService.duration,
            extraPricePen: pkg.trialAddonPricePen != null ? Number(pkg.trialAddonPricePen) : 0,
            daysBeforeMain: pkg.trialAddonService.daysBeforeMain,
            longDescriptionMd: pkg.trialAddonService.longDescriptionMd,
            imageUrl: pkg.trialAddonService.imageUrl,
          }
        : null,
      // Para el wizard: array detallado de servicios bookables (uno por reserva a crear)
      bookableServices: pkg.items
        .filter((it) => it.service)
        .flatMap((it, itemIdx) =>
          Array.from({ length: Math.max(1, it.quantity || 1) }, (_, j) => ({
            key: `${it.id}-${j}`,
            packageItemId: it.id,
            serviceId: it.service.id,
            name: it.service.name,
            duration: it.service.duration,
            label: it.label,
            occurrence: j + 1,
            totalOccurrences: it.quantity || 1,
            sortOrder: itemIdx,
            parallelGroup: it.service.parallelGroup,
            daysBeforeMain: it.service.daysBeforeMain,
            longDescriptionMd: it.service.longDescriptionMd,
            recommendationMd: it.service.recommendationMd,
            scheduleInfoMd: it.service.scheduleInfoMd,
            catalogSlug: it.service.catalogSlug,
          })),
        ),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
