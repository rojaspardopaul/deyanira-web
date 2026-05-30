import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

// Webhook de revalidación on-demand. El backend Express lo invoca tras una
// mutación admin (crear/editar/borrar servicio, staff, settings…) para purgar
// la caché de datos de Next correspondiente, en vez de esperar el revalidate
// por tiempo (hasta 1h). Protegido por un secreto compartido.
//
// Body: { tags: string[] }
// Header: x-revalidate-secret: <REVALIDATE_SECRET>

export const runtime = 'nodejs';

const SECRET = process.env.REVALIDATE_SECRET || '';

// Solo se permiten estas tags (evita invalidaciones arbitrarias).
const ALLOWED = new Set([
  'services', 'staff', 'settings', 'products', 'gallery', 'event-types', 'catalogs', 'promotions',
]);

export async function POST(req: NextRequest) {
  // Si no hay secreto configurado, el endpoint queda deshabilitado (no-op seguro).
  if (!SECRET) return NextResponse.json({ ok: false, reason: 'disabled' }, { status: 503 });

  const provided = req.headers.get('x-revalidate-secret') || '';
  if (provided !== SECRET) {
    return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 });
  }

  let body: { tags?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }

  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string') : [];
  const purged: string[] = [];
  for (const tag of tags) {
    if (ALLOWED.has(tag)) {
      revalidateTag(tag);
      purged.push(tag);
    }
  }

  return NextResponse.json({ ok: true, purged });
}
