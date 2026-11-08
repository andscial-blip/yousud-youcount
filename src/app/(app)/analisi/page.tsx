import Link from 'next/link';
import { STAFF, can, requireMe } from '@/lib/session';
import { money } from '@/lib/format';
import { Denied, ErrorNote, PageHead, Panel } from '@/components/Page';
import { BudgetBar, HBars } from '@/components/Charts';

export const dynamic = 'force-dynamic';

type Led = { kind: string; amount_eur: string | null; category_id: string | null; project_id: string | null; project_name: string | null;
  counterparty_id: string | null; account_id: string | null; month: number };
type Cat = { id: string; group_id: string | null };
type Grp = { id: string; code: string; name_it: string; name_fr: string | null; direction: 'in' | 'out'; sort: number };

// Analisi dell'anno: dove vanno i soldi rispetto al preventivo, da dove arrivano, con chi si spende, in quale paese.
// Ogni voce porta all'elenco dei movimenti che la compongono. Solo movimenti registrati e verificati (v_ledger).
export default async function Analysis({ searchParams }: { searchParams: Promise<{ anno?: string; progetto?: string }> }) {
  const sp = await searchParams;
  const year = Number(sp.anno) || new Date().getFullYear();
  const prj = /^[0-9a-f-]{36}$/.test(sp.progetto ?? '') ? sp.progetto! : '';
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, STAFF)) return <Denied text={t('only_staff')} />;
  let lq = supabase.from('v_ledger').select('kind, amount_eur, category_id, project_id, project_name, counterparty_id, account_id, month')
    .eq('year', year).neq('kind', 'transfer').limit(50000);
  if (prj) lq = lq.eq('project_id', prj);
  let bq = supabase.from('budget_lines').select('group_id, amount_eur, project_id').eq('year', year).not('project_id', 'is', null);
  if (prj) bq = bq.eq('project_id', prj);
  const [{ data: led, error }, { data: cats }, { data: groups }, { data: budget }, { data: cps }, { data: accs }, { data: projects }] = await Promise.all([
    lq.returns<Led[]>(),
    supabase.from('categories').select('id, group_id').returns<Cat[]>(),
    supabase.from('category_groups').select('id, code, name_it, name_fr, direction, sort').order('sort').returns<Grp[]>(),
    bq,
    supabase.from('counterparties').select('id, name'),
    supabase.from('accounts').select('id, location'),
    supabase.from('projects').select('id, name').order('name'),
  ]);
  const L = (g: { name_it: string; name_fr: string | null }) => (lang === 'fr' && g.name_fr ? g.name_fr : g.name_it);
  const groupOf = new Map((cats ?? []).map((c) => [c.id, c.group_id]));
  const rows = led ?? [];
  const val = (r: Led) => Number(r.amount_eur ?? 0);
  const out = rows.filter((r) => r.kind === 'expense'), inc = rows.filter((r) => r.kind === 'income');
  const totOut = out.reduce((s, r) => s + val(r), 0), totIn = inc.reduce((s, r) => s + val(r), 0);
  const totBudget = (budget ?? []).reduce((s, b) => s + Number(b.amount_eur), 0);
  const sumBy = (list: Led[], key: (r: Led) => string | null) => {
    const m = new Map<string, number>();
    for (const r of list) { const k = key(r) ?? '-'; m.set(k, (m.get(k) ?? 0) + val(r)); }
    return m;
  };
  // preventivo annuale: niente ripartizione per mese (non si sa quando cadono le spese): il riferimento è la quota dell'anno trascorsa
  const now = new Date();
  const elapsed = year < now.getFullYear() ? 1 : year > now.getFullYear() ? 0
    : (now.getTime() - new Date(year, 0, 1).getTime()) / (new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime());
  const spentG = sumBy(out, (r) => (r.category_id ? groupOf.get(r.category_id) ?? null : null));
  const budG = new Map<string, number>();
  for (const b of budget ?? []) budG.set(b.group_id, (budG.get(b.group_id) ?? 0) + Number(b.amount_eur));
  const outGroups = (groups ?? []).filter((g) => g.direction === 'out' && (spentG.get(g.id) || budG.get(g.id)));
  const inGroups = sumBy(inc, (r) => (r.category_id ? groupOf.get(r.category_id) ?? null : null));
  const gName = new Map((groups ?? []).map((g) => [g.id, `${g.code} · ${L(g)}`]));
  const cpName = new Map((cps ?? []).map((c) => [c.id, c.name]));
  const byCp = [...sumBy(out, (r) => r.counterparty_id)].filter(([k]) => k !== '-').sort((a, b) => b[1] - a[1]).slice(0, 10);
  const loc = new Map((accs ?? []).map((a) => [a.id, a.location as string]));
  const byLoc = sumBy(out, (r) => (r.account_id ? loc.get(r.account_id) ?? null : null));
  const byPrj = [...sumBy(out, (r) => r.project_id)].filter(([k]) => k !== '-').sort((a, b) => b[1] - a[1]);
  const prjName = new Map(rows.map((r) => [r.project_id, r.project_name]));
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');
  const q = (o: Record<string, string>) => { const u = new URLSearchParams({ anno: String(year), ...(prj ? { progetto: prj } : {}), ...o }); return `/analisi?${u}`; };
  const mov = (o: Record<string, string>) => `/movimenti?${new URLSearchParams({ dal: `${year}-01-01`, al: `${year}-12-31`, ...(prj ? { progetto: prj } : {}), ...o })}`;
  const state = (spent: number, bud: number) => (!bud ? '' : spent > bud ? 'over' : spent > bud * elapsed * 1.1 ? 'ahead' : 'ok');

  return (
    <div className="stack">
      <PageHead title={`${t('nav_analysis')} ${year}`}>
        <div className="seg">
          <Link href={q({ anno: String(year - 1) })}>{year - 1}</Link>
          <Link href={q({})} aria-current="true">{year}</Link>
          <Link href={q({ anno: String(year + 1) })}>{year + 1}</Link>
        </div>
      </PageHead>
      <form className="filters" method="get" action="/analisi">
        <input type="hidden" name="anno" value={year} />
        <select className="input" name="progetto" defaultValue={prj} aria-label={t('project')} style={{ width: 'auto', minWidth: 240 }}>
          <option value="">{t('an_all_projects')}</option>
          {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn primary" type="submit">{t('f_apply')}</button>
      </form>
      <ErrorNote prefix={t('error_load')} error={error} />
      <section className="panel">
        <div className="figs">
          <div><span>{t('legend_in')}</span><b className="num">{money(totIn, 'EUR', lang)}</b></div>
          <div><span>{t('legend_out')}</span><b className="num">{money(totOut, 'EUR', lang)}</b></div>
          <div><span>{t('rep_result')}</span><b className="num">{money(totIn - totOut, 'EUR', lang)}</b></div>
          <div className={totBudget && totOut > totBudget ? 'bad' : ''}><span>{t('an_budget_used')}</span>
            <b className="num">{totBudget ? `${pct(totOut, totBudget)} · ${money(totBudget, 'EUR', lang)}` : t('an_no_budget')}</b></div>
        </div>
      </section>

      <Panel title={t('an_by_group')}>
        <p className="panel-b muted" style={{ margin: 0 }}>{t('an_by_group_note').replace('{p}', `${Math.round(elapsed * 100)}%`)}</p>
        {outGroups.length === 0 ? <p className="panel-b muted" style={{ margin: 0 }}>{t('none')}</p> : (
          <table className="t">
            <thead><tr><th>{t('an_group')}</th><th className="r">{t('budget')}</th><th className="r">{t('prj_spent')}</th><th className="r">%</th><th className="hm" style={{ width: '30%' }} /></tr></thead>
            <tbody>
              {outGroups.map((g) => {
                const s = spentG.get(g.id) ?? 0, b = budG.get(g.id) ?? 0, st = state(s, b);
                return (
                  <tr key={g.id}>
                    <td>{gName.get(g.id)}{st && <> <span className={`chip ${st === 'ok' ? 'ok' : 'warn'}`}>{t(`an_${st}` as 'an_ok')}</span></>}</td>
                    <td className="r num nw">{b ? money(b, 'EUR', lang) : '–'}</td>
                    <td className="r num nw">{money(s, 'EUR', lang)}</td>
                    <td className="r num">{pct(s, b)}</td>
                    <td className="hm"><BudgetBar budget={b} spent={s} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="grid2">
        <Panel title={t('dash_by_project')} pad>
          {byPrj.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t('none')}</p>
            : <HBars lang={lang} rows={byPrj.slice(0, 10).map(([k, v]) => ({ label: prjName.get(k) ?? '–', value: v, href: q({ progetto: k }) }))} />}
        </Panel>
        <Panel title={t('an_in_by_group')} pad>
          {inGroups.size === 0 ? <p className="muted" style={{ margin: 0 }}>{t('none')}</p>
            : <HBars lang={lang} color="var(--c-in)" rows={[...inGroups].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: gName.get(k) ?? t('an_unclassified'), value: v }))} />}
        </Panel>
        <Panel title={t('an_top_cp')} pad>
          {byCp.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t('an_no_cp')}</p>
            : <HBars lang={lang} rows={byCp.map(([k, v]) => ({ label: cpName.get(k) ?? '–', value: v }))} />}
        </Panel>
        <Panel title={t('an_by_country')} pad>
          <HBars lang={lang} rows={(['IT', 'MG'] as const).map((k) => ({ label: t(k === 'IT' ? 'italy' : 'madagascar'), value: byLoc.get(k) ?? 0 }))} />
          <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>{t('an_country_note')}</p>
        </Panel>
      </div>
      <p className="muted" style={{ margin: 0 }}>{t('an_note')} <Link href={mov({})}>{t('an_open_moves')}</Link></p>
    </div>
  );
}
