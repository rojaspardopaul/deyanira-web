// Seed de Event Types, Paquetes, Add-ons y Beneficios
// Datos extraídos del PDF "Novias Deyanira Makeup Beauty" y del cuaderno (precios actualizados).
//
// Ejecutar:  node apps/api/prisma/seed-packages.js
// O añadirlo al pipeline normal de seed.

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const POLICIES_MD = `### Datos a tomar en cuenta

- Las **pruebas de maquillaje y peinado** son previa coordinación en Deyanira Makeup Beauty.
- La prueba es mínimo **10 días antes** del evento.
- Atención a domicilio dentro de Cieneguilla.
- Para servicios fuera de Cieneguilla el adicional es de **S/ 140**.
- Para reservar fecha y hora se debe realizar un **depósito del 50 %**.
- Una vez realizado el depósito debes enviar el voucher por **WhatsApp**.
- La cancelación total del servicio elegido debe realizarse al menos un día antes o antes de comenzar a recibir el servicio.

> **Nota:** Una vez reservada tu fecha no hay devoluciones. Se reprograma fecha sujeta a disponibilidad de agenda, o el monto cancelado se toma como parte de pago de otros servicios que ofrecemos.`;

const PRESENTATION_NOVIA = `¡Hola, querida novia! Soy **Deyanira Rojas**, y estoy aquí para ofrecerte un servicio de belleza de calidad, escuchándote y adaptándome a tus gustos para que juntas logremos el look de tus sueños para el día de tu boda.

Mi enfoque es brindarte un servicio **personalizado y profesional**, resaltando tu belleza natural con un maquillaje y peinado que te permita sentirte auténticamente tú misma.

Será un honor ser parte de tu gran día. Entiendo lo importante que es este momento para ti, y me dedicaré a crear un look único, personalizado y especial que realce tu belleza y haga que te sientas increíble.`;

const PRESENTATION_QUINCE = `Tus **quince años** son un momento único en la vida — y mereces lucir tan radiante como te sientes.

En Deyanira Makeup Beauty diseñamos cada paquete pensando en ti: peinado, maquillaje y uñas listos para cada momento del día especial, desde la sesión de fotos hasta la fiesta central.

Te asesoramos con tu mamá para elegir el look perfecto y trabajamos con productos profesionales de alta duración que aguantan abrazos, baile y muchas fotos sin retoques.`;

async function getService(slug) {
  return prisma.service.findUnique({ where: { slug } });
}

async function upsertPackage(eventTypeId, slug, data, items) {
  const pkg = await prisma.servicePackage.upsert({
    where: { eventTypeId_slug: { eventTypeId, slug } },
    update: { ...data },
    create: { eventTypeId, slug, ...data },
  });

  // Reemplaza los items (drop + insert) para mantener idempotencia
  await prisma.packageItem.deleteMany({ where: { packageId: pkg.id } });
  if (items.length > 0) {
    await prisma.packageItem.createMany({
      data: items.map((it, idx) => ({
        packageId: pkg.id,
        label: it.label,
        serviceId: it.serviceId || null,
        quantity: it.quantity || 1,
        sortOrder: idx,
      })),
    });
  }
  return pkg;
}

