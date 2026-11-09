'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { loadOrg } from '@/lib/org';
import { createClient } from '@/lib/supabase/server';
import { buildModel } from '@/lib/doc-model';
import { pickRate, readDocForm } from '@/lib/doc-form';
import { renderPdf } from '@/lib/doc-pdf';
import { storePdf } from '@/lib/store-pdf';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
type Sb = Awaited<ReturnType<typeof createClient>>;

// Tasso del documento fissato al salvataggio: quello del movimento collegato, altrimenti il tasso mensile.
async function docRate(sb: Sb, docDate: string, movementId: string) {
  if (movementId) {
    const { data: m } = await sb.from('movements').select('fx_rate').eq('id', movementId).maybeSingle();
    if (m?.fx_rate) return Number(m.fx_rate);
  }
  const { data } = await sb.from('fx_rates').select('year, month, rate').order('year').order('month');
  return pickRate(Object.fromEntries((data ?? []).map((r) => [`${r.year}-${String(r.month).padStart(2, '0')}`, Number(r.rate)])), docDate);
}

export async function saveDoc(f: FormData) {
  const p = readDocForm(f);
  const sb = await createClient();
  const fx = await docRate(sb, p.doc_date, p.movement_id);
  if (fx) p.data.fx_rate = fx;
  const { data, error } = await sb.rpc('issued_doc_save', { p });
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
  const org = await loadOrg(sb);
  const eur = d.movement && d.movement.currency === d.currency && Number(d.movement.amount) === Number(d.amount) ? d.movement.amount_eur : null;
  const md = buildModel({ ...d, movement_ref: d.movement?.ref ?? null, project_name: d.project?.name ?? null, amount_eur: eur },
    org);
  const bytes = await renderPdf(md);
  const st = await storePdf(sb, { orgId: org.id, bytes, number: d.number, date: d.doc_date, clientUuid: d.id,
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

// Archivia (o ripristina) un documento emesso o annullato: resta numerato e scaricabile, esce dall'elenco corrente.
export async function archiveDoc(f: FormData) {
  const id = str(f, 'id');
  const { error } = await (await createClient()).rpc('issued_doc_archive', { p_id: id, p_on: str(f, 'on') === '1' });
  revalidatePath('/documenti-emessi');
  redirect(`/documenti-emessi/${id}?${error ? `err=${encodeURIComponent(error.message)}` : `ok=${str(f, 'on') === '1' ? 'archived' : 'restored'}`}`);
}
