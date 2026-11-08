'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseAmount } from '@/lib/amount';
import { buildModel, notTotals, type DocType, type NotLine, type NrsLine } from '@/lib/doc-model';
import { renderPdf } from '@/lib/doc-pdf';
import { storePdf } from '@/lib/store-pdf';

const n = (s: FormDataEntryValue | null) => parseAmount(String(s ?? '')) ?? 0;
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

// Raccoglie dal modulo i campi comuni e quelli del tipo; per notule e note spese l'importo è il totale delle righe.
function readForm(f: FormData) {
  const type = str(f, 'type') as DocType;
  const data: Record<string, unknown> = {};
  for (const k of ['causale', 'causale_txt', 'method', 'desc', 'period', 'activity', 'role', 'code', 'supplier', 'need_by', 'reason', 'ref', 'pay_by', 'received_on', 'paid_on'])
    if (str(f, k)) data[k] = str(f, k);
  for (const k of ['deduc', 'bollo_exempt', 'volunteer', 'advance']) data[k] = f.get(k) === 'on';
  let amount: number | null = parseAmount(str(f, 'amount'));
  if (type === 'NOT') {
    const lines: NotLine[] = [];
    for (let i = 0; i < 8; i++) { const d = str(f, `l${i}_d`), p = n(f.get(`l${i}_p`)); if (d || p) lines.push({ d, q: n(f.get(`l${i}_q`)) || 1, p }); }
    data.lines = lines; data.ritenuta = n(f.get('ritenuta'));
    amount = notTotals(lines, Number(data.ritenuta)).gross;
  }
  if (type === 'NRS') {
    const lines: NrsLine[] = [];
    for (let i = 0; i < 10; i++) { const d = str(f, `l${i}_d`), a = n(f.get(`l${i}_a`)); if (d || a) lines.push({ date: str(f, `l${i}_date`), d, amt: a, doc: f.get(`l${i}_doc`) === 'on' }); }
    data.lines = lines;
    amount = Math.round(lines.reduce((s, l) => s + l.amt, 0) * 100) / 100;
  }
  return { id: str(f, 'id') || undefined, type, lang: str(f, 'lang') || 'it', doc_date: str(f, 'doc_date'), movement_id: str(f, 'movement_id'),
    project_id: str(f, 'project_id'), counterparty_id: str(f, 'counterparty_id'), party_name: str(f, 'party_name'), party_tax_id: str(f, 'party_tax_id'),
    party_address: str(f, 'party_address'), amount: amount ?? '', currency: str(f, 'currency') || 'EUR', data };
}

export async function saveDoc(f: FormData) {
  const p = readForm(f);
  const { data, error } = await (await createClient()).rpc('issued_doc_save', { p });
  if (error) redirect(`/documenti-emessi/${p.id ?? 'nuovo'}?${p.id ? '' : `tipo=${p.type}&`}err=${encodeURIComponent(error.message)}`);
  revalidatePath('/documenti-emessi');
  redirect(`/documenti-emessi/${data.id}?ok=saved`);
}

// Emette (numero definitivo), genera il PDF dal modello, lo archivia e lo collega al documento e al movimento.
export async function issueDoc(f: FormData) {
  const id = str(f, 'id');
  const sb = await createClient();
  const { error } = await sb.rpc('issued_doc_issue', { p_id: id });
  if (error) redirect(`/documenti-emessi/${id}?err=${encodeURIComponent(error.message)}`);
  const { data: d } = await sb.from('issued_docs').select('*, movement:movements(ref, amount_eur, currency, amount), project:projects(name)').eq('id', id).single();
  const [{ data: org }, { data: det }] = await Promise.all([
    sb.from('organizations').select('id, name').single(), sb.from('settings').select('value').eq('key', 'org_details').maybeSingle()]);
  const od = (det?.value ?? {}) as { address?: string; tax_id?: string; iban?: string };
  const eur = d.movement && d.movement.currency === d.currency && Number(d.movement.amount) === Number(d.amount) ? d.movement.amount_eur : null;
  const md = buildModel({ ...d, movement_ref: d.movement?.ref ?? null, project_name: d.project?.name ?? null, amount_eur: eur },
    { name: org!.name, address: od.address, tax_id: od.tax_id, iban: od.iban });
  const bytes = await renderPdf(md);
  const st = await storePdf(sb, { orgId: org!.id, bytes, number: d.number, date: d.doc_date, clientUuid: d.id,
    docType: d.type === 'RIC' || d.type === 'QUI' ? 'receipt' : 'other', total: d.amount, currency: d.currency });
  if (st.error) redirect(`/documenti-emessi/${id}?err=${encodeURIComponent(st.error)}`);
  const { error: aErr } = await sb.rpc('issued_doc_attach', { p_id: id, p_document_id: st.id });
  revalidatePath('/', 'layout');
  redirect(`/documenti-emessi/${id}?${aErr ? `err=${encodeURIComponent(aErr.message)}` : 'ok=issued'}`);
}

export async function cancelDoc(f: FormData) {
  const id = str(f, 'id');
  const { data, error } = await (await createClient()).rpc('issued_doc_cancel', { p_id: id, p_reason: str(f, 'reason') });
  revalidatePath('/documenti-emessi');
  if (error) redirect(`/documenti-emessi/${id}?err=${encodeURIComponent(error.message)}`);
  redirect(data?.outcome === 'deleted' ? '/documenti-emessi?ok=deleted' : `/documenti-emessi/${id}?ok=cancelled`);
}
