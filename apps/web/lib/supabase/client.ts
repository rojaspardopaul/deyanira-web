import { createBrowserClient } from '@supabase/ssr';

// Cliente Supabase para uso en el navegador (componentes Client)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
