'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function saveDashNotes(_: { ok: boolean; err: string; meta: string }, form: FormData) {
  const { data, error } = await (await createClient()).rpc('dashboard_notes_save', { p_text: String(form.get('text') ?? '') });
  if (error) return { ok: false, err: error.message, meta: '' };
  revalidatePath('/');
  const at = new Date(String(data?.at ?? Date.now()));
  return { ok: true, err: '', meta: `${data?.by_name ?? ''} · ${at.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}` };
}
