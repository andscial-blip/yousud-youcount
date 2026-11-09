'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseAmount } from '@/lib/amount';

const back = (year: string, q: string) => redirect(`/preventivo?anno=${year}&${q}`);
const err = (year: string, e: { message: string }) => back(year, `err=${encodeURIComponent(e.message)}`);
const done = (year: string, q = 'ok=1') => { revalidatePath('/', 'layout'); back(year, q); };

// Nuova bozza: vuota, revisione dell'approvata in vigore, o copia di un altro anno.
export async function draftBudget(form: FormData) {
  const year = String(form.get('year'));
  const from = String(form.get('from') ?? '');
  const { error } = await (await createClient()).rpc('budget_draft', {
    p_year: Number(year), p_from_year: from ? Number(from) : null, p_title: String(form.get('title') ?? '') || null,
  });
  if (error) err(year, error);
  done(year, 'ok=1&vista=righe');
}

export async function saveItem(form: FormData) {
  const year = String(form.get('year'));
  const cur = String(form.get('currency') ?? 'EUR');
  const p = {
    id: String(form.get('id') ?? '') || undefined, budget_id: String(form.get('budget_id')),
    project_id: String(form.get('project_id') ?? ''), category_id: String(form.get('category_id') ?? ''),
    description: String(form.get('description') ?? ''), unit: String(form.get('unit') ?? ''),
    qty: parseAmount(String(form.get('qty') ?? '1')) ?? 1, unit_cost: parseAmount(String(form.get('unit_cost') ?? '')),
    currency: cur, fx_rate: cur === 'MGA' ? parseAmount(String(form.get('fx_rate') ?? '')) : null,
    notes: String(form.get('notes') ?? ''),
  };
  if (!p.category_id || p.unit_cost == null) back(year, 'err=missing&vista=righe');
  const { error } = await (await createClient()).rpc('budget_item_save', { p });
  if (error) err(year, error);
  done(year, 'ok=1&vista=righe');
}

export async function deleteItem(form: FormData) {
  const year = String(form.get('year'));
  const { error } = await (await createClient()).rpc('budget_item_delete', { p_id: String(form.get('id')) });
  if (error) err(year, error);
  done(year, 'ok=1&vista=righe');
}

export async function approveBudget(form: FormData) {
  const year = String(form.get('year'));
  const { error } = await (await createClient()).rpc('budget_approve', { p_id: String(form.get('id')), p_ref: String(form.get('ref') ?? '') });
  if (error) err(year, error);
  done(year);
}

export async function discardBudget(form: FormData) {
  const year = String(form.get('year'));
  const { error } = await (await createClient()).rpc('budget_discard', { p_id: String(form.get('id')) });
  if (error) err(year, error);
  done(year);
}

// Elimina un'intera versione: bozze e versioni DEMO (responsabile), versione approvata reale solo un amministratore,
// con motivo; resta traccia nel registro modifiche e torna in vigore la versione precedente, se c'è.
export async function deleteBudget(form: FormData) {
  const year = String(form.get('year'));
  if (form.get('confirm') !== 'on') back(year, `err=${encodeURIComponent('Spunta la conferma per eliminare il preventivo.')}`);
  const { data, error } = await (await createClient()).rpc('budget_delete', { p_id: String(form.get('id')), p_reason: String(form.get('reason') ?? '') || null });
  if (error) err(year, error);
  done(year, `ok=deleted&n=${data?.items ?? 0}`);
}
