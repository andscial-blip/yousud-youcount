'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseAmount } from '@/lib/amount';

// Tasso mensile (MGA per 1 EUR). Correggere un mese non cambia i movimenti già registrati: ognuno conserva il tasso
// applicato quando è stato salvato. Ogni modifica resta nel registro modifiche (trigger di audit su fx_rates).
export async function saveRate(form: FormData) {
  const supabase = await createClient();
  const [y, m] = String(form.get('month')).split('-').map(Number);
  const rate = parseAmount(String(form.get('rate') ?? ''));
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('profiles').select('org_id').eq('id', auth.user!.id).single();
  if (!rate || !y || !m || !me) redirect('/cambi?err=' + encodeURIComponent('Indica mese e tasso (es. 5.050)'));
  if (rate < 100 || rate > 100000) redirect('/cambi?err=' + encodeURIComponent('Tasso fuori scala: va indicato in MGA per 1 EUR (es. 5.050)'));
  const { error } = await supabase.from('fx_rates').upsert({
    org_id: me.org_id, year: y, month: m, rate, source: String(form.get('source') ?? '').trim().slice(0, 200) || null,
    updated_by: auth.user!.id, updated_at: new Date().toISOString(),
  });
  revalidatePath('/', 'layout');
  redirect(error ? `/cambi?err=${encodeURIComponent(error.message)}` : `/cambi?ok=1&anno=${y}`);
}
