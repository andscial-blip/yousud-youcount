import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lang } from './i18n';
import type { Me } from './session';

// Dati di riferimento per il modulo del movimento, nella lingua dell'utente.
export type RefData = {
  orgId: string; userId: string; userName: string; role: Me['role'];
  payers: string[];   // "Pagato da": nomi già usati e persone visibili
  accounts: { id: string; name: string; currency: 'EUR' | 'MGA'; location: 'IT' | 'MG'; kind: string; holder: string | null; balance: number | null }[];
  categories: { id: string; code: string; name: string; direction: 'in' | 'out'; group: string }[];
  projects: { id: string; name: string; kind: 'project' | 'structure' }[];
  methods: { id: string; name: string; code: string }[];
  counterparties: { id: string; name: string }[];
  rates: { year: number; month: number; rate: number }[];
  lastRate: { rate: number; date: string } | null;   // ultimo tasso usato in un movimento in ariary
  grants: { id: string; title: string; project_id: string | null }[];
  aiEnabled: boolean;
};

export async function loadRefData(supabase: SupabaseClient, me: Me, lang: Lang): Promise<RefData> {
  const L = (o: { name_it: string; name_fr: string | null }) => (lang === 'fr' && o.name_fr ? o.name_fr : o.name_it);
  // saldo dei conti: serve solo ad avvisare quando una spesa manda sotto zero una cassa in contanti
  const bal = await supabase.rpc('account_balances');
  const balOf = new Map(((bal.data ?? []) as { account_id: string; balance: string }[]).map((b) => [b.account_id, Number(b.balance)]));
  const [acc, cat, prj, met, cp, fx, mem, gr, ai, last, pb, pf] = await Promise.all([
    supabase.from('accounts').select('id, name_it, name_fr, currency, location, kind, holder').eq('active', true).order('sort'),
    supabase.from('categories').select('id, code, name_it, name_fr, direction, group:category_groups(code, name_it, name_fr)')
      .eq('active', true).order('sort'),
    supabase.from('projects').select('id, name, kind').eq('active', true).order('kind', { ascending: false }).order('name'),
    supabase.from('payment_methods').select('id, code, name_it, name_fr').eq('active', true).order('sort'),
    supabase.from('counterparties').select('id, name').eq('active', true).order('name').limit(2000),
    supabase.from('fx_rates').select('year, month, rate').order('year').order('month'),
    supabase.from('project_members').select('project_id').eq('user_id', me.id),
    supabase.from('grants').select('id, title, project_id').eq('status', 'active').order('title'),
    supabase.from('settings').select('value').eq('key', 'ai_reading').maybeSingle(),
    supabase.from('movements').select('fx_rate, op_date').eq('currency', 'MGA').not('fx_rate', 'is', null)
      .order('op_date', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('movements').select('paid_by').not('paid_by', 'is', null).order('created_at', { ascending: false }).limit(500),
    supabase.rpc('user_directory'),
  ]);
  // un operatore senza "tutti i progetti" vede nel modulo solo quelli assegnati
  const allowed = me.role === 'operator' && !me.all_projects ? new Set((mem.data ?? []).map((m) => m.project_id)) : null;
  type G = { code: string; name_it: string; name_fr: string | null } | null;
  return {
    orgId: me.org_id, userId: me.id, userName: me.full_name, role: me.role,
    payers: [...new Set([...((pf.data ?? []) as { full_name: string; active: boolean }[]).filter((x) => x.active).map((x) => x.full_name), ...(pb.data ?? []).map((x) => x.paid_by)]
      .filter((n): n is string => Boolean(n && n.trim())))].sort((a, b) => a.localeCompare(b)),
    accounts: (acc.data ?? []).map((a) => ({ id: a.id, name: L(a), currency: a.currency, location: a.location, kind: a.kind, holder: a.holder ?? null, balance: balOf.has(a.id) ? balOf.get(a.id)! : null })),
    categories: (cat.data ?? []).map((c) => {
      const g = c.group as unknown as G;
      return { id: c.id, code: c.code, name: L(c), direction: c.direction, group: g ? `${g.code} · ${L(g)}` : '' };
    }),
    projects: (prj.data ?? []).filter((p) => !allowed || allowed.has(p.id)),
    methods: (met.data ?? []).map((m) => ({ id: m.id, name: L(m), code: m.code })),
    counterparties: cp.data ?? [],
    rates: (fx.data ?? []).map((r) => ({ year: r.year, month: r.month, rate: Number(r.rate) })),
    grants: gr.data ?? [],
    aiEnabled: ai.data?.value === true,
    lastRate: last.data?.fx_rate ? { rate: Number(last.data.fx_rate), date: last.data.op_date } : null,
  };
}
