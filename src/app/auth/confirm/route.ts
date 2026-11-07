import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Link ricevuti per email (invito, nuova password): verifica il codice e apre la sessione.
// Modello dei messaggi Supabase: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite (o recovery)
export async function GET(req: NextRequest) {
  const u = req.nextUrl;
  const token_hash = u.searchParams.get('token_hash');
  const type = u.searchParams.get('type') as EmailOtpType | null;
  const next = u.searchParams.get('next') ?? (type === 'invite' || type === 'recovery' ? '/account/password' : '/');
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(safeNext, u.origin));
  }
  return NextResponse.redirect(new URL('/login?err=link', u.origin));
}
