import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') || '/mi-cuenta';

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);

    // Sincronizar registro en tabla customers
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      fetch(`${API_URL}/api/customers/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    }
  }

  return NextResponse.redirect(`${origin}${redirect}`);
}
