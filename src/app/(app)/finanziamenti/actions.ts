'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseAmount } from '@/lib/amount';

// Crea un finanziamento. Permessi: responsabili e amministratori (RLS).
export async function createGrant(form: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('profiles').select('org_id').eq('id', auth.user!.id).single();
  const s = (k: string) => String(form.get(k) ?? '').trim() || null;
  const { data, error } = await supabase.from('grants').insert({
    org_id: me!.org_id, title: s('title'), code: s('code'), donor_id: s('donor_id'), project_id: s('project_id'),
    currency: s('currency') ?? 'EUR', amount: parseAmount(String(form.get('amount') ?? '')),
    start_date: s('start_date'), end_date: s('end_date'), notes: s('notes'), created_by: auth.user!.id,
  }).select('id').single();
  revalidatePath('/finanziamenti');
  if (error) redirect(`/finanziamenti?err=${encodeURIComponent(error.message)}`);
  redirect(`/finanziamenti/${data.id}`);
}
