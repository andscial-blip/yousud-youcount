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

// ── Procedura in 5 passi (scelta 8 del 10/11) ──
// 1 Richiesta: chiunque (non sola lettura) per una persona che ha un conto anticipi.
export async function requestAdvance(form: FormData) {
  const supabase = await createClient();
  const amount = parseAmount(String(form.get('amount') ?? ''));
  const { error } = await supabase.rpc('advance_request', { p: {
    account_id: String(form.get('account') ?? ''), amount, purpose: String(form.get('purpose') ?? '').trim(),
    role_kind: String(form.get('role_kind') ?? 'volunteer'), beneficiary_id: String(form.get('beneficiary') ?? ''),
    project_id: String(form.get('project') ?? ''), category_id: String(form.get('category') ?? ''),
    use_date: String(form.get('use_date') ?? ''), report_by: String(form.get('report_by') ?? ''),
  } });
  revalidatePath('/', 'layout');
  if (error) fail(error);
  back('ok=req');
}

// 2 Autorizza o respingi · 4 rendiconto fatto · 5 chiusura · annulla
export async function advanceStep(form: FormData) {
  const supabase = await createClient();
  const step = String(form.get('step') ?? '');
  const amount = form.get('amount') ? parseAmount(String(form.get('amount'))) : null;
  const { error } = await supabase.rpc('advance_step', { p: {
    id: String(form.get('id') ?? ''), step, amount, board_ref: String(form.get('board_ref') ?? ''), note: String(form.get('note') ?? ''),
  } });
  revalidatePath('/', 'layout');
  if (error) fail(error);
  back(`ok=${step}`);
}

// 3 Consegna: registra il giroconto cassa → conto anticipi della persona e lo collega alla richiesta.
export async function deliverAdvance(form: FormData) {
  const supabase = await createClient();
  const id = String(form.get('id') ?? ''), cash = String(form.get('cash') ?? '');
  const opDate = String(form.get('date') ?? '') || new Date().toISOString().slice(0, 10);
  const { data: r } = await supabase.from('advance_requests').select('id, account_id, amount, authorized_amount, currency, purpose, status, accounts(holder)')
    .eq('id', id).maybeSingle<{ id: string; account_id: string; amount: string; authorized_amount: string | null; currency: string; purpose: string; status: string; accounts: { holder: string | null } | null }>();
  if (!r || r.status !== 'authorized') back('err=invalid_state');
  const { data: c } = await supabase.from('accounts').select('id, currency, kind').eq('id', cash).maybeSingle();
  if (!c || c.kind === 'advance') back('err=invalid');
  if (c!.currency !== r!.currency) back('err=currency_mismatch');
  let rate: number | null = null;
  if (r!.currency === 'MGA') {
    const { data } = await supabase.rpc('fx_rate_for', { p_date: opDate });
    rate = data ? Number(data) : null;
    if (!rate) back('err=no_rate');
  }
  const amount = Number(r!.authorized_amount ?? r!.amount);
  const { data: mv, error } = await supabase.rpc('save_movement', { p: {
    client_uuid: String(form.get('client_uuid') || randomUUID()), kind: 'transfer', status: 'recorded', op_date: opDate,
    amount, to_amount: amount, currency: r!.currency, fx_rate: rate, account_id: cash, to_account_id: r!.account_id,
    description: `Anticipo in contanti a ${r!.accounts?.holder ?? ''}: ${r!.purpose}`.trim().slice(0, 500),
  } });
  if (error) fail(error);
  const { error: e2 } = await supabase.rpc('advance_step', { p: { id, step: 'deliver', movement_id: (mv as { id: string }).id } });
  revalidatePath('/', 'layout');
  if (e2) fail(e2);
  back('ok=deliver');
}
