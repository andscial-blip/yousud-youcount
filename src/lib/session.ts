import { cache } from 'react';
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
// una sola lettura di utente e profilo per richiesta: layout e pagina la condividono (prima erano due giri al database)
export const requireMe = cache(async function requireMe() {
  const supabase = await createClient();
  // getClaims verifica il token di accesso sul server con le chiavi pubbliche del progetto (tenute in memoria):
  // niente chiamata al servizio di autenticazione a ogni pagina, che rallentava ogni cambio di scheda.
  // Se il progetto usa ancora la chiave condivisa, la libreria ripiega da sola su getUser.
  const { data: cl } = await supabase.auth.getClaims();
  const sub = cl?.claims?.sub;
  if (!sub) redirect('/login');
  const { data: me } = await supabase
    .from('profiles')
    .select('id, org_id, full_name, role, active, lang, all_projects')
    .eq('id', sub)
    .maybeSingle<Me>();
  const lang = me ? normLang(me.lang) : await guestLang();
  const user = { id: sub, email: typeof cl?.claims?.email === 'string' ? cl.claims.email : '' };
  return { supabase, user, me, lang, t: translator(lang) };
});

export const can = (me: Me | null, roles: Role[]) => Boolean(me && me.active && roles.includes(me.role));
