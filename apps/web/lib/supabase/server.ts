import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Cliente Supabase para uso en Server Components y Route Handlers
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignorar error en Server Components (solo Route Handlers pueden setear cookies)
          }
        },
      },
    }
  );
}