async function main() {
  console.log('🌱 Sembrando Event Types y Paquetes...');

  // Servicios base que ya deberían existir tras el seed principal
  const svcPeinado = await getService('peinado-eventos');
  const svcMaqNovia = await getService('maquillaje-novia');
  const svcMaqQuince = await getService('maquillaje-quinceanera');
  const svcManicureGel = await getService('manicure-gel');
  const svcUnasAcrilicas = await getService('unas-acrilicas');
  const svcPedicure = await getService('pedicure-completa');

  if (!svcPeinado || !svcMaqNovia || !svcMaqQuince) {
    console.warn('⚠️  Faltan servicios base. Ejecuta primero `npm run db:seed` antes que este script.');
  }

  // ── EVENT TYPE: NOVIA ────────────────────────────────────────
  const novia = await prisma.eventType.upsert({
    where: { slug: 'novia' },
    update: {
      name: 'Novia',
      tagline: 'Más que mi profesión, mi pasión',
      shortDesc: 'Paquetes nupciales para que luzcas radiante el día más especial.',
      presentationMd: PRESENTATION_NOVIA,
      policiesMd: POLICIES_MD,
      accentColor: '#C9A030',
      icon: '👰',
      sortOrder: 1,
      highlight: true,
      isActive: true,
    },
    create: {
      name: 'Novia',
      slug: 'novia',
      tagline: 'Más que mi profesión, mi pasión',
      shortDesc: 'Paquetes nupciales para que luzcas radiante el día más especial.',
      presentationMd: PRESENTATION_NOVIA,
      policiesMd: POLICIES_MD,
      accentColor: '#C9A030',
      icon: '👰',
      sortOrder: 1,
      highlight: true,
    },
  });
  console.log('✓ Event Type: Novia');

  // Paquetes de novia (precios actualizados según cuaderno)
  await upsertPackage(novia.id, 'paquete-uno', {
    name: 'Paquete Uno',
    subtitle: 'Esencial',
    description: 'Maquillaje y peinado para que luzcas espectacular.',
    pricePen: 450,
    sortOrder: 1,
  }, [
    { label: 'Peinado', serviceId: svcPeinado?.id },
    { label: 'Maquillaje profesional', serviceId: svcMaqNovia?.id },
  ]);

  await upsertPackage(novia.id, 'paquete-dos', {
    name: 'Paquete Dos',
    subtitle: 'Completo',
    description: 'Maquillaje, peinado y uñas listos para tu día.',
    pricePen: 600,
    sortOrder: 2,
  }, [
    { label: 'Peinado', serviceId: svcPeinado?.id },
    { label: 'Maquillaje profesionals', serviceId: svcMaqNovia?.id },
    { label: 'Manicura esmaltado en gel', serviceId: svcManicureGel?.id },
    { label: 'Pedicura', serviceId: svcPedicure?.id },
  ]);

  await upsertPackage(novia.id, 'paquete-tres', {
    name: 'Paquete Tres',
    subtitle: 'Premium',
    description: 'Paquete completo con uñas acrílicas para máxima duración.',
    pricePen: 650,
    sortOrder: 3,
    highlighted: true,
  }, [
    { label: 'Peinado', serviceId: svcPeinado?.id },
    { label: 'Maquillaje profesional', serviceId: svcMaqNovia?.id },
    { label: 'Manicura acrílica', serviceId: svcUnasAcrilicas?.id },
    { label: 'Pedicura', serviceId: svcPedicure?.id },
  ]);

  await upsertPackage(novia.id, 'paquete-cuatro', {
    name: 'Paquete Cuatro',
    subtitle: 'Con prueba de maquillaje',
    description: 'Incluye prueba de maquillaje previa para asegurar el look perfecto.',
    pricePen: 650,
    hasTrial: true,
    sortOrder: 4,
  }, [
    { label: 'Maquillaje (incluye prueba de maquillaje)', serviceId: svcMaqNovia?.id },
    { label: 'Peinado', serviceId: svcPeinado?.id },
  ]);

  await upsertPackage(novia.id, 'paquete-cinco-maq', {
    name: 'Paquete Cinco — Solo Maquillaje',
    subtitle: 'Novia + 3 familiares',
    description: 'Maquillaje profesional para la novia y 3 acompañantes.',
    pricePen: 800,
    groupSize: 3,
    groupLabel: 'Novia + 3 familiares',
    sortOrder: 5,
  }, [
    { label: 'Maquillaje — Novia', serviceId: svcMaqNovia?.id, quantity: 1 },
    { label: 'Maquillaje — Familiares', serviceId: svcMaqNovia?.id, quantity: 3 },
  ]);

  await upsertPackage(novia.id, 'paquete-cinco-completo', {
    name: 'Paquete Cinco — Completo',
    subtitle: 'Novia + 3 familiares (maquillaje + peinado)',
    description: 'Maquillaje y peinado para la novia y 3 acompañantes.',
    pricePen: 1200,
    groupSize: 3,
    groupLabel: 'Novia + 3 familiares',
    sortOrder: 6,
  }, [
    { label: 'Maquillaje — Novia', serviceId: svcMaqNovia?.id },
    { label: 'Peinado — Novia', serviceId: svcPeinado?.id },
    { label: 'Maquillaje — Familiares', serviceId: svcMaqNovia?.id, quantity: 3 },
    { label: 'Peinado — Familiares', serviceId: svcPeinado?.id, quantity: 3 },
  ]);

  await upsertPackage(novia.id, 'paquete-seis-maq', {
    name: 'Paquete Seis — Solo Maquillaje',
    subtitle: 'Novia + 5 damitas',
    description: 'Maquillaje profesional para la novia y sus 5 damas de honor.',
    pricePen: 1100,
    groupSize: 5,
    groupLabel: 'Novia + 5 damitas',
    sortOrder: 7,
  }, [
    { label: 'Maquillaje — Novia', serviceId: svcMaqNovia?.id },
    { label: 'Maquillaje — Damitas', serviceId: svcMaqNovia?.id, quantity: 5 },
  ]);

  await upsertPackage(novia.id, 'paquete-seis-completo', {
    name: 'Paquete Seis — Completo',
    subtitle: 'Novia + 5 damitas (maquillaje + peinado)',
    description: 'Maquillaje y peinado para la novia y sus 5 damas de honor.',
    pricePen: 1600,
    groupSize: 5,
    groupLabel: 'Novia + 5 damitas',
    sortOrder: 8,
  }, [
    { label: 'Maquillaje — Novia', serviceId: svcMaqNovia?.id },
    { label: 'Peinado — Novia', serviceId: svcPeinado?.id },
    { label: 'Maquillaje — Damitas', serviceId: svcMaqNovia?.id, quantity: 5 },
    { label: 'Peinado — Damitas', serviceId: svcPeinado?.id, quantity: 5 },
  ]);
  console.log('✓ 8 paquetes de Novia');

  // ── EVENT TYPE: QUINCEAÑERA ──────────────────────────────────
  const quince = await prisma.eventType.upsert({
    where: { slug: 'quinceanera' },
    update: {
      name: 'Quinceañera',
      tagline: 'Tu día más especial, perfecto en cada detalle',
      shortDesc: 'Paquetes pensados para tus 15 años — de la sesión de fotos a la fiesta.',
      presentationMd: PRESENTATION_QUINCE,
      policiesMd: POLICIES_MD,
      accentColor: '#FF4FA2',
      icon: '👑',
      sortOrder: 2,
      highlight: true,
      isActive: true,
    },
    create: {
      name: 'Quinceañera',
      slug: 'quinceanera',
      tagline: 'Tu día más especial, perfecto en cada detalle',
      shortDesc: 'Paquetes pensados para tus 15 años — de la sesión de fotos a la fiesta.',
      presentationMd: PRESENTATION_QUINCE,
      policiesMd: POLICIES_MD,
      accentColor: '#FF4FA2',
      icon: '👑',
      sortOrder: 2,
      highlight: true,
    },
  });
  console.log('✓ Event Type: Quinceañera');

  await upsertPackage(quince.id, 'paquete-1', {
    name: 'Paquete 1',
    subtitle: 'Esencial',
    description: 'Peinado y maquillaje para que brilles en tu día.',
    pricePen: 350,
    sortOrder: 1,
  }, [
    { label: 'Peinado', serviceId: svcPeinado?.id },
    { label: 'Maquillaje', serviceId: svcMaqQuince?.id },
  ]);

  await upsertPackage(quince.id, 'paquete-2', {
    name: 'Paquete 2',
    subtitle: 'Belleza completa',
    description: 'Peinado, maquillaje, manicura y pedicura en gel.',
    pricePen: 450,
    sortOrder: 2,
  }, [
    { label: 'Peinado', serviceId: svcPeinado?.id },
    { label: 'Maquillaje', serviceId: svcMaqQuince?.id },
    { label: 'Manicura esmaltado en gel', serviceId: svcManicureGel?.id },
    { label: 'Pedicura esmaltado en gel', serviceId: svcPedicure?.id },
  ]);

  await upsertPackage(quince.id, 'paquete-3', {
    name: 'Paquete 3',
    subtitle: 'Premium',
    description: 'Peinado, maquillaje, manicura acrílica y pedicura en gel.',
    pricePen: 500,
    sortOrder: 3,
    highlighted: true,
  }, [
    { label: 'Peinado', serviceId: svcPeinado?.id },
    { label: 'Maquillaje', serviceId: svcMaqQuince?.id },
    { label: 'Pedicura esmaltado en gel', serviceId: svcPedicure?.id },
    { label: 'Manicura acrílica', serviceId: svcUnasAcrilicas?.id },
  ]);

  await upsertPackage(quince.id, 'paquete-4', {
    name: 'Paquete 4',
    subtitle: 'Doble sesión',
    description: 'Look completo para la sesión de fotos y el día central.',
    pricePen: 750,
    sortOrder: 4,
  }, [
    { label: 'Peinado + Maquillaje (sesión fotos)', serviceId: svcMaqQuince?.id },
    { label: 'Peinado + Maquillaje (día central)', serviceId: svcMaqQuince?.id },
    { label: 'Pedicura esmaltado en gel', serviceId: svcPedicure?.id },
    { label: 'Uñas acrílicas', serviceId: svcUnasAcrilicas?.id },
  ]);
  console.log('✓ 4 paquetes de Quinceañera');

  // ── ADD-ONS ──────────────────────────────────────────────────
  // Aerógrafo: aplica al evento Novia (es el caso clásico)
  await prisma.serviceAddon.deleteMany({ where: { eventTypeId: novia.id } });
  await prisma.serviceAddon.createMany({
    data: [
      {
        eventTypeId: novia.id,
        name: 'Maquillaje con Aerógrafo HD',
        description: 'Acabado perfecto y mayor duración (hasta 24 h). Cubre manchas, tatuajes y cicatrices. Excelente para piel grasa.',
        pricePen: 150,
        icon: '✨',
        sortOrder: 1,
      },
    ],
  });

  // Add-ons globales (eventTypeId null): atención fuera de Cieneguilla
  await prisma.serviceAddon.deleteMany({ where: { eventTypeId: null } });
  await prisma.serviceAddon.create({
    data: {
      name: 'Atención a domicilio fuera de Cieneguilla',
      description: 'Adicional por desplazamiento fuera del distrito de Cieneguilla.',
      pricePen: 140,
      icon: '🚗',
      sortOrder: 99,
    },
  });
  console.log('✓ Add-ons');

  // ── BENEFITS (ventajas del aerógrafo — aplica al evento Novia) ──
  await prisma.eventBenefit.deleteMany({ where: { eventTypeId: novia.id } });
  await prisma.eventBenefit.createMany({
    data: [
      { eventTypeId: novia.id, title: 'Acabado perfecto', description: 'Mayor cobertura y mayor naturalidad al mismo tiempo.', icon: '✨', sortOrder: 1 },
      { eventTypeId: novia.id, title: 'Mayor durabilidad', description: 'Aproximadamente 24 h — dura hasta el final de tu evento.', icon: '⏰', sortOrder: 2 },
      { eventTypeId: novia.id, title: 'Excelente cobertura', description: 'En rostro y cuello. Cubre manchas, tatuajes y cicatrices.', icon: '💎', sortOrder: 3 },
      { eventTypeId: novia.id, title: 'Naturalidad', description: 'Madrinas y caballeros pueden usarlo sin parecer maquillados.', icon: '🌿', sortOrder: 4 },
      { eventTypeId: novia.id, title: 'Mayor higiene', description: 'No se aplica directamente sobre la superficie de la piel.', icon: '🧼', sortOrder: 5 },
      { eventTypeId: novia.id, title: 'Piel de seda', description: 'Tu piel lucirá impecable y muy suave.', icon: '🌸', sortOrder: 6 },
      { eventTypeId: novia.id, title: 'No mancha tu vestido', description: 'Resistente al sudor, besos y lágrimas.', icon: '👗', sortOrder: 7 },
      { eventTypeId: novia.id, title: 'Recomendado para pieles grasas', description: 'Por su larga duración.', icon: '💧', sortOrder: 8 },
    ],
  });
  console.log('✓ Beneficios del aerógrafo');

  console.log('\n✅ Seed de paquetes completado.');
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
