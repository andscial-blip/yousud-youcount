'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseAmount } from '@/lib/amount';

export async function recordCashCount(form: FormData) {
  const supabase = await createClient();
  const raw = String(form.get('counted') ?? '').trim();
  const counted = raw === '0' ? 0 : parseAmount(raw);
  if (counted === null) redirect('/conti?err=invalid');
  const { error } = await supabase.rpc('record_cash_count', {
    p_account: String(form.get('account')), p_date: String(form.get('date')), p_counted: counted,
    p_notes: String(form.get('notes') ?? '') || null,
    p_denominations: String(form.get('denominations') ?? '') ? JSON.parse(String(form.get('denominations'))) : null,
  });
  revalidatePath('/conti');
  redirect(error ? `/conti?err=${encodeURIComponent(error.message)}` : '/conti?ok=cash');
}
