const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = Router();

// Login de admin (genera JWT propio, separado de Supabase Auth)
router.post('/admin/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: process.env.ADMIN_JWT_LIFETIME || '8h' }
    );

    res.json({ token, admin: { id: admin.id, name: admin.name, role: admin.role } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
