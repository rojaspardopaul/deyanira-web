import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Proteger rutas de cliente autenticado
  if (request.nextUrl.pathname.startsWith('/mi-cuenta') && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Proteger panel admin (la autenticación de admin se valida en el cliente con token JWT)
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // La protección real ocurre en el layout del admin que verifica el JWT en localStorage
    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/mi-cuenta/:path*', '/admin/:path*'],
};
