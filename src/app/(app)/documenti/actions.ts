'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Collega un giustificativo rimasto senza movimento al movimento con quel numero (es. MOV-2026-0042).
// Passa da save_movement: valgono le stesse regole (permessi, versione, movimenti verificati immutabili).
export async function linkDocument(form: FormData) {
  const docId = String(form.get('doc') ?? '');
  const ref = String(form.get('ref') ?? '').trim().toUpperCase();
  const supabase = await createClient();
  const back = (q: string) => redirect(`/documenti?f=orfani&${q}`);
  if (!docId || ref.length < 3) back('err=' + encodeURIComponent('Scrivi il numero del movimento, es. MOV-2026-0042'));
  const { data: m } = await supabase.from('movements').select('id, version, status').eq('ref', ref).maybeSingle();
  if (!m) back('err=' + encodeURIComponent(`Movimento ${ref} non trovato`));
  if (m!.status === 'verified') back('err=' + encodeURIComponent(`${ref} è già verificato: non si modifica più`));
  const { error } = await supabase.rpc('save_movement', { p: { id: m!.id, expected_version: m!.version, document_ids: [docId] } });
  revalidatePath('/documenti'); revalidatePath(`/movimenti/${m!.id}`);
  if (error) back('err=' + encodeURIComponent(error.message));
  back('ok=' + encodeURIComponent(ref));
}
