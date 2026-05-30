import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const ADMIN_COOKIE = 'admin_session';

// Caché de validaciones positivas (60s) por valor de cookie. Evita un hit al
// backend en cada navegación admin. Solo cachea OK; el backend revalida
// tokensValidFrom, así una revocación se refleja como máximo en 60s.
const SESSION_TTL_MS = 60_000;
const sessionCache = new Map<string, number>(); // cookie → expiry epoch ms

// Valida la cookie HttpOnly contra el API. Si no es válida, redirige a /admin/login.
// Aplicamos rate-limit implícito vía el rate limiter del API.
async function validateAdminSession(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!cookie) return false;

  const cachedExp = sessionCache.get(cookie);
  if (cachedExp && cachedExp > Date.now()) return true;
  if (cachedExp) sessionCache.delete(cookie); // vencida

  try {
    // Reenviamos sólo la cookie admin (no otras). Add ?ts para evitar caché.
    const res = await fetch(`${API_URL}/api/auth/admin/me`, {
      method: 'GET',
      headers: {
        Cookie: `${ADMIN_COOKIE}=${cookie}`,
        'x-internal-mw': '1',
      },
      cache: 'no-store',
      // 3s timeout via AbortController para no colgar la respuesta
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      sessionCache.set(cookie, Date.now() + SESSION_TTL_MS);
      // Poda básica para que el Map no crezca sin límite
      if (sessionCache.size > 500) {
        const now = Date.now();
        sessionCache.forEach((exp, k) => { if (exp <= now) sessionCache.delete(k); });
      }
    }
    return res.ok;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Admin: protección server-side ────────────────────────────
  if (pathname.startsWith('/admin')) {
    // Excepción: /admin/login es la única ruta pública del panel
    if (pathname === '/admin/login') return NextResponse.next();

    const ok = await validateAdminSession(request);
    if (!ok) {
      const url = new URL('/admin/login', request.url);
      // Sólo persistimos paths internos como `next`, nunca URLs absolutas (open redirect)
      if (pathname && pathname.startsWith('/admin')) {
        url.searchParams.set('next', pathname);
      }
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Cliente (Supabase): proteger /mi-cuenta ──────────────────
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

  if (pathname.startsWith('/mi-cuenta') && !user) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/mi-cuenta/:path*',
    '/admin/:path*',
  ],
};
