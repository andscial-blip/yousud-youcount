'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseAmount } from '@/lib/amount';

const back = (q: string) => redirect(`/anticipi?${q}`);
const fail = (e: { message: string } | null | undefined, fallback = 'invalid') => back(`err=${encodeURIComponent(e?.message ?? fallback)}`);

// Nuova persona: il database crea il suo conto anticipi (solo admin e responsabili).
export async function createAdvanceAccount(form: FormData) {
  const { error } = await (await createClient()).rpc('create_advance_account', {
    p_holder: String(form.get('holder') ?? ''), p_currency: String(form.get('currency') ?? 'MGA'),
    p_location: String(form.get('location') ?? 'MG'),
  });
  revalidatePath('/', 'layout');
  if (error) fail(error);
  back('ok=1');
}

// Consegna (cassa → anticipi) o restituzione (anticipi → cassa): un giroconto registrato.
// Stessa valuta tra i due conti; per gli ariary il tasso del mese (o il precedente) da Tassi di cambio.
export async function moveAdvance(form: FormData) {
  const supabase = await createClient();
  const adv = String(form.get('advance') ?? ''), cash = String(form.get('cash') ?? '');
  const give = form.get('op') !== 'return';
  const amount = parseAmount(String(form.get('amount') ?? ''));
  const opDate = String(form.get('date') ?? '') || new Date().toISOString().slice(0, 10);
  if (!adv || !cash || !amount || amount <= 0) back('err=missing');
  const { data: accs } = await supabase.from('accounts').select('id, currency, kind').in('id', [adv, cash]);
  const a = accs?.find((x) => x.id === adv), c = accs?.find((x) => x.id === cash);
  if (!a || !c || a.kind !== 'advance' || c.kind === 'advance') back('err=invalid');
  if (a!.currency !== c!.currency) back('err=currency_mismatch');
  let rate: number | null = null;
  if (a!.currency === 'MGA') {
    const { data } = await supabase.rpc('fx_rate_for', { p_date: opDate });
    rate = data ? Number(data) : null;
    if (!rate) back('err=no_rate');
  }
  const holder = String(form.get('holder') ?? '');
  const { error } = await supabase.rpc('save_movement', { p: {
    client_uuid: String(form.get('client_uuid') || randomUUID()), kind: 'transfer', status: 'recorded', op_date: opDate,
    amount, to_amount: amount, currency: a!.currency, fx_rate: rate,
    account_id: give ? cash : adv, to_account_id: give ? adv : cash,
    description: `${give ? 'Anticipo in contanti a' : 'Restituzione anticipo da'} ${holder}`.trim().slice(0, 500),
    notes: String(form.get('notes') ?? '').trim() || null,
  } });
  revalidatePath('/', 'layout');
  if (error) fail(error);
  back('ok=1');
}
