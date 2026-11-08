'use server';
import { createHash, randomUUID } from 'node:crypto';
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
  const [{ data: org }, { data: det }] = await Promise.all([
    supabase.from('organizations').select('id, name').single(),
    supabase.from('settings').select('value').eq('key', 'org_details').maybeSingle(),
  ]);
  const d = (det?.value ?? {}) as { address?: string; tax_id?: string };
  const { selfCertPdf } = await import('@/lib/selfcert-pdf');
  const bytes = await selfCertPdf(s, { name: org!.name, address: d.address, tax_id: d.tax_id });
  const hash = createHash('sha256').update(bytes).digest('hex');
  const path = `${org!.id}/${String(s.exp_date).slice(0, 4)}/${s.number}-${hash.slice(0, 10)}.pdf`;
  const up = await supabase.storage.from('documents').upload(path, bytes, { contentType: 'application/pdf', upsert: false });
  if (up.error && !/exists|Duplicate/i.test(up.error.message)) back(id, `err=${encodeURIComponent(up.error.message)}`);
  const { data: doc, error: dErr } = await supabase.rpc('register_document', { p: {
    client_uuid: s.id, sha256: hash, original_path: path, mime: 'application/pdf', file_name: `${s.number}.pdf`,
    size_bytes: bytes.length, pages: 1, doc_type: 'self_cert', doc_number: s.number, doc_date: s.exp_date,
    total: s.amount, currency: s.currency,
  } });
  if (dErr) back(id, `err=${encodeURIComponent(dErr.message)}`);
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
