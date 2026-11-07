'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/env';
import { normLang } from '@/lib/i18n';

// Cambia lingua: cookie (vale anche prima dell'accesso) e, se l'utente è collegato, profilo.
export async function setLang(form: FormData) {
  const lang = normLang(String(form.get('lang')));
  (await cookies()).set('lang', lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  if (supabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) await supabase.from('profiles').update({ lang }).eq('id', data.user.id);
  }
  revalidatePath('/', 'layout');
  const back = String(form.get('back') ?? '/');
  redirect(back.startsWith('/') && !back.startsWith('//') ? back : '/');
}
