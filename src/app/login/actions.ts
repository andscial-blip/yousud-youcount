'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Password dimenticata: invia il link solo se l'indirizzo esiste, ma risponde sempre allo stesso modo
// (nessuno può scoprire quali email sono registrate).
export async function forgotPassword(form: FormData) {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (email.includes('@')) {
    const h = await headers();
    const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm?next=/account/password` });
  }
  redirect('/login?sent=1');
}
