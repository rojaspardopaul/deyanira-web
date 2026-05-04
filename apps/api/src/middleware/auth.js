const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

// Verifica JWT de Supabase Auth (clientes registrados)
async function isCustomer(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Token inválido' });

  req.user = user;
  next();
}

// Verifica JWT de admin (generado por este backend, no por Supabase Auth)
function isAdmin(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token de admin inválido o expirado' });
  }
}

// Permite pasar tanto cliente logueado como invitado (sin token)
async function optionalCustomer(req, _res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) req.user = user;
  }
  next();
}

module.exports = { isCustomer, isAdmin, optionalCustomer };
