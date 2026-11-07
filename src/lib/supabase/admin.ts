import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './env';

// Client con la chiave di servizio: SOLO lato server, solo per inviti e invio di link di accesso.
// Non legge né scrive dati contabili: quelli passano sempre dalla sessione dell'utente e dalla RLS.
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
