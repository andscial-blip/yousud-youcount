import Link from 'next/link';
import { STAFF, can, requireMe } from '@/lib/session';
import { money } from '@/lib/format';
import { Denied, ErrorNote, PageHead, Panel } from '@/components/Page';
import { BudgetBar, HBars, Lines, MonthBars } from '@/components/Charts';
import { colorFor } from '@/lib/palette';
import { MESI } from '@/lib/viz';

export const dynamic = 'force-dynamic';

type Led = { kind: string; amount_eur: string | null; category_id: string | null; project_id: string | null; project_name: string | null;
  counterparty_id: string | null; account_id: string | null; month: number };
type Cat = { id: string; group_id: string | null };
type Grp = { id: string; code: string; name_it: string; name_fr: string | null; direction: 'in' | 'out'; sort: number };

// Analisi dell'anno: dove vanno i soldi rispetto al preventivo, da dove arrivano, con chi si spende, in quale paese.
// Ogni voce porta all'elenco dei movimenti che la compongono. Solo movimenti registrati e verificati (v_ledger).
export default async function Analysis({ searchParams }: { searchParams: Promise<{ anno?: string; progetto?: string; vista?: string }> }) {
  const sp = await searchParams;
  const year = Number(sp.anno) || new Date().getFullYear();
  const prj = /^[0-9a-f-]{36}$/.test(sp.progetto ?? '') ? sp.progetto! : '';
  const VIEWS = ['panoramica', 'entrate', 'uscite', 'progetti', 'andamento', 'budget'] as const;
  const view = (VIEWS as readonly string[]).includes(sp.vista ?? '') ? sp.vista as (typeof VIEWS)[number] : 'panoramica';
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, STAFF)) return <Denied text={t('only_staff')} />;
  let lq = supabase.from('v_ledger').select('kind, amount_eur, category_id, project_id, project_name, counterparty_id, account_id, month')
    .eq('year', year).neq('kind', 'transfer').eq('out_of_report', false).limit(50000);
  if (prj) lq = lq.eq('project_id', prj);
  let bq = supabase.from('budget_lines').select('group_id, amount_eur, project_id').eq('year', year).not('project_id', 'is', null);
  if (prj) bq = bq.eq('project_id', prj);
  let pq = supabase.from('v_ledger').select('kind, amount_eur, month').eq('year', year - 1).neq('kind', 'transfer').eq('out_of_report', false).limit(50000);
  if (prj) pq = pq.eq('project_id', prj);
  const [{ data: prevLed }, { data: led, error }, { data: cats }, { data: groups }, { data: budget0 }, { data: cps }, { data: accs }, { data: projects }, { data: cmp }] = await Promise.all([
    pq,
    lq.returns<Led[]>(),
    supabase.from('categories').select('id, group_id').returns<Cat[]>(),
    supabase.from('category_groups').select('id, code, name_it, name_fr, direction, sort').order('sort').returns<Grp[]>(),
    bq,
    supabase.from('counterparties').select('id, name'),
    supabase.from('accounts').select('id, location'),
    supabase.from('projects').select('id, name').order('name'),
    supabase.rpc('budget_compare', { p_year: year }),
  ]);
  const L = (g: { name_it: string; name_fr: string | null }) => (lang === 'fr' && g.name_fr ? g.name_fr : g.name_it);
  const groupOf = new Map((cats ?? []).map((c) => [c.id, c.group_id]));
  const rows = led ?? [];
  const val = (r: Led) => Number(r.amount_eur ?? 0);
  const out = rows.filter((r) => r.kind === 'expense'), inc = rows.filter((r) => r.kind === 'income');
  const totOut = out.reduce((s, r) => s + val(r), 0), totIn = inc.reduce((s, r) => s + val(r), 0);
  // budget di uscita: preventivo approvato (righe per codice, portate al gruppo) più le vecchie righe per gruppo
  const groupOfCat = new Map((cats ?? []).map((c) => [c.id, c.group_id]));
  const budget = [...(budget0 ?? []).map((b) => ({ group_id: b.group_id as string, amount_eur: Number(b.amount_eur) })),
    ...((cmp ?? []) as { direction: string; category_id: string; project_id: string | null; budget_eur: string }[])
      .filter((r) => r.direction === 'out' && Number(r.budget_eur) > 0 && (!prj || r.project_id === prj))
      .map((r) => ({ group_id: groupOfCat.get(r.category_id) ?? '', amount_eur: Number(r.budget_eur) }))];
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

  // andamento: mesi dell'anno, cumulato e confronto con l'anno prima
  const months = Array.from({ length: 12 }, () => ({ inc: 0, out: 0 }));
  for (const r of rows) { if (r.kind === 'income') months[r.month - 1].inc += val(r); else months[r.month - 1].out += val(r); }
  const pm = Array.from({ length: 12 }, () => ({ inc: 0, out: 0 }));
  for (const r of (prevLed ?? []) as { kind: string; amount_eur: string | null; month: number }[]) { const v = Number(r.amount_eur ?? 0); if (r.kind === 'income') pm[r.month - 1].inc += v; else pm[r.month - 1].out += v; }
  const lastM = year < now.getFullYear() ? 12 : year > now.getFullYear() ? 0 : now.getMonth() + 1;
  const cum = (a: number[], upto = 12) => { let c = 0; return a.map((v, i) => (i < upto ? (c += v) : null)); };
  const prevOut = pm.reduce((s, m) => s + m.out, 0), prevIn = pm.reduce((s, m) => s + m.inc, 0);
  const same = (a: { inc: number; out: number }[], k: 'inc' | 'out') => a.slice(0, lastM).reduce((s, m) => s + m[k], 0);
  const delta = (a: number, b: number) => (b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)} %` : '–');
  const byDonor = [...sumBy(inc, (r) => r.counterparty_id)].filter(([k]) => k !== '-').sort((a, b) => b[1] - a[1]).slice(0, 10);
  const lg = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const tabs: [typeof VIEWS[number], string][] = [['panoramica', lg('Panoramica', 'Vue d\'ensemble')], ['entrate', lg('Entrate', 'Recettes')], ['uscite', lg('Uscite', 'Dépenses')],
    ['progetti', lg('Progetti', 'Projets')], ['andamento', lg('Andamento', 'Évolution')], ['budget', lg('Preventivo e consuntivo', 'Budget et réalisé')]];
  const groupTable = (
    <Panel title={t('an_by_group')}>
      <p className="panel-b muted" style={{ margin: 0 }}>{t('an_by_group_note').replace('{p}', `${Math.round(elapsed * 100)}%`)}</p>
      {outGroups.length === 0 ? <p className="panel-b muted" style={{ margin: 0 }}>{t('none')}</p> : (
        <div className="tscroll"><table className="t keep">
          <thead><tr><th>{t('an_group')}</th><th className="r">{t('budget')}</th><th className="r">{t('prj_spent')}</th><th className="r">%</th><th style={{ width: '30%' }} /></tr></thead>
          <tbody>
            {outGroups.map((g) => {
              const sp2 = spentG.get(g.id) ?? 0, b = budG.get(g.id) ?? 0, st = state(sp2, b);
              return (
                <tr key={g.id}>
                  <td><Link className="rowlink" href={mov({ tipo: 'expense' })}>{gName.get(g.id)}</Link>{st && <> <span className={`chip ${st === 'ok' ? 'ok' : 'warn'}`}>{t(`an_${st}` as 'an_ok')}</span></>}</td>
                  <td className="r num nw">{b ? money(b, 'EUR', lang) : '–'}</td>
                  <td className="r num nw">{money(sp2, 'EUR', lang)}</td>
                  <td className="r num">{pct(sp2, b)}</td>
                  <td><BudgetBar budget={b} spent={sp2} /></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}
    </Panel>
  );
  const trend = (
    <Panel title={lg(`Entrate e uscite per mese · ${year}`, `Recettes et dépenses par mois · ${year}`)}>
      <div className="panel-b"><MonthBars data={months} lang={lang} labels={{ in: lg('Entrate', 'Recettes'), out: lg('Uscite', 'Dépenses') }}
        hrefFor={(m) => mov({ dal: `${year}-${String(m).padStart(2, '0')}-01`, al: `${year}-${String(m).padStart(2, '0')}-${String(new Date(year, m, 0).getDate()).padStart(2, '0')}` })} />
        <p className="muted small" style={{ margin: '8px 0 0' }}>{lg('Euro, movimenti registrati e verificati. Clic su un mese per i suoi movimenti.', 'Euros, mouvements enregistrés et vérifiés. Cliquez sur un mois pour ses mouvements.')}</p></div>
    </Panel>
  );

  return (
    <div className="stack">
      <PageHead title={`${t('nav_analysis')} ${year}`} />
      <div className="an-top">
        <nav className="segs" aria-label={lg('Viste', 'Vues')}>{tabs.map(([k, l]) => <Link key={k} href={q({ vista: k })} aria-selected={view === k}>{l}</Link>)}</nav>
        <form className="filters" method="get" action="/analisi">
          <input type="hidden" name="anno" value={year} /><input type="hidden" name="vista" value={view} />
          <select className="input" name="progetto" defaultValue={prj} aria-label={t('project')}>
            <option value="">{t('an_all_projects')}</option>
            {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn" type="submit">{t('f_apply')}</button>
        </form>
      </div>
      <ErrorNote prefix={t('error_load')} error={error} />
      <section className="panel">
        <div className="figs">
          <div><span>{t('legend_in')}</span><b className="num amt-in">{money(totIn, 'EUR', lang)}</b><small>{lg('anno prima, stessi mesi', 'année précédente, mêmes mois')} {delta(same(months, 'inc'), same(pm, 'inc'))}</small></div>
          <div><span>{t('legend_out')}</span><b className="num amt-out">{money(totOut, 'EUR', lang)}</b><small>{lg('anno prima, stessi mesi', 'année précédente, mêmes mois')} {delta(same(months, 'out'), same(pm, 'out'))}</small></div>
          <div><span>{t('rep_result')}</span><b className={`num ${totIn - totOut < 0 ? 'neg' : ''}`}>{money(totIn - totOut, 'EUR', lang)}</b></div>
          <div className={totBudget && totOut > totBudget ? 'bad' : ''}><span>{t('an_budget_used')}</span>
            <b className="num">{totBudget ? pct(totOut, totBudget) : t('an_no_budget')}</b><small>{totBudget ? `${lg('su', 'sur')} ${money(totBudget, 'EUR', lang)} · ${lg('anno trascorso', 'année écoulée')} ${Math.round(elapsed * 100)} %` : ''}</small></div>
        </div>
      </section>

      {view === 'panoramica' && <>
        {trend}
        <div className="grid2">
          <Panel title={t('dash_by_project')} pad>
            {byPrj.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t('none')}</p>
              : <HBars lang={lang} rows={byPrj.slice(0, 8).map(([k, v]) => ({ label: prjName.get(k) ?? '–', value: v, href: q({ progetto: k }), color: colorFor(prjName.get(k) ?? k) }))} />}
          </Panel>
          <Panel title={t('an_in_by_group')} pad>
            {inGroups.size === 0 ? <p className="muted" style={{ margin: 0 }}>{t('none')}</p>
              : <HBars lang={lang} many rows={[...inGroups].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: gName.get(k) ?? t('an_unclassified'), value: v }))} />}
          </Panel>
        </div>
      </>}

      {view === 'entrate' && <div className="grid2">
        <Panel title={t('an_in_by_group')} pad>
          {inGroups.size === 0 ? <p className="muted" style={{ margin: 0 }}>{t('none')}</p>
            : <HBars lang={lang} many rows={[...inGroups].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: gName.get(k) ?? t('an_unclassified'), value: v }))} />}
        </Panel>
        <Panel title={lg('Principali donatori e finanziatori', 'Principaux donateurs et bailleurs')} pad>
          {byDonor.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t('none')}</p>
            : <HBars lang={lang} many rows={byDonor.map(([k, v]) => ({ label: cpName.get(k) ?? '–', value: v, href: mov({ cp: k, tipo: 'income' }) }))} />}
        </Panel>
        <Panel title={lg('Entrate per mese', 'Recettes par mois')} className="span2" pad>
          <MonthBars data={months.map((m) => ({ inc: m.inc, out: 0 }))} lang={lang} labels={{ in: lg('Entrate', 'Recettes'), out: '' }} />
        </Panel>
      </div>}

      {view === 'uscite' && <>
        {groupTable}
        <div className="grid2">
          <Panel title={t('an_top_cp')} pad>
            {byCp.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t('an_no_cp')}</p>
              : <HBars lang={lang} many rows={byCp.map(([k, v]) => ({ label: cpName.get(k) ?? '–', value: v, href: mov({ cp: k, tipo: 'expense' }) }))} />}
          </Panel>
          <Panel title={t('an_by_country')} pad>
            <HBars lang={lang} rows={(['IT', 'MG'] as const).map((k) => ({ label: t(k === 'IT' ? 'italy' : 'madagascar'), value: byLoc.get(k) ?? 0, color: k === 'IT' ? 'var(--pp4)' : 'var(--pp2)' }))} />
            <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>{t('an_country_note')}</p>
          </Panel>
        </div>
      </>}

      {view === 'progetti' && (
        <Panel title={t('dash_by_project')} pad>
          {byPrj.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t('none')}</p>
            : <HBars lang={lang} rows={byPrj.map(([k, v]) => ({ label: prjName.get(k) ?? '–', value: v, href: `/progetti/${k}?anno=${year}`, color: colorFor(prjName.get(k) ?? k) }))} />}
          <p className="muted small" style={{ margin: '10px 0 0' }}><Link href={`/progetti?anno=${year}`}>{lg('Schede dei progetti con preventivo e residuo', 'Fiches des projets avec budget et reste')} →</Link></p>
        </Panel>
      )}

      {view === 'andamento' && <>
        {trend}
        <Panel title={lg(`Uscite cumulate: ${year} e ${year - 1}`, `Dépenses cumulées : ${year} et ${year - 1}`)}>
          <div className="panel-b">
            <Lines lang={lang} cats={MESI[lang]} label={lg('Uscite cumulate', 'Dépenses cumulées')}
              refs={totBudget ? [{ v: totBudget, color: 'var(--pp8)', label: lg('preventivo', 'budget') }] : undefined}
              series={[{ name: String(year), color: 'var(--c-out)', vals: cum(months.map((m) => m.out), lastM) as number[] },
                ...(prevOut ? [{ name: String(year - 1), color: 'var(--vz-hyp)', dash: '5 4', w: 2, vals: cum(pm.map((m) => m.out)) as number[] }] : [])]} />
            <div className="legend"><span><i style={{ background: 'var(--c-out)' }} />{year}</span>{prevOut ? <span><i style={{ background: 'var(--vz-hyp)' }} />{year - 1} · {money(prevOut, 'EUR', lang)}</span> : <span className="muted">{lg(`nessun movimento nel ${year - 1}`, `aucun mouvement en ${year - 1}`)}</span>}
              {totBudget > 0 && <span><i style={{ background: 'none', height: 0, width: 16, borderRadius: 0, borderTop: '2px dashed var(--pp8)', verticalAlign: 3 }} />{lg('preventivo', 'budget')} {money(totBudget, 'EUR', lang)}</span>}</div>
          </div>
        </Panel>
        <Panel title={lg(`Entrate cumulate: ${year} e ${year - 1}`, `Recettes cumulées : ${year} et ${year - 1}`)}>
          <div className="panel-b">
            <Lines lang={lang} cats={MESI[lang]} label={lg('Entrate cumulate', 'Recettes cumulées')}
              series={[{ name: String(year), color: 'var(--c-in)', vals: cum(months.map((m) => m.inc), lastM) as number[] },
                ...(prevIn ? [{ name: String(year - 1), color: 'var(--vz-hyp)', dash: '5 4', w: 2, vals: cum(pm.map((m) => m.inc)) as number[] }] : [])]} />
            <div className="legend"><span><i style={{ background: 'var(--c-in)' }} />{year}</span>{prevIn ? <span><i style={{ background: 'var(--vz-hyp)' }} />{year - 1} · {money(prevIn, 'EUR', lang)}</span> : <span className="muted">{lg(`nessun movimento nel ${year - 1}`, `aucun mouvement en ${year - 1}`)}</span>}</div>
          </div>
        </Panel>
      </>}

      {view === 'budget' && <>
        {groupTable}
        <p className="muted" style={{ margin: 0 }}><Link href={`/preventivo?anno=${year}&vista=confronto`}>{lg('Confronto per singolo codice nel Preventivo', 'Comparaison par code dans le Budget')} →</Link></p>
      </>}

      <p className="muted" style={{ margin: 0 }}>{t('an_note')} <Link href={mov({})}>{t('an_open_moves')}</Link></p>
    </div>
  );
}
