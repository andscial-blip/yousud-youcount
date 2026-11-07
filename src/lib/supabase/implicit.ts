import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

// Client senza sessione per le email di recupero password: con il flusso "implicit" il link
// funziona anche se si apre l'email su un altro dispositivo (il flusso PKCE no).
export function implicitClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
