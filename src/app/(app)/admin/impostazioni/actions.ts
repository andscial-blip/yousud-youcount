'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const KEYS = ['four_eyes', 'require_document', 'ai_reading'];

// Attiva o disattiva un'impostazione dell'ente (solo amministratori: lo garantisce la RLS).
export async function toggleSetting(form: FormData) {
  const key = String(form.get('key'));
  if (!KEYS.includes(key)) redirect('/admin/impostazioni?err=invalid');
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('profiles').select('org_id').eq('id', auth.user!.id).single();
  const { error } = await supabase.from('settings').upsert({
    org_id: me!.org_id, key, value: form.get('value') === 'true', updated_by: auth.user!.id, updated_at: new Date().toISOString(),
  });
  revalidatePath('/', 'layout');
  redirect(error ? `/admin/impostazioni?err=${encodeURIComponent(error.message)}` : '/admin/impostazioni?ok=1');
}
