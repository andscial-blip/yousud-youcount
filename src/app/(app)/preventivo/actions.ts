'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseAmount } from '@/lib/amount';

const back = (year: string, q: string) => redirect(`/preventivo?anno=${year}&${q}`);
const err = (year: string, e: { message: string }) => back(year, `err=${encodeURIComponent(e.message)}`);
const done = (year: string, q = 'ok=1') => { revalidatePath('/', 'layout'); back(year, q); };
// ritorno all'elenco con i filtri da cui si è partiti (progetto, tipo, ricerca)
const ret = (form: FormData) => { const r = String(form.get('ret') ?? ''); return /^[\w=&%.~-]*$/.test(r) ? r : ''; };

// Nuova bozza: vuota, revisione dell'approvata in vigore, o copia di un altro anno.
export async function draftBudget(form: FormData) {
  const year = String(form.get('year'));
  const from = String(form.get('from') ?? '');
  const { data, error } = await (await createClient()).rpc('budget_draft', {
    p_year: Number(year), p_from_year: from ? Number(from) : null, p_title: String(form.get('title') ?? '') || null,
  });
  if (error) err(year, error);
  // si apre subito la bozza appena creata; con add=1 anche la scheda della nuova riga
  const id = (data as { id?: string } | null)?.id;
  done(year, `ok=1${id ? `&v=${encodeURIComponent(id)}` : ''}${form.get('add') ? '&nuova=1' : ''}`);
}

// Salva una riga. Esistente: budget_item_amend (bozza, o versione in vigore con il motivo). Nuova: budget_item_add
// (bozza, o versione in vigore con il motivo: resta nello storico). Il numero della riga lo assegna il database.
export async function saveItem(form: FormData) {
  const year = String(form.get('year'));
  const cur = String(form.get('currency') ?? 'EUR');
  const p = {
    id: String(form.get('id') ?? '') || undefined, budget_id: String(form.get('budget_id')),
    project_id: String(form.get('project_id') ?? ''), category_id: String(form.get('category_id') ?? ''),
    counterparty_id: String(form.get('counterparty_id') ?? ''),
    description: String(form.get('description') ?? ''), unit: String(form.get('unit') ?? ''),
    qty: parseAmount(String(form.get('qty') ?? '1')) ?? 1, unit_cost: parseAmount(String(form.get('unit_cost') ?? '')),
    currency: cur, fx_rate: cur === 'MGA' ? parseAmount(String(form.get('fx_rate') ?? '')) : null,
    notes: String(form.get('notes') ?? ''),
  };
  const r = ret(form);
  const v = `&v=${encodeURIComponent(p.budget_id)}`;
  const open = p.id ? `&riga=${p.id}` : '&nuova=1';
  if (!p.category_id || p.unit_cost == null) back(year, `err=missing${r ? `&${r}` : ''}${v}${open}`);
  const reason = String(form.get('reason') ?? '') || null;
  const sb = await createClient();
  const { data, error } = p.id
    ? await sb.rpc('budget_item_amend', { p, p_reason: reason })
    : await sb.rpc('budget_item_add', { p, p_reason: reason });
  if (error) back(year, `err=${encodeURIComponent(error.message)}${r ? `&${r}` : ''}${v}${open}`);
  const n = (data as { line_no?: number } | null)?.line_no ?? '';
  // «Salva e continua»: la scheda resta aperta e ripropone codice e progetto (si inseriscono di seguito le righe dello stesso codice)
  const again = !p.id && form.get('again')
    ? `&nuova=1&lc=${encodeURIComponent(p.category_id)}${p.project_id ? `&lp=${encodeURIComponent(p.project_id)}` : ''}` : '';
  done(year, `ok=row&n=${n}${r ? `&${r}` : ''}${v}${again}`);
}

export async function deleteItem(form: FormData) {
  const year = String(form.get('year'));
  const v = form.get('budget_id') ? `&v=${encodeURIComponent(String(form.get('budget_id')))}` : '';
  const r = ret(form);
  const id = String(form.get('id'));
  if (form.get('confirm') !== 'on') back(year, `err=${encodeURIComponent('Spunta la conferma per eliminare la riga.')}${r ? `&${r}` : ''}${v}&elimina=${id}`);
  const { error } = await (await createClient()).rpc('budget_item_remove', { p_id: id, p_reason: String(form.get('reason') ?? '') || null });
  if (error) back(year, `err=${encodeURIComponent(error.message)}${r ? `&${r}` : ''}${v}&elimina=${id}`);
  done(year, `ok=row_deleted${r ? `&${r}` : ''}${v}`);
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
