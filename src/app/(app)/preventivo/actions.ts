'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseAmount } from '@/lib/amount';

const back = (year: string, q: string) => redirect(`/preventivo?anno=${year}&${q}`);
const err = (year: string, e: { message: string }) => back(year, `err=${encodeURIComponent(e.message)}`);
const done = (year: string, q = 'ok=1') => { revalidatePath('/', 'layout'); back(year, q); };
// ritorno alla vista da cui si è partiti (griglia con il dettaglio della cella aperto)
const ret = (form: FormData) => { const r = String(form.get('ret') ?? ''); return /^[\w=&%.~-]*$/.test(r) ? r : ''; };

// Griglia: importo di una cella (codice × progetto) scritto direttamente. Vale solo in bozza (lo controlla il database)
// e solo per celle vuote o con una sola riga semplice in euro (quantità 1); altrimenti si usa il dettaglio.
export async function setCell(budgetId: string, catId: string, prjId: string | null, raw: string): Promise<{ ok: boolean; error?: string }> {
  const amount = raw.trim() === '' ? 0 : parseAmount(raw);
  if (amount == null || amount < 0) return { ok: false, error: 'importo' };
  const sb = await createClient();
  let q = sb.from('budget_items').select('id, qty, currency, description, unit, notes').eq('budget_id', budgetId).eq('category_id', catId);
  q = prjId ? q.eq('project_id', prjId) : q.is('project_id', null);
  const { data: its, error: e0 } = await q;
  if (e0) return { ok: false, error: e0.message };
  const it = its?.[0];
  if ((its?.length ?? 0) > 1 || (it && (it.currency !== 'EUR' || Number(it.qty) !== 1))) return { ok: false, error: 'detail' };
  const base = { budget_id: budgetId, project_id: prjId ?? '', category_id: catId, qty: 1, currency: 'EUR' };
  const { error } = !it
    ? (amount ? await sb.rpc('budget_item_save', { p: { ...base, unit_cost: amount } }) : { error: null })
    : amount ? await sb.rpc('budget_item_save', { p: { ...base, id: it.id, unit_cost: amount, description: it.description ?? '', unit: it.unit ?? '', notes: it.notes ?? '' } })
      : await sb.rpc('budget_item_delete', { p_id: it.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/preventivo');
  return { ok: true };
}

// Nuova bozza: vuota, revisione dell'approvata in vigore, o copia di un altro anno.
export async function draftBudget(form: FormData) {
  const year = String(form.get('year'));
  const from = String(form.get('from') ?? '');
  const { data, error } = await (await createClient()).rpc('budget_draft', {
    p_year: Number(year), p_from_year: from ? Number(from) : null, p_title: String(form.get('title') ?? '') || null,
  });
  if (error) err(year, error);
  // si apre subito la bozza appena creata (prima si tornava sulla versione in vigore, non modificabile)
  const id = (data as { id?: string } | null)?.id;
  done(year, `ok=1&vista=modifica${id ? `&v=${encodeURIComponent(id)}` : ''}`);
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
  const r = ret(form) || 'vista=righe';
  if (!p.category_id || p.unit_cost == null) back(year, `err=missing&${r}`);
  const sb = await createClient();
  // riga esistente: budget_item_amend vale per la bozza e, con il motivo, per la versione in vigore
  const { error } = p.id
    ? await sb.rpc('budget_item_amend', { p, p_reason: String(form.get('reason') ?? '') || null })
    : await sb.rpc('budget_item_save', { p });
  const v = `&v=${encodeURIComponent(p.budget_id)}`;
  if (error) back(year, `err=${encodeURIComponent(error.message)}&${r}${v}${p.id ? `&edit=${p.id}` : ''}`);
  done(year, `ok=1&${r}${v}`);
}

export async function deleteItem(form: FormData) {
  const year = String(form.get('year'));
  const v = form.get('budget_id') ? `&v=${encodeURIComponent(String(form.get('budget_id')))}` : '';
  const r = ret(form) || 'vista=righe';
  if (form.get('confirm') !== 'on') back(year, `err=${encodeURIComponent('Spunta la conferma per eliminare la riga.')}&${r}${v}`);
  const { error } = await (await createClient()).rpc('budget_item_remove', { p_id: String(form.get('id')), p_reason: String(form.get('reason') ?? '') || null });
  if (error) err(year, error);
  done(year, `ok=row_deleted&${r}${v}`);
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
