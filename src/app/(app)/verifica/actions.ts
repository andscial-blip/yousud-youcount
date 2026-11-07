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
  if (error) redirect(`/verifica?err=${encodeURIComponent(error.message)}`);
  if (data?.outcome === 'conflict') redirect('/verifica?err=conflict');
  redirect(`/verifica?ok=${encodeURIComponent(data?.ref ?? '')}`);
}
