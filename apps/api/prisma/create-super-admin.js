require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email    = process.env.SUPER_ADMIN_EMAIL    || 'superadmin@deyanira.pe';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin2026!';
  const name     = process.env.SUPER_ADMIN_NAME     || 'Super Admin';

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.upsert({
    where:  { email },
    update: { role: 'super_admin', passwordHash, isActive: true, name },
    create: { name, email, passwordHash, role: 'super_admin', isActive: true },
  });

  console.log(`✓ Super admin creado/actualizado:`);
  console.log(`  ID:    ${admin.id}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Role:  ${admin.role}`);
  console.log(`\nYa puedes iniciar sesión en /admin/login con estas credenciales.`);
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
