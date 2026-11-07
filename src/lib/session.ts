import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { normLang, translator, type Lang } from './i18n';

export type Role = 'super_admin' | 'admin' | 'responsabile' | 'operator' | 'read_only';
export const ADMIN: Role[] = ['super_admin', 'admin'];
export const RESP: Role[] = ['super_admin', 'admin', 'responsabile'];
export const STAFF: Role[] = ['super_admin', 'admin', 'responsabile', 'read_only'];

export type Me = { id: string; org_id: string; full_name: string; role: Role; active: boolean; lang: string; all_projects: boolean };

// Lingua prima dell'accesso: cookie scelto sulla pagina di login, poi lingua del browser.
export async function guestLang(): Promise<Lang> {
  const c = (await cookies()).get('lang')?.value;
  if (c) return normLang(c);
  const al = (await headers()).get('accept-language') ?? '';
  return al.toLowerCase().startsWith('fr') ? 'fr' : 'it';
}

// Utente, profilo, lingua e traduttore per le pagine dell'app. Senza sessione → login.
export async function requireMe() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const { data: me } = await supabase
    .from('profiles')
    .select('id, org_id, full_name, role, active, lang, all_projects')
    .eq('id', auth.user.id)
    .maybeSingle<Me>();
  const lang = me ? normLang(me.lang) : await guestLang();
  return { supabase, user: auth.user, me, lang, t: translator(lang) };
}

export const can = (me: Me | null, roles: Role[]) => Boolean(me && me.active && roles.includes(me.role));
