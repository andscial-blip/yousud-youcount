'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { implicitClient } from '@/lib/supabase/implicit';
import { parseAmount } from '@/lib/amount';

// Azioni di amministrazione. Ogni permesso è controllato dal database (RLS e funzioni admin_*):
// qui si passano solo i dati, filtrati su un elenco di campi ammessi.

const back = (path: string, q: string): never => redirect(`${path}${path.includes('?') ? '&' : '?'}${q}`);
const done = (path: string, error: { message: string } | null) => {
  revalidatePath('/', 'layout');
  return error ? back(path, `err=${encodeURIComponent(error.message)}`) : back(path, 'ok=1');
};
async function origin() {
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
}
async function me() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data } = await supabase.from('profiles').select('id, org_id, role, active').eq('id', auth.user?.id ?? '').maybeSingle();
  return { supabase, me: data };
}

// ---------------------------------------------------------------- utenti
export async function inviteUser(form: FormData) {
  const { supabase, me: m } = await me();
  const path = '/admin/utenti';
  if (!m || !['super_admin', 'admin'].includes(m.role)) back(path, 'err=forbidden');
  const admin = adminClient();
  if (!admin) back(path, 'err=inv_nokey');
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const fullName = String(form.get('full_name') ?? '').trim();
  const role = String(form.get('role') ?? 'operator');
  const { data, error } = await admin!.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName }, redirectTo: `${await origin()}/auth/callback?next=/account/password`,
  });
  if (error) back(path, `err=${encodeURIComponent(error.message)}`);
  // il profilo nasce in sola lettura; il ruolo lo assegna l'amministratore con i suoi permessi
  const { error: e2 } = role === 'read_only' ? { error: null }
    : await supabase.rpc('admin_set_role', { p_user: data!.user!.id, p_role: role });
  done(path, e2);
}

export async function setRole(form: FormData) {
  const { supabase } = await me();
  const { error } = await supabase.rpc('admin_set_role', { p_user: String(form.get('id')), p_role: String(form.get('role')) });
  done('/admin/utenti', error);
}

export async function setActive(form: FormData) {
  const { supabase } = await me();
  const { error } = await supabase.rpc('admin_set_active', { p_user: String(form.get('id')), p_active: form.get('active') === 'true' });
  done('/admin/utenti', error);
}

export async function setProjects(form: FormData) {
  const { supabase } = await me();
  const { error } = await supabase.rpc('admin_set_projects', {
    p_user: String(form.get('id')), p_all: form.get('all') === 'on', p_projects: form.getAll('project').map(String),
  });
  done('/admin/utenti', error);
}

export async function sendReset(form: FormData) {
  const { me: m } = await me();
  if (!m || !['super_admin', 'admin'].includes(m.role)) back('/admin/utenti', 'err=forbidden');
  const { error } = await implicitClient().auth.resetPasswordForEmail(String(form.get('email')),
    { redirectTo: `${await origin()}/auth/callback?next=/account/password` });
  done('/admin/utenti', error);
}

// ---------------------------------------------------------------- dati di riferimento
type Spec = Record<string, 'text' | 'num' | 'bool' | 'date' | 'uuid'>;
const TABLES: Record<string, { path: string; fields: Spec; insertOnly?: Spec }> = {
  accounts: { path: '/admin/conti', fields: { name_it: 'text', name_fr: 'text', opening_balance: 'num', opening_date: 'date', active: 'bool', sort: 'num' },
              insertOnly: { code: 'text', currency: 'text', location: 'text', kind: 'text' } },
  projects: { path: '/admin/progetti', fields: { name: 'text', kind: 'text', theme: 'text', code: 'text', active: 'bool', start_date: 'date', end_date: 'date' } },
  categories: { path: '/admin/piano-conti', fields: { name_it: 'text', name_fr: 'text', report_line_key: 'text', active: 'bool' },
                insertOnly: { code: 'text', direction: 'text', group_id: 'uuid', chart_version: 'num' } },
  counterparties: { path: '/controparti', fields: { name: 'text', kind: 'text', vat_number: 'text', country: 'text', active: 'bool' } },
};

function value(kind: string, raw: FormDataEntryValue | null) {
  const v = raw === null ? '' : String(raw).trim();
  if (kind === 'bool') return raw === 'on' || v === 'true';
  if (kind === 'num') {
    if (v === '') return null;
    const neg = v.startsWith('-'), abs = v.replace('-', '');
    const n = /^0+([.,]0+)?$/.test(abs) ? 0 : parseAmount(abs);
    return n === null ? null : neg ? -n : n;
  }
  return v === '' ? null : v;
}

export async function saveRow(form: FormData) {
  const table = String(form.get('_table'));
  const spec = TABLES[table];
  if (!spec) redirect('/');
  const { supabase, me: m } = await me();
  const id = String(form.get('id') ?? '');
  const fields = id ? spec.fields : { ...spec.fields, ...(spec.insertOnly ?? {}) };
  const row: Record<string, unknown> = {};
  for (const [k, kind] of Object.entries(fields)) {
    if (kind === 'bool' || form.has(k)) row[k] = value(kind, form.get(k));
  }
  if (table === 'categories' && !id) row.chart_version = row.chart_version ?? 2;
  const res = id
    ? await supabase.from(table).update(row).eq('id', id)
    : await supabase.from(table).insert({ ...row, org_id: m?.org_id, ...(table === 'counterparties' ? { created_by: m?.id } : {}) });
  done(String(form.get('_back') ?? spec.path), res.error);
}

export async function saveCounterpartyPrivate(form: FormData) {
  const { supabase, me: m } = await me();
  const id = String(form.get('counterparty_id'));
  const s = (k: string) => String(form.get(k) ?? '').trim() || null;
  const { error } = await supabase.from('counterparty_private').upsert({
    counterparty_id: id, org_id: m?.org_id, tax_code: s('tax_code'), email: s('email'), phone: s('phone'),
    address: s('address'), iban: s('iban'), notes: s('notes'), updated_at: new Date().toISOString(),
  });
  done('/controparti', error);
}

// ---------------------------------------------------------------- periodi
export async function closeMonth(form: FormData) {
  const { supabase } = await me();
  const [y, mo] = String(form.get('ym')).split('-').map(Number);
  const fn = form.get('reopen') === '1' ? 'reopen_period' : 'close_period';
  const { error } = await supabase.rpc(fn, { p_year: y, p_month: mo });
  done('/admin/periodi', error);
}
