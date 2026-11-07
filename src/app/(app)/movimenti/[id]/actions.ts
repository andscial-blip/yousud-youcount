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
