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

// Dati dell'ente e firmatario per i documenti generati (autocertificazioni). Solo amministratori (RLS).
export async function saveDocDetails(form: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('profiles').select('org_id').eq('id', auth.user!.id).single();
  const s = (k: string, max: number) => String(form.get(k) ?? '').trim().slice(0, max);
  const now = new Date().toISOString();
  const { error } = await supabase.from('settings').upsert([
    { org_id: me!.org_id, key: 'org_details', value: { address: s('address', 300), tax_id: s('tax_id', 40), iban: s('iban', 40).replace(/\s+/g, '') }, updated_by: auth.user!.id, updated_at: now },
    { org_id: me!.org_id, key: 'doc_signer', value: { name: s('signer', 120), role: s('signer_role', 120) }, updated_by: auth.user!.id, updated_at: now },
  ]);
  revalidatePath('/', 'layout');
  redirect(error ? `/admin/impostazioni?err=${encodeURIComponent(error.message)}` : '/admin/impostazioni?ok=1');
}
