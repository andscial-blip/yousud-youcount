import 'server-only';
import { createClient as createPlain, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase/env';

// Operazioni irreversibili: la password si reinserisce ogni volta. Si apre una sessione nuova e temporanea
// solo per questa operazione (il token ha l'accesso con password di pochi secondi fa, che il database controlla),
// si esegue la funzione con quella sessione e poi la si chiude. La password non viene salvata da nessuna parte.
export async function withFreshPassword<T>(email: string, password: string, run: (sb: SupabaseClient) => Promise<T>):
  Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  if (!email || !password) return { ok: false, error: 'Inserisci la password.' };
  const sb = createPlain(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: 'Password non corretta.' };
  try {
    return { ok: true, value: await run(sb) };
  } finally {
    await sb.auth.signOut({ scope: 'local' }).catch(() => {});
  }
}
