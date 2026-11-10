'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Rimborso di spese pagate di tasca propria: le spese diventano registrate con la data del rimborso.
// client_batch arriva dal modulo: un doppio invio non rimborsa due volte.
export async function reimburse(form: FormData) {
  const supabase = await createClient();
  const ids = form.getAll('id').map(String);
  const { data, error } = await supabase.rpc('reimburse_expenses', { p: {
    ids, account_id: String(form.get('account_id') ?? ''), date: String(form.get('date') ?? ''),
    payment_method_id: String(form.get('method_id') ?? '') || null, client_batch: String(form.get('client_batch') ?? ''),
    device_id: 'web',
  } });
  revalidatePath('/', 'layout');
  const back = `&p=${encodeURIComponent(String(form.get('person') ?? ''))}&c=${encodeURIComponent(String(form.get('currency') ?? ''))}`;
  if (error) redirect(`/rimborsi?err=${encodeURIComponent(error.message)}${back}`);
  redirect(`/rimborsi?ok=${encodeURIComponent((data?.refs ?? []).join(', '))}`);
}
