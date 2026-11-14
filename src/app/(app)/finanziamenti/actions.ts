'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseAmount } from '@/lib/amount';

const s = (form: FormData, k: string) => String(form.get(k) ?? '').trim() || null;
const fields = (form: FormData) => ({
  title: s(form, 'title'), code: s(form, 'code'), donor_id: s(form, 'donor_id'), project_id: s(form, 'project_id'),
  currency: s(form, 'currency') ?? 'EUR', amount: parseAmount(String(form.get('amount') ?? '')),
  start_date: s(form, 'start_date'), end_date: s(form, 'end_date'), notes: s(form, 'notes'),
});

// Crea un finanziamento. Permessi: responsabili e amministratori (RLS).
export async function createGrant(form: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('profiles').select('org_id').eq('id', auth.user!.id).single();
  const { data, error } = await supabase.from('grants').insert({ org_id: me!.org_id, ...fields(form), created_by: auth.user!.id }).select('id').single();
  revalidatePath('/finanziamenti');
  if (error) redirect(`/finanziamenti?nuovo=1&err=${encodeURIComponent(error.message)}`);
  redirect(`/finanziamenti/${data.id}`);
}

// Modifica i dati di un finanziamento (titolo, codice, finanziatore, progetto, importo, periodo, note).
export async function updateGrant(form: FormData) {
  const id = String(form.get('id'));
  const { error } = await (await createClient()).from('grants').update(fields(form)).eq('id', id);
  revalidatePath('/finanziamenti');
  if (error) redirect(`/finanziamenti/${id}?modifica=1&err=${encodeURIComponent(error.message)}`);
  redirect(`/finanziamenti/${id}?ok=1`);
}

// Chiude o riapre un finanziamento: i movimenti collegati restano dove sono.
export async function setGrantStatus(form: FormData) {
  const id = String(form.get('id'));
  const status = form.get('status') === 'closed' ? 'closed' : 'active';
  const { error } = await (await createClient()).from('grants').update({ status }).eq('id', id);
  revalidatePath('/finanziamenti');
  redirect(`/finanziamenti/${id}?${error ? `err=${encodeURIComponent(error.message)}` : 'ok=1'}`);
}

// Logo del finanziatore: immagine già ridotta dal browser; «Togli il logo» la elimina.
export async function setDonorLogo(form: FormData) {
  const ret = String(form.get('ret') ?? '/finanziamenti');
  const back = /^\/finanziamenti(\/[0-9a-f-]{36})?$/.test(ret) ? ret : '/finanziamenti';
  const image = form.get('remove') ? null : String(form.get('image') ?? '') || null;
  const { error } = await (await createClient()).rpc('counterparty_logo_set', { p_id: String(form.get('donor_id')), p_image: image });
  revalidatePath('/finanziamenti');
  redirect(`${back}?${error ? `modifica=1&err=${encodeURIComponent(error.message)}` : 'ok=logo'}`);
}
