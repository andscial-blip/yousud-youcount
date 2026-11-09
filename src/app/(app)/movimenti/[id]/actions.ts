'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Azioni sul movimento: i permessi li controlla il database; qui si passa solo la richiesta.
const back = (id: string, q: string) => redirect(`/movimenti/${id}?${q}`);

export async function verifyAction(form: FormData) {
  const id = String(form.get('id'));
  const { error } = await (await createClient()).rpc('verify_movement', {
    p_id: id, p_expected_version: Number(form.get('version')),
  });
  revalidatePath('/', 'layout');
  back(id, error ? `err=${encodeURIComponent(error.message)}` : 'ok=verified');
}

export async function reverseAction(form: FormData) {
  const id = String(form.get('id'));
  // client_uuid generato quando la pagina è stata mostrata: un doppio invio non crea due storni
  const cu = String(form.get('client_uuid') || randomUUID());
  const { data, error } = await (await createClient()).rpc('reverse_movement', {
    p_id: id, p_reason: String(form.get('reason') ?? ''), p_client_uuid: cu, p_date: null,
  });
  revalidatePath('/', 'layout');
  if (error) back(id, `err=${encodeURIComponent(error.message)}`);
  redirect(`/movimenti/${data.id}?ok=reversed`);
}

export async function discardAction(form: FormData) {
  const id = String(form.get('id'));
  const { error } = await (await createClient()).rpc('discard_draft', { p_id: id });
  revalidatePath('/', 'layout');
  if (error) back(id, `err=${encodeURIComponent(error.message)}`);
  redirect('/movimenti?stato=draft');
}

// Elimina un movimento dimostrativo (DEMO). I movimenti reali registrati non si eliminano: si stornano.
export async function deleteDemoAction(form: FormData) {
  const id = String(form.get('id'));
  if (form.get('confirm') !== 'on') back(id, `err=${encodeURIComponent('Spunta la conferma per eliminare il movimento dimostrativo.')}`);
  const { error } = await (await createClient()).rpc('movement_delete', { p_id: id });
  revalidatePath('/', 'layout');
  if (error) back(id, `err=${encodeURIComponent(error.message)}`);
  redirect('/movimenti?demo=si&ok=deleted');
}

// Autocertificazione: il database assegna il numero e copia i dati dal movimento; qui si genera il PDF,
// lo si archivia come giustificativo (impronta SHA-256) e lo si collega al movimento.
export async function selfCertAction(form: FormData) {
  const id = String(form.get('id'));
  const supabase = await createClient();
  const { data: s, error } = await supabase.rpc('create_self_cert', { p: {
    movement_id: id, declarant: String(form.get('declarant') ?? ''), declarant_role: String(form.get('declarant_role') ?? ''),
    place: String(form.get('place') ?? ''), reason: String(form.get('reason') ?? ''), lang: String(form.get('lang') ?? 'it'),
  } });
  if (error) back(id, `err=${encodeURIComponent(error.message)}`);
  const { loadOrg } = await import('@/lib/org');
  const [org, { data: mv }] = await Promise.all([
    loadOrg(supabase),
    supabase.from('movements').select('ref').eq('id', id).maybeSingle(),
  ]);
  const { buildModel } = await import('@/lib/doc-model');
  const { renderPdf } = await import('@/lib/doc-pdf');
  const { storePdf } = await import('@/lib/store-pdf');
  const md = buildModel({ type: 'AUT', number: s.number, lang: s.lang, doc_date: new Date().toISOString().slice(0, 10), party_name: s.declarant,
    party_tax_id: null, party_address: null, amount: s.amount, currency: s.currency, amount_eur: s.amount_eur, signer_name: s.signer_name,
    signer_role: s.signer_role, movement_ref: mv?.ref ?? null, project_name: s.project_name,
    data: { declarant: s.declarant, declarant_role: s.declarant_role, place: s.place, reason: s.reason, exp_date: s.exp_date, supplier: s.supplier,
      description: s.description, category: s.category_code, category_fr: s.category_fr, method: s.method, method_fr: s.method_fr } },
    org);
  const bytes = await renderPdf(md);
  const st = await storePdf(supabase, { orgId: org.id, bytes, number: s.number, date: String(s.exp_date), clientUuid: s.id, docType: 'self_cert',
    total: s.amount, currency: s.currency });
  if (st.error) back(id, `err=${encodeURIComponent(st.error)}`);
  const doc = { id: st.id! };
  const { error: aErr } = await supabase.rpc('attach_self_cert', { p_id: s.id, p_document_id: doc.id });
  revalidatePath('/', 'layout');
  back(id, aErr ? `err=${encodeURIComponent(aErr.message)}` : 'ok=aut');
}

export async function signSelfCertAction(form: FormData) {
  const id = String(form.get('id'));
  const { error } = await (await createClient()).rpc('sign_self_cert', { p_id: String(form.get('aut')) });
  revalidatePath('/', 'layout');
  back(id, error ? `err=${encodeURIComponent(error.message)}` : 'ok=aut_signed');
}
