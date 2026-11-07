import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lang } from './i18n';
import type { Me } from './session';

// Dati di riferimento per il modulo del movimento, nella lingua dell'utente.
export type RefData = {
  orgId: string; userId: string; role: Me['role'];
  accounts: { id: string; name: string; currency: 'EUR' | 'MGA'; location: 'IT' | 'MG'; kind: string }[];
  categories: { id: string; code: string; name: string; direction: 'in' | 'out'; group: string }[];
  projects: { id: string; name: string; kind: 'project' | 'structure' }[];
  methods: { id: string; name: string }[];
  counterparties: { id: string; name: string }[];
  rates: { year: number; month: number; rate: number }[];
};

export async function loadRefData(supabase: SupabaseClient, me: Me, lang: Lang): Promise<RefData> {
  const L = (o: { name_it: string; name_fr: string | null }) => (lang === 'fr' && o.name_fr ? o.name_fr : o.name_it);
  const [acc, cat, prj, met, cp, fx, mem] = await Promise.all([
    supabase.from('accounts').select('id, name_it, name_fr, currency, location, kind').eq('active', true).order('sort'),
    supabase.from('categories').select('id, code, name_it, name_fr, direction, group:category_groups(code, name_it, name_fr)')
      .eq('active', true).order('sort'),
    supabase.from('projects').select('id, name, kind').eq('active', true).order('kind', { ascending: false }).order('name'),
    supabase.from('payment_methods').select('id, name_it, name_fr').eq('active', true).order('sort'),
    supabase.from('counterparties').select('id, name').eq('active', true).order('name').limit(2000),
    supabase.from('fx_rates').select('year, month, rate').order('year').order('month'),
    supabase.from('project_members').select('project_id').eq('user_id', me.id),
  ]);
  // un operatore senza "tutti i progetti" vede nel modulo solo quelli assegnati
  const allowed = me.role === 'operator' && !me.all_projects ? new Set((mem.data ?? []).map((m) => m.project_id)) : null;
  type G = { code: string; name_it: string; name_fr: string | null } | null;
  return {
    orgId: me.org_id, userId: me.id, role: me.role,
    accounts: (acc.data ?? []).map((a) => ({ id: a.id, name: L(a), currency: a.currency, location: a.location, kind: a.kind })),
    categories: (cat.data ?? []).map((c) => {
      const g = c.group as unknown as G;
      return { id: c.id, code: c.code, name: L(c), direction: c.direction, group: g ? `${g.code} · ${L(g)}` : '' };
    }),
    projects: (prj.data ?? []).filter((p) => !allowed || allowed.has(p.id)),
    methods: (met.data ?? []).map((m) => ({ id: m.id, name: L(m) })),
    counterparties: cp.data ?? [],
    rates: (fx.data ?? []).map((r) => ({ year: r.year, month: r.month, rate: Number(r.rate) })),
  };
}
