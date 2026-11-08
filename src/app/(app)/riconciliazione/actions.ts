'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const back = (acc: string, q: string) => `/riconciliazione?conto=${encodeURIComponent(acc)}&${q}`;

// Riconciliazione di un conto con l'estratto: il database controlla la quadratura al centesimo.
// client_uuid arriva dal modulo: un doppio invio non crea due riconciliazioni.
export async function reconcile(form: FormData) {
  const supabase = await createClient();
  const acc = String(form.get('account_id') ?? '');
  let items: unknown = [];
  try { items = JSON.parse(String(form.get('items') ?? '[]')); } catch { items = []; }
  const { error } = await supabase.rpc('reconcile_account', { p: {
    account_id: acc, statement_date: String(form.get('statement_date') ?? ''),
    statement_balance: String(form.get('statement_balance') ?? ''), notes: String(form.get('notes') ?? ''),
    client_uuid: String(form.get('client_uuid') ?? ''), items, device_id: 'web',
  } });
  revalidatePath('/', 'layout');
  if (error) redirect(back(acc, `err=${encodeURIComponent(error.message)}`));
  redirect(back(acc, 'ok=1'));
}

export async function cancelReconciliation(form: FormData) {
  const supabase = await createClient();
  const acc = String(form.get('account_id') ?? '');
  const { error } = await supabase.rpc('cancel_reconciliation', {
    p_id: String(form.get('id') ?? ''), p_reason: String(form.get('reason') ?? ''),
  });
  revalidatePath('/', 'layout');
  if (error) redirect(back(acc, `err=${encodeURIComponent(error.message)}`));
  redirect(back(acc, 'cancelled=1'));
}
