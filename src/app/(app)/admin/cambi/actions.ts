'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseAmount } from '@/lib/amount';

export async function saveRate(form: FormData) {
  const supabase = await createClient();
  const [y, m] = String(form.get('month')).split('-').map(Number);
  const rate = parseAmount(String(form.get('rate') ?? ''));
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('profiles').select('org_id').eq('id', auth.user!.id).single();
  if (!rate || !y || !m || !me) redirect('/admin/cambi?err=invalid');
  const { error } = await supabase.from('fx_rates').upsert({
    org_id: me.org_id, year: y, month: m, rate, source: String(form.get('source') ?? '').slice(0, 200) || null,
    updated_by: auth.user!.id, updated_at: new Date().toISOString(),
  });
  revalidatePath('/admin/cambi');
  redirect(error ? `/admin/cambi?err=${encodeURIComponent(error.message)}` : '/admin/cambi?ok=1');
}
