'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseAmount } from '@/lib/amount';

const back = (q: string) => redirect(`/scadenze?${q}`);

export async function saveDeadline(form: FormData) {
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const amount = s('amount') ? parseAmount(s('amount')) : null;
  const p: Record<string, unknown> = {
    id: s('id') || undefined, rule_key: s('rule_key') || undefined, title: s('title'), category: s('category') || 'altro', due_date: s('due_date'),
    amount: amount ?? '', currency: amount ? s('currency') || 'EUR' : '', project_id: s('project_id'), owner_id: s('owner_id'),
    priority: s('priority') || 'normal', repeat: s('repeat') || 'none', notes: s('notes'),
  };
  if (!p.title || !p.due_date) back('err=missing');
  const { error } = await (await createClient()).rpc('deadline_save', { p });
  revalidatePath('/', 'layout');
  back(error ? `err=${encodeURIComponent(error.message)}` : 'ok=1');
}

// Segna fatta / riapre. Per un adempimento dell'app la riga si crea alla prima volta (rule_key).
export async function setDeadlineStatus(form: FormData) {
  const supabase = await createClient();
  let id = String(form.get('id') ?? '');
  const status = String(form.get('status') ?? 'done');
  if (!id && form.get('rule_key')) {
    const { data, error } = await supabase.rpc('deadline_save', { p: {
      rule_key: String(form.get('rule_key')), title: String(form.get('title')), category: String(form.get('category') ?? 'altro'),
      due_date: String(form.get('due_date')) } });
    if (error) back(`err=${encodeURIComponent(error.message)}`);
    id = data.id;
  }
  const { error } = await supabase.rpc('deadline_set_status', { p_id: id, p_status: status });
  revalidatePath('/', 'layout');
  back(error ? `err=${encodeURIComponent(error.message)}` : 'ok=1');
}
