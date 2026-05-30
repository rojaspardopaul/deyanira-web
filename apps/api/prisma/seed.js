require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Sembrando datos iniciales...');

  // ── Configuración del salón ───────────────────────────────────
  await prisma.setting.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      salonName: 'Deyanira Makeup Beauty',
      phone: '+51999999999',
      whatsapp: '+51999999999',
      email: 'admin@deyaniramakeup.pe',
      address: 'Av. Principal 123, Cieneguilla',
      district: 'Cieneguilla',
      city: 'Lima',
      lat: -12.1109913,
      lng: -76.8182017,
      hoursWeekday: 'Lunes a Viernes: 9:00 - 19:00',
      hoursSaturday: 'Sábado: 9:00 - 17:00',
      hoursSunday: 'Domingo: Cerrado',
      instagramUrl: 'https://instagram.com/deyaniramakeupbeauty',
      facebookUrl: 'https://facebook.com/deyaniramakeup',
      tiktokUrl: 'https://tiktok.com/@deyaniramakeup',
    },
  });
  console.log('✓ Configuración del salón');

  // ── Categorías de servicios ───────────────────────────────────
  const catMaquillaje = await prisma.serviceCategory.upsert({
    where: { slug: 'maquillaje' },
    update: {},
    create: { name: 'Maquillaje', slug: 'maquillaje', icon: 'Sparkles', sortOrder: 1 },
  });
  const catCabello = await prisma.serviceCategory.upsert({
    where: { slug: 'cabello' },
    update: {},
    create: { name: 'Cabello', slug: 'cabello', icon: 'Scissors', sortOrder: 2 },
  });
  const catUnas = await prisma.serviceCategory.upsert({
    where: { slug: 'unas' },
    update: {},
    create: { name: 'Uñas', slug: 'unas', icon: 'Hand', sortOrder: 3 },
  });
  const catCejas = await prisma.serviceCategory.upsert({
    where: { slug: 'cejas' },
    update: {},
    create: { name: 'Cejas', slug: 'cejas', icon: 'Wand2', sortOrder: 4 },
  });
  console.log('✓ Categorías de servicios');

  // ── Servicios ─────────────────────────────────────────────────
  const servicios = [
    // Maquillaje
    { name: 'Maquillaje Social', slug: 'maquillaje-social', description: 'Look elegante para eventos, cenas y reuniones sociales. Dura todo el día.', categoryId: catMaquillaje.id, pricePen: 120, duration: 60 },
    { name: 'Maquillaje de Novia', slug: 'maquillaje-novia', description: 'Look nupcial sofisticado y duradero. Incluye prueba previa y touch-up.', categoryId: catMaquillaje.id, pricePen: 280, duration: 90 },
    { name: 'Maquillaje Artístico', slug: 'maquillaje-artistico', description: 'Diseños creativos y teatrales para producciones, fiestas temáticas y sesiones fotográficas.', categoryId: catMaquillaje.id, pricePen: 180, duration: 90 },
    { name: 'Maquillaje de Quinceañera', slug: 'maquillaje-quinceanera', description: 'Look princesa para el día más especial. Duradero, luminoso y fotogénico.', categoryId: catMaquillaje.id, pricePen: 200, duration: 75 },
    { name: 'Maquillaje Express', slug: 'maquillaje-express', description: 'Look natural y fresco para el día a día o salidas informales. Rápido y efectivo.', categoryId: catMaquillaje.id, pricePen: 80, duration: 30 },
    // Cabello
    { name: 'Corte de Cabello', slug: 'corte-cabello', description: 'Corte personalizado según la forma de tu rostro y estilo de vida. Incluye lavado.', categoryId: catCabello.id, pricePen: 60, duration: 45 },
    { name: 'Tinte Completo', slug: 'tinte-completo', description: 'Cambio de color completo con tintes profesionales de alta calidad. Incluye tratamiento.', categoryId: catCabello.id, pricePen: 150, duration: 120 },
    { name: 'Balayage', slug: 'balayage', description: 'Técnica de iluminación degradada para un look natural y moderno. Efecto sol.', categoryId: catCabello.id, pricePen: 220, duration: 150 },
    { name: 'Keratina', slug: 'keratina', description: 'Tratamiento alisador que elimina el frizz y aporta brillo. Efecto dura 4-6 meses.', categoryId: catCabello.id, pricePen: 280, duration: 180 },
    { name: 'Peinado para Eventos', slug: 'peinado-eventos', description: 'Recogidos, ondas y estilos elaborados para bodas, graduaciones y fiestas.', categoryId: catCabello.id, pricePen: 100, duration: 60 },
    // Uñas
    { name: 'Manicure Básica', slug: 'manicure-basica', description: 'Limpieza, forma y esmaltado tradicional. Manos perfectas y cuidadas.', categoryId: catUnas.id, pricePen: 35, duration: 30 },
    { name: 'Manicure Gel', slug: 'manicure-gel', description: 'Esmaltado semipermanente de larga duración. Sin secado, lista en minutos.', categoryId: catUnas.id, pricePen: 65, duration: 45 },
    { name: 'Uñas Acrílicas', slug: 'unas-acrilicas', description: 'Extensiones de acrílico con diseño personalizado. Fuertes y duraderas.', categoryId: catUnas.id, pricePen: 120, duration: 90 },
    { name: 'Pedicure Completa', slug: 'pedicure-completa', description: 'Cuidado completo de pies: exfoliación, hidratación, corte y esmaltado.', categoryId: catUnas.id, pricePen: 55, duration: 60 },
    { name: 'Nail Art', slug: 'nail-art', description: 'Diseños artísticos únicos a mano. Infinitas posibilidades creativas.', categoryId: catUnas.id, pricePen: 90, duration: 60 },
    // Cejas
    { name: 'Depilación de Cejas', slug: 'depilacion-cejas', description: 'Diseño y depilación con hilo o cera para cejas perfectas y simétricas.', categoryId: catCejas.id, pricePen: 25, duration: 20 },
    { name: 'Laminado de Cejas', slug: 'laminado-cejas', description: 'Tratamiento que alisa y fija las cejas. Efecto peinado perfecto por 6 semanas.', categoryId: catCejas.id, pricePen: 80, duration: 45 },
    { name: 'Microblading', slug: 'microblading', description: 'Técnica semipermanente de pigmentación para cejas densas y naturales. Dura 1-2 años.', categoryId: catCejas.id, pricePen: 450, duration: 120 },
  ];

  for (const s of servicios) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: {},
      create: { ...s, pricePen: s.pricePen },
    });
  }
  console.log(`✓ ${servicios.length} servicios`);

  // ── Staff ─────────────────────────────────────────────────────
  const deyanira = await prisma.staff.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Deyanira López',
      role: 'Maquilladora & Directora',
      bio: 'Fundadora del salón con más de 10 años de experiencia en maquillaje artístico, nupcial y social. Certificada en técnicas internacionales.',
      isActive: true,
    },
  });

  const valeria = await prisma.staff.upsert({
    where: { id: '00000000-0000-0000-0000-000000000011' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000011',
      name: 'Valeria Ríos',
      role: 'Estilista Capilar',
      bio: 'Especialista en colorimetría, keratinas y cortes modernos. Certificada por L\'Oréal Professionnel y Wella.',
      isActive: true,
    },
  });

  const karla = await prisma.staff.upsert({
    where: { id: '00000000-0000-0000-0000-000000000012' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000012',
      name: 'Karla Mendoza',
      role: 'Especialista en Uñas',
      bio: 'Nail artist con 5 años de experiencia. Experta en diseños únicos, acrílico y técnicas de nail art avanzadas.',
      isActive: true,
    },
  });
  console.log('✓ Staff');

  // ── Horarios del staff ────────────────────────────────────────
  const staffList = [deyanira, valeria, karla];
  for (const s of staffList) {
    // Lunes a Viernes (1-5)
    for (let day = 1; day <= 5; day++) {
      await prisma.staffSchedule.upsert({
        where: { id: `00000000-0000-0000-${String(s.id.slice(-4))}-${String(day).padStart(12, '0')}` },
        update: {},
        create: {
          id: `00000000-0000-0000-${String(s.id.slice(-4))}-${String(day).padStart(12, '0')}`,
          staffId: s.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '19:00',
        },
      });
    }
    // Sábado (6)
    await prisma.staffSchedule.upsert({
      where: { id: `00000000-0000-0000-${String(s.id.slice(-4))}-${String(6).padStart(12, '0')}` },
      update: {},
      create: {
        id: `00000000-0000-0000-${String(s.id.slice(-4))}-${String(6).padStart(12, '0')}`,
        staffId: s.id,
        dayOfWeek: 6,
        startTime: '09:00',
        endTime: '17:00',
      },
    });
  }
  console.log('✓ Horarios del staff');

  // ── Categorías de productos ───────────────────────────────────
  const catCuidadoPiel = await prisma.productCategory.upsert({
    where: { slug: 'cuidado-piel' },
    update: {},
    create: { name: 'Cuidado de Piel', slug: 'cuidado-piel', sortOrder: 1 },
  });
  const catMaquillajeProd = await prisma.productCategory.upsert({
    where: { slug: 'maquillaje' },
    update: {},
    create: { name: 'Maquillaje', slug: 'maquillaje', sortOrder: 2 },
  });
  const catCabelloProd = await prisma.productCategory.upsert({
    where: { slug: 'cabello' },
    update: {},
    create: { name: 'Cabello', slug: 'cabello', sortOrder: 3 },
  });
  console.log('✓ Categorías de productos');

  // ── Productos ─────────────────────────────────────────────────
  const productos = [
    { name: 'Base Fluida MAC Studio Fix', slug: 'base-mac-studio-fix', description: 'Base de maquillaje profesional con cobertura total. 35 tonos disponibles.', categoryId: catMaquillajeProd.id, brand: 'MAC', pricePen: 185, comparePrice: 220, stock: 15 },
    { name: 'Labial Matte Charlotte Tilbury', slug: 'labial-charlotte-tilbury', description: 'Labial de larga duración con fórmula cremosa. Acabado mate intenso.', categoryId: catMaquillajeProd.id, brand: 'Charlotte Tilbury', pricePen: 120, stock: 20 },
    { name: 'Contorno Urban Decay', slug: 'contorno-urban-decay', description: 'Paleta de contorno y resaltador profesional. 6 tonos perfectamente combinados.', categoryId: catMaquillajeProd.id, brand: 'Urban Decay', pricePen: 160, comparePrice: 190, stock: 8 },
    { name: 'Suero Vitamina C Neutrogena', slug: 'suero-vitamina-c-neutrogena', description: 'Suero iluminador con 20% de vitamina C pura. Unifica el tono y reduce manchas.', categoryId: catCuidadoPiel.id, brand: 'Neutrogena', pricePen: 95, stock: 25 },
    { name: 'Crema Hidratante Cerave', slug: 'crema-hidratante-cerave', description: 'Hidratación profunda con ceramidas y ácido hialurónico. Para todo tipo de piel.', categoryId: catCuidadoPiel.id, brand: 'CeraVe', pricePen: 75, stock: 30 },
    { name: 'Mascarilla Hidratante L\'Oréal', slug: 'mascarilla-loreal', description: 'Mascarilla reparadora 3 minutos. Cabello suave, brillante y sin frizz.', categoryId: catCabelloProd.id, brand: "L'Oréal", pricePen: 55, comparePrice: 70, stock: 12 },
    { name: 'Serum Capilar Kerastase', slug: 'serum-capilar-kerastase', description: 'Sérum nutritivo para puntas abiertas. Restaura la fibra capilar dañada.', categoryId: catCabelloProd.id, brand: 'Kérastase', pricePen: 180, stock: 10 },
  ];

  for (const p of productos) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: p,
    });
  }
  console.log(`✓ ${productos.length} productos`);

  // ── Reseñas ───────────────────────────────────────────────────
  const resenas = [
    { author: 'María García', rating: 5, text: 'El maquillaje para mi boda quedó perfecto. Deyanira es una artista increíble, te escucha y entiende exactamente lo que quieres. ¡Gracias por hacer mi día especial aún más mágico!', source: 'google' },
    { author: 'Lucía Torres', rating: 5, text: 'Fui por el balayage y quedé enamorada del resultado. Valeria sabe exactamente cómo lograr el color perfecto. El salón es muy acogedor y el trato es excelente.', source: 'google' },
    { author: 'Sofía Ramírez', rating: 5, text: 'Las uñas acrílicas que me hizo Karla son una obra de arte. Duran semanas perfectas y el diseño es único. Definitivamente mi salón favorito en Lima.', source: 'google' },
    { author: 'Andrea López', rating: 5, text: 'Me hicieron el maquillaje para mi graduación y quedé espectacular. Muy profesionales, puntuales y con productos de primera calidad. ¡Volvería mil veces!', source: 'google' },
    { author: 'Camila Vega', rating: 5, text: 'Excelente servicio desde el principio. La keratina quedó increíble, mi cabello está suave y sin frizz. El precio es justo por la calidad que ofrecen.', source: 'manual' },
    { author: 'Patricia Méndez', rating: 5, text: 'El microblading cambió mi vida. Las cejas quedaron naturales y perfectas. Ya no necesito maquillarlas todos los días. Súper recomendado.', source: 'manual' },
  ];

  for (const r of resenas) {
    await prisma.review.create({ data: r }).catch(() => {});
  }
  console.log(`✓ ${resenas.length} reseñas`);

  // ── Admin inicial ─────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@deyanira.pe';
  const adminPass = process.env.ADMIN_PASSWORD || 'Deyanira2026!';
  const hash = await bcrypt.hash(adminPass, 10);

  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Admin Deyanira',
      email: adminEmail,
      passwordHash: hash,
      role: 'owner',
    },
  });
  console.log(`✓ Admin: ${adminEmail}`);

  console.log('\n✅ Seed completado exitosamente!');
}

main()
  .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
