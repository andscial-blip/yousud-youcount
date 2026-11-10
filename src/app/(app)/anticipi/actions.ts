'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseAmount } from '@/lib/amount';

// Valore del campo «persona» (PersonPicker): acc:<conto anticipi> · usr:<utente> · new (nome scritto).
function readPerson(form: FormData) {
  const v = String(form.get('person') ?? form.get('account') ?? '');
  if (v.startsWith('acc:')) return { account_id: v.slice(4), ...(form.get('currency') ? { currency: String(form.get('currency')) } : {}) };
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
  // persona già con un conto anticipi ma richiesta nell'altra valuta: si usa (o si crea) il suo conto in quella valuta
  let who = readPerson(form) as unknown as Record<string, string>;
  if (who.account_id && who.currency) {
    const { data: a } = await supabase.from('accounts').select('holder, name_it, currency').eq('id', who.account_id).maybeSingle();
    if (a && a.currency !== who.currency) who = { holder: a.holder || a.name_it, currency: who.currency };
    else who = { account_id: who.account_id };
  }
  const { data: rq, error } = await supabase.rpc('advance_request', { p: {
    ...who, amount, purpose: String(form.get('purpose') ?? '').trim(),
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
  back((rq as { status?: string } | null)?.status === 'authorized' ? 'ok=req_auth' : 'ok=req');
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

// Ricevuta di consegna firmata sul telefono o sul computer: le due firme (chi riceve, chi consegna) arrivano come PNG,
// si genera il PDF con la dichiarazione, si archivia come «ricevuta di consegna» e si collega alla richiesta.
// Firma elettronica semplice: vale come prova scritta, liberamente valutabile (come la firma su carta fotografata).
export async function signDelivery(id: string, receiverPng: string, giverPng: string, giverName: string): Promise<{ ok: boolean; error?: string }> {
  const { requireMe } = await import('@/lib/session');
  const { money, date } = await import('@/lib/format');
  const { renderDeliveryPdf } = await import('@/lib/delivery-pdf');
  const { storePdf } = await import('@/lib/store-pdf');
  const { supabase, me, lang } = await requireMe();
  if (!me || !['super_admin', 'admin', 'responsabile'].includes(me.role)) return { ok: false, error: 'forbidden' };
  const png = (s: string) => { const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(s); if (!m || m[1].length > 1_500_000) return null; return Uint8Array.from(Buffer.from(m[1], 'base64')); };
  const a = png(receiverPng), b = png(giverPng);
  if (!a || !b) return { ok: false, error: lang === 'fr' ? 'Il manque une signature.' : 'Manca una firma.' };
  const { data: r } = await supabase.from('advance_requests').select('id, status, amount, authorized_amount, currency, purpose, delivered_at, report_by, project_id, accounts(holder, name_it)')
    .eq('id', id).maybeSingle<{ id: string; status: string; amount: string; authorized_amount: string | null; currency: string; purpose: string; delivered_at: string | null;
      report_by: string; project_id: string | null; accounts: { holder: string | null; name_it: string } | null }>();
  if (!r || !r.delivered_at) return { ok: false, error: lang === 'fr' ? 'Il faut d’abord enregistrer la remise.' : 'Prima si registra la consegna.' };
  const [{ data: org }, { data: prj }] = await Promise.all([
    supabase.from('settings').select('value').eq('key', 'org_details').maybeSingle(),
    r.project_id ? supabase.from('projects').select('name').eq('id', r.project_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const ente = ((org?.value ?? {}) as { legal_name?: string }).legal_name || 'YouSud ODV';
  const holder = r.accounts?.holder || r.accounts?.name_it || '–';
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const amt = money(Number(r.authorized_amount ?? r.amount), r.currency, lang);
  const now = new Date();
  const stamp = now.toLocaleString(lang === 'fr' ? 'fr-FR' : 'it-IT', { timeZone: 'Indian/Antananarivo', dateStyle: 'short', timeStyle: 'short' });
  const gName = giverName.trim().slice(0, 120) || me.full_name;
  const bytes = await renderDeliveryPdf({
    org: ente, title: L('Ricevuta di consegna di contanti', 'Reçu de remise d’espèces'),
    paragraphs: [
      L(`Il/la sottoscritto/a ${holder} dichiara di aver ricevuto in contanti da ${ente} la somma di ${amt} il ${date(r.delivered_at)}, per: ${r.purpose}${prj?.name ? ` (${prj.name})` : ''}.`,
        `Je soussigné(e) ${holder} déclare avoir reçu en espèces de ${ente} la somme de ${amt} le ${date(r.delivered_at)}, pour : ${r.purpose}${prj?.name ? ` (${prj.name})` : ''}.`),
      L(`Si impegna a consegnare le ricevute o fatture delle spese entro il ${date(r.report_by)} e a restituire la parte non spesa.`,
        `Je m’engage à remettre les reçus ou factures des dépenses avant le ${date(r.report_by)} et à restituer la partie non dépensée.`),
    ],
    rows: [[L('Importo', 'Montant'), amt], [L('Consegnato il', 'Remis le'), date(r.delivered_at)], [L('Ricevute entro il', 'Reçus avant le'), date(r.report_by)], [L('Rif. richiesta', 'Réf. demande'), r.id.slice(0, 8)]],
    receiver: { label: L('Firma di chi riceve', 'Signature de qui reçoit'), name: holder, png: a },
    giver: { label: L('Firma di chi consegna', 'Signature de qui remet'), name: gName, png: b },
    footer: L(`Firmato sul dispositivo nell'app YouCount il ${stamp} (ora di Antananarivo), registrato da ${me.full_name}.`,
      `Signé sur l'appareil dans l'app YouCount le ${stamp} (heure d'Antananarivo), enregistré par ${me.full_name}.`),
  });
  const stored = await storePdf(supabase, { orgId: me.org_id, bytes, number: `ricevuta-anticipo-${r.id.slice(0, 8)}`, date: now.toISOString().slice(0, 10),
    clientUuid: randomUUID(), docType: 'delivery_receipt', total: Number(r.authorized_amount ?? r.amount), currency: r.currency });
  if (stored.error || !stored.id) return { ok: false, error: stored.error ?? 'store' };
  const { error } = await supabase.rpc('advance_attach', { p: { id: r.id, kind: 'delivery', document_id: stored.id } });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/anticipi', 'layout');
  return { ok: true };
}

// Il super amministratore elimina una richiesta (resta traccia nel registro modifiche).
export async function deleteRequest(form: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('advance_delete', { p_id: String(form.get('id') ?? '') });
  revalidatePath('/', 'layout');
  if (error) fail(error);
  back((data as { had_delivery?: boolean } | null)?.had_delivery ? 'ok=deleted_moved' : 'ok=deleted', String(form.get('ret_persona') ?? ''));
}
