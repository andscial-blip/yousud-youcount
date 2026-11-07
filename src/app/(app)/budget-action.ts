'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseAmount } from '@/lib/amount';

// Salva il budget di un progetto per un anno, o di un finanziamento (funzione set_budget, in transazione).
export async function saveBudget(form: FormData) {
  const supabase = await createClient();
  const scope = String(form.get('scope'));
  const id = String(form.get('id'));
  const year = Number(form.get('year')) || null;
  const back = String(form.get('back') || '/');
  const lines = [...form.entries()]
    .filter(([k]) => k.startsWith('g_'))
    .map(([k, v]) => ({ group_id: k.slice(2), amount_eur: parseAmount(String(v)) }))
    .filter((l) => l.amount_eur);
  const { error } = await supabase.rpc('set_budget', {
    p_project: scope === 'project' ? id : null, p_year: scope === 'project' ? year : null,
    p_grant: scope === 'grant' ? id : null, p_lines: lines,
  });
  revalidatePath(back);
  const sep = back.includes('?') ? '&' : '?';
  redirect(`${back}${sep}${error ? `err=${encodeURIComponent(error.message)}` : 'ok=budget'}`);
}
