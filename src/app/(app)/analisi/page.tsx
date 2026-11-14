import Link from 'next/link';
import { FilterBar } from '@/components/FilterBar';
import { STAFF, can, requireMe } from '@/lib/session';
import { money } from '@/lib/format';
import { Denied, ErrorNote, H2, Panel } from '@/components/Page';
import { BudgetBar, Donut, HBars, Legend, Lines, MonthBars, PAL, Viz } from '@/components/Charts';
import { BudgetCompare, type CmpRow } from '@/components/BudgetCompare';
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
  const byCpAll = [...sumBy(out, (r) => r.counterparty_id)];
  const byCp = byCpAll.filter(([k]) => k !== '-').sort((a, b) => b[1] - a[1]).slice(0, 10);
  // quanto resta senza controparte indicata: va detto, perché le percentuali sono sul totale
  const byCpNone = byCpAll.find(([k]) => k === '-')?.[1] ?? 0;
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
  const byDonorAll = [...sumBy(inc, (r) => r.counterparty_id)];
  const byDonor = byDonorAll.filter(([k]) => k !== '-').sort((a, b) => b[1] - a[1]).slice(0, 10);
  // quanto resta senza controparte indicata: va detto, perché le percentuali sono sul totale
  const byDonorNone = byDonorAll.find(([k]) => k === '-')?.[1] ?? 0;
  const lg = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const tabs: [typeof VIEWS[number], string][] = [['panoramica', lg('Panoramica', 'Vue d\'ensemble')], ['entrate', lg('Entrate', 'Recettes')], ['uscite', lg('Uscite', 'Dépenses')],
    ['progetti', lg('Progetti', 'Projets')], ['andamento', lg('Andamento', 'Évolution')], ['budget', lg('Preventivo e consuntivo', 'Budget et réalisé')]];
  // etichette delle schede per il telefono (data-label) già scritte dal server: TableCards non tocca la tabella, niente differenze all'idratazione
  const groupTable = (
    <Panel title={t('an_by_group')} icon={null}>
      <p className="panel-b muted" style={{ margin: 0 }}>{t('an_by_group_note').replace('{p}', `${Math.round(elapsed * 100)}%`)}</p>
      {outGroups.length === 0 ? <p className="panel-b muted" style={{ margin: 0 }}>{t('none')}</p> : (
        <div className="tscroll"><table className="t" data-cards="">
          <thead><tr><th>{t('an_group')}</th><th className="r">{t('budget')}</th><th className="r">{t('prj_spent')}</th><th className="r">%</th><th style={{ width: '30%' }} /></tr></thead>
          <tbody>
            {outGroups.map((g) => {
              const sp2 = spentG.get(g.id) ?? 0, b = budG.get(g.id) ?? 0, st = state(sp2, b);
              return (
                <tr key={g.id}>
                  <td data-label={t('an_group')}><Link className="rowlink" href={mov({ tipo: 'expense' })}>{gName.get(g.id)}</Link>{st && <> <span className={`chip ${st === 'ok' ? 'ok' : 'warn'}`}>{t(`an_${st}` as 'an_ok')}</span></>}</td>
                  <td className="r num nw" data-label={t('budget')}>{b ? money(b, 'EUR', lang) : '–'}</td>
                  <td className="r num nw" data-label={t('prj_spent')}>{money(sp2, 'EUR', lang)}</td>
                  <td className="r num" data-label="%">{pct(sp2, b)}</td>
                  <td data-label=""><BudgetBar budget={b} spent={sp2} /></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}
    </Panel>
  );
  const trend = (
    <Panel title={lg(`Entrate e uscite per mese · ${year}`, `Recettes et dépenses par mois · ${year}`)} icon={null}>
      <div className="panel-b"><MonthBars data={months} lang={lang} labels={{ in: lg('Entrate', 'Recettes'), out: lg('Uscite', 'Dépenses') }}
        hrefFor={(m) => mov({ dal: `${year}-${String(m).padStart(2, '0')}-01`, al: `${year}-${String(m).padStart(2, '0')}-${String(new Date(year, m, 0).getDate()).padStart(2, '0')}` })} /></div>
    </Panel>
  );

  // ── disegno di Cairn (14/11): riquadri con mini grafico, anelli con elenco, barre appaiate; blu notte = entrate, giallo = uscite, verde = avanzo ──
  const e0 = (v: number) => money(Math.round(v), 'EUR', lang).replace(/,00(?=\s?€)/, '');
  const pc = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '–');
  const net = totIn - totOut;
  const mTip = (title: string, k: 'inc' | 'out') => `${title}\n${months.slice(0, Math.max(lastM, 1)).map((m, n) => `${MESI[lang][n]}: ${e0(m[k])}`).join('\n')}`;
  const top6 = (xs: { k: string; label: string; v: number; href?: string }[], rest: string) => {
    const all = xs.filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    const r = all.length > 6 ? [...all.slice(0, 5), { k: 'rest', label: `${rest} (${all.length - 5})`, v: all.slice(5).reduce((a, x) => a + x.v, 0) }] : all;
    return r.map((x, n) => ({ ...x, color: PAL[n % PAL.length] })) as { k: string; label: string; v: number; href?: string; color: string }[];
  };
  const DonutCard = ({ title, eyebrow, rows: rs, center, tot, empty }: { title: string; eyebrow: string; rows: ReturnType<typeof top6>; center: string; tot: number; empty: string }) => (
    <section className="panel">
      <div className="panel-h"><H2 text={title} icon={null} /><div className="spacer" /><span className="eyebrow">{eyebrow}</span></div>
      <div className="panel-b">{rs.length === 0 ? <p className="muted bq-none">{empty}</p> : (
        <div className="bq-donut">
          <Donut items={rs.map((r) => ({ label: r.label, value: r.v, color: r.color, tip: `${r.label}: ${e0(r.v)} (${pc(r.v, tot)})` }))} center={{ label: center, value: e0(tot) }} />
          <ul className="bq-dl">{rs.map((r) => <li key={r.k}><i style={{ background: r.color }} />{r.href ? <Link href={r.href}>{r.label}</Link> : <span>{r.label}</span>}<b className="num">{e0(r.v)}</b><small className="num">{pc(r.v, tot)}</small></li>)}</ul>
        </div>)}</div>
    </section>);
  const BarsCard = ({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) => (
    <section className="panel">
      <div className="panel-h"><H2 text={title} icon={null} /><div className="spacer" />{eyebrow && <span className="eyebrow">{eyebrow}</span>}</div>
      <div className="panel-b">{children}</div>
    </section>);
  const prjRows = top6(byPrj.map(([k, v]) => ({ k, label: prjName.get(k) ?? '–', v, href: `/progetti/${k}?anno=${year}` })), lg('Altri progetti', 'Autres projets'));
  const inRows = top6([...inGroups].map(([k, v]) => ({ k, label: gName.get(k) ?? t('an_unclassified'), v })), lg('Altre voci', 'Autres postes'));
  const outRows = top6([...spentG].map(([k, v]) => ({ k, label: gName.get(k) ?? t('an_unclassified'), v })), lg('Altre voci', 'Autres postes'));
  // previsto e speso per progetto (preventivo in vigore, righe di uscita)
  const bPrj = new Map<string, number>();
  for (const r of (cmp ?? []) as CmpRow[]) if (r.direction === 'out' && r.project_id && (!prj || r.project_id === prj)) bPrj.set(r.project_id, (bPrj.get(r.project_id) ?? 0) + Number(r.budget_eur));
  const prjIds = [...new Set([...byPrj.map(([k]) => k), ...bPrj.keys()])];
  const pName = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));
  const pairRows = prjIds.map((k) => ({ k, label: pName.get(k) ?? prjName.get(k) ?? '–', b: bPrj.get(k) ?? 0, s: byPrj.find(([x]) => x === k)?.[1] ?? 0 })).filter((r) => r.b || r.s).sort((a, b) => b.s - a.s || b.b - a.b);
  const pairMax = Math.max(1, ...pairRows.flatMap((r) => [r.b, r.s]));
  const itOut = byLoc.get('IT') ?? 0, mgOut = byLoc.get('MG') ?? 0;

  return (
    <div className="stack prj an">
      <ErrorNote prefix={t('error_load')} error={error} />
      <div className="kpis dk prk">
        <div className="kpi">
          <div className="l">{t('legend_in')}</div>
          <div className="v num">{e0(totIn)}</div>
          <Viz.Cols vals={months.map((m) => m.inc)} colors={months.map((_, k) => (k < lastM ? 'var(--navy)' : 'var(--band)'))} tip={mTip(`${t('legend_in')} ${year}`, 'inc')} />
          <div className="vzl"><span>{lg('sull\'anno prima, stessi mesi', 'sur l\'année précédente, mêmes mois')}</span><span>{delta(same(months, 'inc'), same(pm, 'inc'))}</span></div>
          <div className="s">{prevIn ? `${year - 1}: ${e0(same(pm, 'inc'))}` : lg(`nessuna entrata nel ${year - 1}`, `aucune recette en ${year - 1}`)}</div>
        </div>
        <div className="kpi">
          <div className="l">{t('legend_out')}</div>
          <div className="v num">{e0(totOut)}</div>
          <Viz.Cols vals={months.map((m) => m.out)} colors={months.map((_, k) => (k < lastM ? 'var(--vz-sp)' : 'var(--band)'))} tip={mTip(`${t('legend_out')} ${year}`, 'out')} />
          <div className="vzl"><span>{lg('sull\'anno prima, stessi mesi', 'sur l\'année précédente, mêmes mois')}</span><span>{delta(same(months, 'out'), same(pm, 'out'))}</span></div>
          <div className="s">{prevOut ? `${year - 1}: ${e0(same(pm, 'out'))}` : lg(`nessuna uscita nel ${year - 1}`, `aucune dépense en ${year - 1}`)}</div>
        </div>
        <div className="kpi">
          <div className="l">{net < -0.005 ? lg('Disavanzo', 'Déficit') : lg('Avanzo', 'Excédent')}</div>
          <div className={`v num ${net < -0.005 ? 'neg' : 'pos'}`}>{e0(net)}</div>
          {(totIn > 0 || totOut > 0) && <><Viz.Stack segs={net >= 0 ? [{ v: totOut, c: 'var(--vz-sp)' }, { v: net, c: 'var(--green-soft)' }] : [{ v: totIn, c: 'var(--navy)' }, { v: -net, c: 'var(--tax)' }]} max={Math.max(1, totIn, totOut)}
            tip={`${t('legend_in')}: ${e0(totIn)}\n${t('legend_out')}: ${e0(totOut)}`} />
            <div className="vzl"><span>{lg('entrate meno uscite', 'recettes moins dépenses')}</span><span>{net >= 0 ? pc(net, totIn) : ''}</span></div></>}
          <div className="s">{net >= 0 ? lg('le entrate coprono le uscite', 'les recettes couvrent les dépenses') : lg('le uscite superano le entrate', 'les dépenses dépassent les recettes')}</div>
        </div>
        <div className="kpi">
          {totBudget > 0 && <Viz.Ring p={Math.min(totOut / totBudget, 1)} color={totOut > totBudget ? 'var(--tax)' : 'var(--vz-sp)'} tip={`${lg('Speso', 'Dépensé')}: ${e0(totOut)}\n${lg('Previsto', 'Prévu')}: ${e0(totBudget)}`} />}
          <div className="l">{t('an_budget_used')}</div>
          <div className={`v num ${totBudget && totOut > totBudget ? 'neg' : ''}`}>{totBudget ? pc(totOut, totBudget) : '–'}</div>
          {totBudget > 0 && <><Viz.Stack segs={[{ v: Math.min(totOut, totBudget), c: 'var(--vz-sp)' }, { v: Math.max(0, totBudget - totOut), c: 'var(--band)' }, { v: Math.max(0, totOut - totBudget), c: 'var(--tax)' }]} max={Math.max(totBudget, totOut)}
            marks={year === now.getFullYear() ? [{ v: elapsed * totBudget, c: 'var(--navy)', dash: true }] : undefined} tip={`${lg('Previsto', 'Prévu')}: ${e0(totBudget)}\n${lg('Speso', 'Dépensé')}: ${e0(totOut)}`} />
            <div className="vzl"><span>{lg('anno trascorso', 'année écoulée')}</span><span>{Math.round(elapsed * 100)}{' '}%</span></div></>}
          <div className="s">{totBudget ? `${lg('su', 'sur')} ${e0(totBudget)} ${lg('previsti', 'prévus')}` : t('an_no_budget')}</div>
        </div>
      </div>

      <section className="panel fin-bar an-bar">
        <nav className="segs" aria-label={lg('Viste', 'Vues')}>{tabs.map(([k, l]) => <Link key={k} href={q({ vista: k })} aria-current={(view === k) ? "page" : undefined} scroll={false}>{l}</Link>)}</nav>
        <FilterBar className="bare" action="/analisi" lang={lang} hidden={{ anno: String(year), vista: view }}
          inline={<select className="input" name="progetto" defaultValue={prj} aria-label={t('project')}>
            <option value="">{t('an_all_projects')}</option>
            {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>} />
      </section>

      {view === 'panoramica' && <>
        {trend}
        <div className="prj-two">
          <DonutCard title={lg('Dove vanno le uscite', 'Où vont les dépenses')} eyebrow={lg('per progetto', 'par projet')} rows={prjRows} center={t('legend_out')} tot={prjRows.reduce((a, r) => a + r.v, 0)} empty={t('none')} />
          <DonutCard title={lg('Da dove arrivano le entrate', 'D\'où viennent les recettes')} eyebrow={lg('per voce', 'par poste')} rows={inRows} center={t('legend_in')} tot={totIn} empty={t('none')} />
        </div>
      </>}

      {view === 'entrate' && <>
        <div className="prj-two">
          <DonutCard title={t('an_in_by_group')} eyebrow={String(year)} rows={inRows} center={t('legend_in')} tot={totIn} empty={t('none')} />
          <BarsCard title={lg('Principali donatori e finanziatori', 'Principaux donateurs et bailleurs')} eyebrow={lg('primi 10', '10 premiers')}>
            {byDonor.length === 0 ? <p className="muted bq-none">{lg('Nessuna entrata con il donatore indicato.', 'Aucune recette avec le donateur indiqué.')}</p>
              : <HBars lang={lang} color="var(--navy)" total={totIn} rows={[...byDonor.map(([k, v]) => ({ label: cpName.get(k) ?? '–', value: v, href: mov({ cp: k, tipo: 'income' }) })), ...(byDonorNone > 0 ? [{ label: lg('(senza donatore indicato)', '(sans donateur indiqué)'), value: byDonorNone, color: 'var(--line-2)' }] : [])]} />}
          </BarsCard>
        </div>
        <Panel title={lg(`Entrate per mese · ${year}`, `Recettes par mois · ${year}`)} icon={null} pad>
          <MonthBars data={months.map((m) => ({ inc: m.inc, out: 0 }))} lang={lang} labels={{ in: lg('Entrate', 'Recettes'), out: '' }} />
        </Panel>
      </>}

      {view === 'uscite' && <>
        <div className="prj-two">
          <DonutCard title={lg('Uscite per voce', 'Dépenses par poste')} eyebrow={String(year)} rows={outRows} center={t('legend_out')} tot={totOut} empty={t('none')} />
          <BarsCard title={t('an_top_cp')}>
            {byCp.length === 0 ? <p className="muted bq-none">{t('an_no_cp')}</p>
              : <HBars lang={lang} color="var(--vz-sp)" total={totOut} rows={[...byCp.map(([k, v]) => ({ label: cpName.get(k) ?? '–', value: v, href: mov({ cp: k, tipo: 'expense' }) })), ...(byCpNone > 0 ? [{ label: lg('(senza controparte)', '(sans tiers)'), value: byCpNone, color: 'var(--line-2)' }] : [])]} />}
          </BarsCard>
        </div>
        <BarsCard title={t('an_by_country')} eyebrow={lg('conto da cui si è pagato', 'compte de paiement')}>
          <ul className="bq-flow an-loc">
            <li><span>{t('italy')}</span><span className="bq-bb"><i style={{ width: `${((itOut / Math.max(1, itOut, mgOut)) * 100).toFixed(1)}%`, background: 'var(--navy)' }} /></span><b className="num">{e0(itOut)}</b></li>
            <li><span>{t('madagascar')}</span><span className="bq-bb"><i style={{ width: `${((mgOut / Math.max(1, itOut, mgOut)) * 100).toFixed(1)}%`, background: 'var(--green-soft)' }} /></span><b className="num">{e0(mgOut)}</b></li>
          </ul>
        </BarsCard>
        {groupTable}
      </>}

      {view === 'progetti' && <>
        <div className="prj-two">
          <DonutCard title={lg('Dove vanno le uscite', 'Où vont les dépenses')} eyebrow={lg('per progetto', 'par projet')} rows={prjRows} center={t('legend_out')} tot={prjRows.reduce((a, r) => a + r.v, 0)} empty={t('none')} />
          <section className="panel">
            <div className="panel-h"><H2 text={lg('Previsto e speso', 'Prévu et dépensé')} icon={null} /><div className="spacer" />
              <Legend items={[{ label: lg('Previsto', 'Prévu'), color: 'var(--vz-plan)' }, { label: lg('Speso', 'Dépensé'), color: 'var(--vz-sp)' }]} className="prj-leg" /></div>
            <div className="panel-b">{pairRows.length === 0 ? <p className="muted bq-none">{t('none')}</p> : (
              <ul className="bq-pairs prj-pairs">{pairRows.map((r) => (
                <li key={r.k}><Link className="bq-pn" href={`/progetti/${r.k}?anno=${year}`}>{r.label}</Link>
                  <span className="bq-pb"><i className={r.b > 0 ? '' : 'z'} style={{ width: `${((r.b / pairMax) * 100).toFixed(1)}%`, background: 'var(--vz-plan)' }} />
                    <i className={r.s > 0 ? '' : 'z'} style={{ width: `${((r.s / pairMax) * 100).toFixed(1)}%`, background: r.b > 0 && r.s > r.b ? 'var(--tax)' : 'var(--vz-sp)' }} /></span>
                  <span className="bq-pv num"><b>{r.b ? e0(r.b) : '–'}</b><b>{e0(r.s)}</b></span></li>))}</ul>)}</div>
          </section>
        </div>
        <p className="muted small" style={{ margin: 0 }}><Link href={`/progetti?anno=${year}`}>{lg('Schede dei progetti con preventivo e residuo', 'Fiches des projets avec budget et reste')} →</Link></p>
      </>}

      {view === 'andamento' && <>
        {trend}
        <div className="prj-two">
          <section className="panel">
            <div className="panel-h"><H2 text={lg('Uscite cumulate', 'Dépenses cumulées')} icon={null} /><div className="spacer" /><span className="eyebrow">{year} · {year - 1}</span></div>
            <div className="panel-b">
              <Lines lang={lang} cats={MESI[lang]} label={lg('Uscite cumulate', 'Dépenses cumulées')}
                refs={totBudget ? [{ v: totBudget, color: 'var(--vz-plan)', label: lg('preventivo', 'budget') }] : undefined}
                series={[{ name: String(year), color: 'var(--vz-sp)', w: 2.4, vals: cum(months.map((m) => m.out), lastM) as number[] },
                  ...(prevOut ? [{ name: String(year - 1), color: 'var(--vz-hyp)', dash: '5 4', w: 2, vals: cum(pm.map((m) => m.out)) as number[] }] : [])]} />
              <Legend className="under" items={[{ label: String(year), color: 'var(--vz-sp)', value: e0(totOut) }, ...(prevOut ? [{ label: String(year - 1), color: 'var(--vz-hyp)', value: e0(prevOut) }] : []),
                ...(totBudget ? [{ label: lg('Preventivo', 'Budget'), color: 'var(--vz-plan)', value: e0(totBudget) }] : [])]} />
            </div>
          </section>
          <section className="panel">
            <div className="panel-h"><H2 text={lg('Entrate cumulate', 'Recettes cumulées')} icon={null} /><div className="spacer" /><span className="eyebrow">{year} · {year - 1}</span></div>
            <div className="panel-b">
              <Lines lang={lang} cats={MESI[lang]} label={lg('Entrate cumulate', 'Recettes cumulées')}
                series={[{ name: String(year), color: 'var(--navy)', w: 2.4, vals: cum(months.map((m) => m.inc), lastM) as number[] },
                  ...(prevIn ? [{ name: String(year - 1), color: 'var(--vz-hyp)', dash: '5 4', w: 2, vals: cum(pm.map((m) => m.inc)) as number[] }] : [])]} />
              <Legend className="under" items={[{ label: String(year), color: 'var(--navy)', value: e0(totIn) }, ...(prevIn ? [{ label: String(year - 1), color: 'var(--vz-hyp)', value: e0(prevIn) }] : [])]} />
            </div>
          </section>
        </div>
      </>}

      {view === 'budget' && <>
        {groupTable}
        <Panel title={lg('Preventivo in vigore e consuntivo, per codice', 'Budget en vigueur et réalisé, par code')} icon={null}
          right={<Link className="btn small" href={`/preventivo?anno=${year}`}>{lg('Apri il preventivo', 'Ouvrir le budget')}</Link>}>
          <BudgetCompare rows={(cmp ?? []) as CmpRow[]} groups={groups ?? []} lang={lang} year={year} prj={prj || undefined} />
        </Panel>
      </>}

      <p className="muted" style={{ margin: 0 }}>{t('an_note')} <Link href={mov({})}>{t('an_open_moves')}</Link></p>
    </div>
  );
}
