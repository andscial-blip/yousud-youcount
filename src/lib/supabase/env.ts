// Configurazione pubblica di Supabase. La chiave "anon" è pubblica per progetto:
// l'accesso ai dati è governato dalla RLS del database, non dal segreto di questa chiave.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
