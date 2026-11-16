'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Verifica un movimento. Permessi, quattro occhi e versione li controlla il database.
export async function verifyMovement(form: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('verify_movement', {
    p_id: String(form.get('id')),
    p_expected_version: Number(form.get('version')),
  });
  revalidatePath('/verifica');
  revalidatePath('/');
  // il filtro scelto resta (16/11): prima si tornava all'elenco intero e chi verificava «per persona» perdeva il punto
  const keep = ['progetto', 'autore'].map((k) => [k, String(form.get(k) ?? '')]).filter(([, v]) => v).map(([k, v]) => `&${k}=${encodeURIComponent(v!)}`).join('');
  if (error) redirect(`/verifica?err=${encodeURIComponent(error.message)}${keep}`);
  if (data?.outcome === 'conflict') redirect(`/verifica?err=conflict${keep}`);
  redirect(`/verifica?ok=${encodeURIComponent(data?.ref ?? '')}${keep}`);
}
