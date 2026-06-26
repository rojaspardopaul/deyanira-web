// Cliente HTTP base compartido por todas las features. Extraído del god-file
// lib/api.ts (arquitectura feature-first). Las features importan `apiFetch` + los
// presets de caché desde aquí; lib/api.ts re-exporta para compatibilidad.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  token?: string; // Supabase access_token (clientes)
  revalidate?: number | false;
  /**
   * Admin mode: usa cookies (credentials: 'include') + header X-CSRF-Token.
   * El JWT del admin va en cookie HttpOnly — nunca tocamos localStorage.
   */
  admin?: boolean;
  signal?: AbortSignal;
  // Tags de caché de Next para revalidación on-demand (purgables vía /api/revalidate).
  tags?: string[];
};

// Lee la cookie admin_csrf (no HttpOnly) en el cliente.
function readCsrfCookie(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|;\s*)admin_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, revalidate = 60, admin, signal, tags } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (admin) {
    // El JWT del admin viaja por Bearer (localStorage): la cookie HttpOnly no
    // cruza dominios distintos (web vs API). El backend acepta cookie o Bearer y,
    // con Bearer, no exige CSRF. Si hubiera cookie same-site, también funcionaría.
    const adminJwt = typeof window !== 'undefined' ? window.localStorage.getItem('admin_token') : null;
    if (adminJwt && adminJwt !== 'cookie-session') headers['Authorization'] = `Bearer ${adminJwt}`;
    if (method !== 'GET') {
      const csrf = readCsrfCookie();
      if (csrf) headers['X-CSRF-Token'] = csrf;
    }
  }

  const init: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  };

  // Para admin: enviar cookies. Para llamadas estáticas SSR: usar revalidate.
  if (admin) {
    init.credentials = 'include';
    init.cache = 'no-store';
  } else if (typeof window === 'undefined') {
    (init as RequestInit & { next?: { revalidate: number | false; tags?: string[] } }).next = {
      revalidate,
      ...(tags && tags.length ? { tags } : {}),
    };
  }

  const res = await fetch(`${API_URL}/api${path}`, init);

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: 'Error desconocido' }));
    const err = new Error(errBody.error || `Error ${res.status}`) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = errBody.code;

    // Auto-redirect a /admin/login si la sesión admin caducó.
    if (admin && res.status === 401 && typeof window !== 'undefined') {
      try {
        window.localStorage?.removeItem('admin_token');
        window.localStorage?.removeItem('admin_user');
        window.dispatchEvent(new CustomEvent('admin:session-expired'));
      } catch {
        /* ignore */
      }
    }
    throw err;
  }

  // No-content responses
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Presets de caché (revalidate de Next).
export const STATIC = { revalidate: 3600 } as const;
export const SHOP = { revalidate: 1800 } as const;
export const LIVE = { revalidate: 0 } as const;

// Envelope de paginación (listados admin con ?page).
export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// Construye el query string de paginación (+ filtros extra opcionales).
export function pageQuery(
  opts?: { page?: number; pageSize?: number } & Record<string, string | number | undefined>,
): string {
  const p = new URLSearchParams();
  if (opts) {
    for (const [k, v] of Object.entries(opts)) {
      if (v !== undefined && v !== '') p.set(k, String(v));
    }
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}
