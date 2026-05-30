// Cliente admin lazy: usa service_role key → bypasea Row Level Security.
// SOLO uso server-side; nunca exponer al frontend.
const { createClient } = require('@supabase/supabase-js');
const env = require('../lib/env');

let _client = null;

function getSupabase() {
  if (_client) return _client;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    // No tirar al cargar — sólo cuando se intenta usar.
    throw new Error('Supabase no configurado: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  }
  _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// Proxy para mantener compatibilidad con código existente que hace `supabase.auth.getUser`
const handler = {
  get(_t, prop) {
    const client = getSupabase();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
};

module.exports = new Proxy({}, handler);
module.exports.getSupabase = getSupabase;
