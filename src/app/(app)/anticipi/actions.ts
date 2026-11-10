'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseAmount } from '@/lib/amount';

// Valore del campo «persona» (PersonPicker): acc:<conto anticipi> · usr:<utente> · new (nome scritto).
function readPerson(form: FormData) {
  const v = String(form.get('person') ?? form.get('account') ?? '');
  if (v.startsWith('acc:')) return { account_id: v.slice(4) };
  if (v.startsWith('usr:')) return { beneficiary_id: v.slice(4), currency: String(form.get('currency') ?? 'MGA') };
  if (v && v !== 'new') return { account_id: v };
  return { holder: String(form.get('holder') ?? '').trim(), currency: String(form.get('currency') ?? 'MGA') };
}

const back = (q: string, persona?: string) => redirect(`/anticipi?${q}${persona && /^[0-9a-f-]{36}$/.test(persona) ? `&persona=${persona}` : ''}`);
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
  const cash = String(form.get('cash') ?? '');
  const give = form.get('op') !== 'return';
  const amount = parseAmount(String(form.get('amount') ?? ''));
  const opDate = String(form.get('date') ?? '') || new Date().toISOString().slice(0, 10);
  if (!cash || !amount || amount <= 0) back('err=missing');
  // persona: conto anticipi esistente, oppure utente / nome nuovo nella valuta della cassa (il conto si crea da solo)
  const who = readPerson(form);
  let adv = 'account_id' in who ? who.account_id ?? '' : '';
  if (!adv) {
    const { data: ca } = await supabase.from('accounts').select('currency').eq('id', cash).maybeSingle();
    const { data: id, error: ea } = await supabase.rpc('advance_account', { p: { ...who, currency: ca?.currency ?? 'MGA' } });
    if (ea) fail(ea);
    adv = String(id ?? '');
  }
  if (!adv) back('err=missing');
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
  const { data: hd } = await supabase.from('accounts').select('holder, name_it').eq('id', adv).maybeSingle();
  const holder = hd?.holder || hd?.name_it || '';
  const { error } = await supabase.rpc('save_movement', { p: {
    client_uuid: String(form.get('client_uuid') || randomUUID()), kind: 'transfer', status: 'recorded', op_date: opDate,
    amount, to_amount: amount, currency: a!.currency, fx_rate: rate,
    account_id: give ? cash : adv, to_account_id: give ? adv : cash,
    description: `${give ? 'Anticipo in contanti a' : 'Restituzione anticipo da'} ${holder}`.trim().slice(0, 500),
    notes: String(form.get('notes') ?? '').trim() || null,
  } });
  const persona = String(form.get('ret_persona') ?? '');
  if (error) { revalidatePath('/', 'layout'); back(`err=${encodeURIComponent(error.message)}`, persona); }
  // restituzione che porta il saldo a zero: gli anticipi consegnati di questa persona si chiudono da soli
  const n = give ? 0 : await closeIfSettled(supabase, adv);
  revalidatePath('/', 'layout');
  back(n ? `ok=closed&n=${n}` : 'ok=1', persona || adv);
}

type Sb = Awaited<ReturnType<typeof createClient>>;
// Saldo della persona a zero (consegnato = speso + restituito): si chiudono le richieste consegnate o in verifica.
async function closeIfSettled(supabase: Sb, account: string) {
  const { data: rows } = await supabase.rpc('advance_summary');
  const r = ((rows ?? []) as { account_id: string; balance: string }[]).find((x) => x.account_id === account);
  if (!r || Math.abs(Number(r.balance)) > 0.004) return 0;
  const { data: open } = await supabase.from('advance_requests').select('id').eq('account_id', account).in('status', ['delivered', 'reported']);
  let n = 0;
  for (const o of open ?? []) {
    const { error } = await supabase.rpc('advance_step', { p: { id: o.id, step: 'close', note: 'saldo a zero: spese giustificate e resto restituito' } });
    if (!error) n += 1;
  }
  return n;
}

// Dal portafoglio della persona: chiude gli anticipi quando il saldo è a zero (es. tutto speso con le ricevute).
export async function closeSettled(form: FormData) {
  const supabase = await createClient();
  const acc = String(form.get('account') ?? '');
  const n = await closeIfSettled(supabase, acc);
  revalidatePath('/', 'layout');
  back(n ? `ok=closed&n=${n}` : 'err=not_settled', acc);
}

// ── Procedura in 5 passi (scelta 8 del 10/11) ──
// 1 Richiesta: chiunque (non sola lettura) per una persona che ha un conto anticipi.
export async function requestAdvance(form: FormData) {
  const supabase = await createClient();
  const amount = parseAmount(String(form.get('amount') ?? ''));
  const { data: rq, error } = await supabase.rpc('advance_request', { p: {
    ...readPerson(form), amount, purpose: String(form.get('purpose') ?? '').trim(),
    role_kind: String(form.get('role_kind') ?? 'volunteer'),
    project_id: String(form.get('project') ?? ''), category_id: String(form.get('category') ?? ''),
    use_date: String(form.get('use_date') ?? ''), report_by: String(form.get('report_by') ?? ''),
  } });
  if (error) { revalidatePath('/', 'layout'); fail(error); }
  // preventivo o stima caricati nel modulo: si collegano alla richiesta appena creata
  const est = String(form.get('estimate_document_id') ?? '');
  if (est && rq) {
    const { error: ea } = await supabase.rpc('advance_attach', { p: { id: (rq as { id: string }).id, kind: 'estimate', document_id: est } });
    if (ea) { revalidatePath('/', 'layout'); back(`ok=req&err=${encodeURIComponent(ea.message)}`); }
  }
  revalidatePath('/', 'layout');
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
  back(`ok=deliver&ric=${id}`);
}
