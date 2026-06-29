import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// El panel /admin NO se valida aquí: la web y el API viven en dominios distintos,
// así que la cookie de sesión admin no llega al middleware. La protección del admin
// es (1) en el cliente — guard del layout con token Bearer en localStorage — y
// (2) en el API — todos los endpoints admin exigen Bearer válido. Aquí solo
// protegemos /mi-cuenta con la sesión de Supabase (cookies same-site).

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Rutas que exigen cuenta de cliente (sesión Supabase). El checkout requiere
  // estar logueado: así tomamos los datos de la cuenta y asociamos el pedido.
  const protectedPaths = ['/mi-cuenta', '/checkout'];
  const needsAuth = protectedPaths.some(p => pathname === p || pathname.startsWith(p + '/'));

  if (needsAuth && !user) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/mi-cuenta/:path*',
    '/checkout',
    '/checkout/:path*',
  ],
};
