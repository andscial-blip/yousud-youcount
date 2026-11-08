'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// La chiave torna al browser una sola volta, nella risposta di questa azione: non passa dall'indirizzo né dai registri.
export async function createApiKey(_prev: unknown, form: FormData): Promise<{ key?: string; err?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_api_client', { p_name: String(form.get('name') ?? '') });
  revalidatePath('/admin/impostazioni');
  if (error) return { err: error.message };
  return { key: (data as { key: string }).key };
}

export async function revokeApiKey(form: FormData) {
  const supabase = await createClient();
  await supabase.rpc('revoke_api_client', { p_id: String(form.get('id') ?? '') });
  revalidatePath('/admin/impostazioni');
}
