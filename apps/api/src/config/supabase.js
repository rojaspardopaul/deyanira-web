const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

// Cliente admin: usa service_role key → bypasea Row Level Security
// SOLO para uso en el servidor, nunca exponer al frontend
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = supabase;
