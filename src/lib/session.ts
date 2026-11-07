import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';

export type Role = 'super_admin' | 'admin' | 'responsabile' | 'operator' | 'read_only';
export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super amministratore',
  admin: 'Amministratore',
  responsabile: 'Responsabile',
  operator: 'Operatore',
  read_only: 'Sola lettura',
};

export type Me = { id: string; full_name: string; role: Role; active: boolean; lang: string };

// Utente e profilo correnti. Senza sessione → login; profilo sospeso o assente → pagina di avviso.
export async function requireMe() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const { data: me } = await supabase
    .from('profiles')
    .select('id, full_name, role, active, lang')
    .eq('id', auth.user.id)
    .maybeSingle<Me>();
  return { supabase, user: auth.user, me };
}
