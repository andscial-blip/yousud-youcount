import Link from 'next/link';
import { FilterBar } from '@/components/FilterBar';
import { Ico } from '@/components/Ui';
import { money } from '@/lib/format';
import { Denied, Empty, H2, Panel } from '@/components/Page';
import { BudgetNotes, BudgetTiles, C_EXP, C_INC, NoBudget, VersionBar, loadBudget } from '../shared';

export const dynamic = 'force-dynamic';

type SumRow = { k: string; label: string; v: number; lvl: 1 | 2; share: number };

// Riepilogo del preventivo (richiesta del 12/11): gli stessi riquadri della scheda principale, poi due tabelle gemelle
// (uscite per voce, entrate per voce: stesse colonne, stessa griglia) e la tabella per progetto a tutta larghezza.
// In fondo, a richiesta, lo schema del rendiconto per cassa (Mod. D) per il commercialista.
export default async function BudgetSummaryPage({ searchParams }: {
  searchParams: Promise<{ anno?: string; v?: string; progetto?: string; schema?: string; ok?: string; err?: string; n?: string }>;
}) {
  const sp = await searchParams;
  const c = await loadBudget(sp);
  const { L, lang, year, shown, its, prjBy, CL, dirOf, eur, e0, supabase } = c;
  if (!c.staff) return <Denied text={c.t('only_staff')} />;
  if (!shown) return <div className="stack bq"><BudgetNotes c={c} sp={sp} /><NoBudget c={c} /></div>;
  const showSchema = sp.schema === '1';
  const prj = /^[0-9a-f-]{36}$/.test(sp.progetto ?? '') ? sp.progetto! : sp.progetto === 'gen' ? 'gen' : '';
  const href = (q: Record<string, string | number | undefined> = {}, hash = '') => {
    const u = new URLSearchParams({ anno: String(year), v: shown.id });
    for (const [k, v] of Object.entries({ progetto: prj, ...q })) if (v !== undefined && v !== '') u.set(k, String(v));
    return `/preventivo/riepilogo?${u}${hash}`;
  };
  const [{ data: stB }, { data: stA }] = showSchema ? await Promise.all([
    supabase.rpc('budget_statement', { p_year: year, p_budget: shown.status !== 'approved' ? shown.id : null }),
    supabase.rpc('report_cash_statement', { p_year: year }),
  ]) : [{ data: null }, { data: null }];

  const fil = its.filter((i) => !prj || (prj === 'gen' ? i.project_id === null : i.project_id === prj));
  const totOf = (d: 'in' | 'out') => eur(fil.filter((i) => dirOf(i) === d));
  const totIn = totOf('in'), totOut = totOf('out');
  const byCode = (d: 'in' | 'out'): SumRow[] => { const tot = d === 'out' ? totOut : totIn;
    return c.groups.filter((g) => g.direction === d).flatMap((g) => {
      const cs = c.cats.filter((k) => k.group_id === g.id).map((k) => ({ k, v: eur(fil.filter((i) => i.category_id === k.id)) })).filter((x) => x.v);
      if (!cs.length) return [];
      const gv = cs.reduce((s, x) => s + x.v, 0);
      return [{ k: g.id, label: `${g.code} · ${CL(g)}`, v: gv, lvl: 1 as const, share: tot ? gv / tot : 0 },
        ...cs.map((x) => ({ k: x.k.id, label: `${x.k.code} · ${CL(x.k)}`, v: x.v, lvl: 2 as const, share: tot ? x.v / tot : 0 }))];
    }); };
  const byPrj = [...new Set(fil.map((i) => i.project_id ?? ''))].map((p) => { const xs = fil.filter((i) => (i.project_id ?? '') === p);
    return { k: p || 'gen', label: p ? prjBy.get(p) ?? '–' : L('Generale (struttura)', 'Général (structure)'), inc: eur(xs.filter((i) => dirOf(i) === 'in')), out: eur(xs.filter((i) => dirOf(i) === 'out')), n: xs.length }; })
    .sort((a, b) => b.out - a.out || b.inc - a.inc);
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const usedPrj = c.projects.filter((p) => its.some((i) => i.project_id === p.id));

  const CodeTable = ({ d }: { d: 'in' | 'out' }) => { const rows = byCode(d), tot = d === 'out' ? totOut : totIn, color = d === 'out' ? C_EXP : C_INC;
    return (
      <section className="panel bqs-t">
        <div className="panel-h"><H2 text={d === 'out' ? L('Uscite per voce', 'Dépenses par poste') : L('Entrate per voce', 'Recettes par poste')} icon={null} /><div className="spacer" /><b className="num bqs-tot">{e0(tot)}</b></div>
        {rows.length === 0 ? <Empty text={L('Nessuna riga.', 'Aucune ligne.')} /> : (
          <table className="t keep bqs">
            <thead><tr><th>{L('Voce', 'Poste')}</th><th className="r">{L('Importo', 'Montant')}</th><th className="r">%</th><th className="bqs-bc"><span className="sr-only">{L('Quota', 'Part')}</span></th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.k} className={`lv${r.lvl}`}>
                <td>{r.label}</td><td className="r num">{e0(r.v)}</td><td className="r num">{pct(r.share)}</td>
                <td className="bqs-bc"><span className="bqs-bar"><i style={{ width: `${Math.min(r.share, 1) * 100}%`, background: color }} /></span></td>
              </tr>))}</tbody>
            <tfoot><tr><td>{d === 'out' ? L('Totale uscite', 'Total des dépenses') : L('Totale entrate', 'Total des recettes')}</td><td className="r num">{e0(tot)}</td><td className="r num">{tot ? pct(1) : ''}</td><td className="bqs-bc" /></tr></tfoot>
          </table>
        )}
      </section>); };

  return (
    <div className="stack bq">
      <BudgetNotes c={c} sp={sp} />
      <BudgetTiles c={c} />
      <VersionBar c={c} base="/preventivo/riepilogo" />

      <section className="panel bqs-tools">
        <FilterBar action="/preventivo/riepilogo" lang={lang} hidden={{ anno: String(year), v: shown.id, schema: showSchema ? '1' : '' }}
          inline={<select className="input" name="progetto" defaultValue={prj} aria-label={L('Progetto', 'Projet')}>
            <option value="">{L('Tutti i progetti', 'Tous les projets')}</option>
            <option value="gen">{L('Generale (struttura)', 'Général (structure)')}</option>
            {usedPrj.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>}
          after={<a className="btn fb-exp" href={`/api/v1/export/budget?anno=${year}&v=${shown.id}`} aria-label={c.t('exp_xlsx')}><Ico name="download" /><span>{c.t('exp_xlsx')}</span></a>} />
      </section>

      {its.length === 0 ? <Panel pad><Empty text={L('Il preventivo è vuoto: le righe si aggiungono nella scheda «Preventivo analitico».', 'Le budget est vide : les lignes s\'ajoutent dans l\'onglet « Budget détaillé ».')} /></Panel> : (<>
        <div className="bqs-pair"><CodeTable d="out" /><CodeTable d="in" /></div>

        <section className="panel bqs-t">
          <div className="panel-h"><H2 text={L('Per progetto', 'Par projet')} icon={null} /><div className="spacer" />
            <b className={`num bqs-tot ${totIn - totOut < -0.005 ? 'neg' : ''}`}>{L('saldo', 'solde')} {e0(totIn - totOut)}</b></div>
          <div className="tscroll">
            <table className="t keep bqs bqs-p">
              <thead><tr><th>{L('Progetto', 'Projet')}</th><th className="r">{L('Righe', 'Lignes')}</th><th className="r">{L('Entrate', 'Recettes')}</th><th className="r">{L('Uscite', 'Dépenses')}</th>
                <th className="r">{L('Saldo', 'Solde')}</th><th className="r">{L('% uscite', '% dépenses')}</th><th className="bqs-bc"><span className="sr-only">{L('Quota', 'Part')}</span></th></tr></thead>
              <tbody>{byPrj.map((r) => (
                <tr key={r.k} className="lv2">
                  <td><Link href={`/preventivo?anno=${year}&v=${shown.id}&progetto=${r.k}#righe`}>{r.label}</Link></td><td className="r num">{r.n}</td>
                  <td className="r num" data-l={L('Entrate', 'Recettes')}>{e0(r.inc)}</td><td className="r num" data-l={L('Uscite', 'Dépenses')}>{e0(r.out)}</td>
                  <td className={`r num ${r.inc - r.out < -0.005 ? 'neg' : ''}`} data-l={L('Saldo', 'Solde')}>{e0(r.inc - r.out)}</td><td className="r num">{totOut ? pct(r.out / totOut) : ''}</td>
                  <td className="bqs-bc"><span className="bqs-bar"><i style={{ width: `${totOut ? Math.min(r.out / totOut, 1) * 100 : 0}%`, background: C_EXP }} /></span></td>
                </tr>))}</tbody>
              <tfoot><tr><td>{L('Totale', 'Total')}</td><td className="r num">{fil.length}</td><td className="r num" data-l={L('Entrate', 'Recettes')}>{e0(totIn)}</td><td className="r num" data-l={L('Uscite', 'Dépenses')}>{e0(totOut)}</td>
                <td className={`r num ${totIn - totOut < -0.005 ? 'neg' : ''}`} data-l={L('Saldo', 'Solde')}>{e0(totIn - totOut)}</td><td className="r num">{totOut ? pct(1) : ''}</td><td className="bqs-bc" /></tr></tfoot>
            </table>
          </div>
        </section>
      </>)}

      {showSchema ? (
        <Panel title={`${L('Schema del rendiconto per cassa (Mod. D)', 'Schéma du compte rendu de caisse (Mod. D)')} · ${c.vLabel(shown)}`} icon={null}
          right={<Link className="btn small ghost" href={href({ schema: undefined })}>{L('Nascondi', 'Masquer')}</Link>}>
          <StatementTable budget={(stB ?? []) as StLine[]} actual={(stA ?? []) as StAct[]} lang={lang} />
        </Panel>
      ) : (
        <Link className="bv-more" href={href({ schema: 1 }, '#mod-d')}>
          ▸ {L('Mostra lo schema del rendiconto (Mod. D) · per il commercialista', 'Afficher le schéma du compte rendu (Mod. D) · pour l\'expert-comptable')}</Link>
      )}
      <span id="mod-d" />
    </div>
  );
}

type StLine = { direction: 'in' | 'out'; section: string; section_it: string; section_fr: string; key: string | null; name_it: string; name_fr: string; sort: number; budget_eur: string };
type StAct = { direction: 'in' | 'out'; key: string; amount_eur: string };

// Preventivo e consuntivo per voce del rendiconto, con subtotali per sezione e avanzo/disavanzo.
function StatementTable({ budget, actual, lang }: { budget: StLine[]; actual: StAct[]; lang: 'it' | 'fr' }) {
  const L = (it: string, fr: string) => (lang === 'fr' && fr ? fr : it);
  const m = (v: number) => money(v, 'EUR', lang);
  const act = new Map(actual.map((a) => [`${a.direction}|${a.key}`, Number(a.amount_eur)]));
  const rows = budget.map((b) => ({ ...b, b: Number(b.budget_eur), a: b.key ? act.get(`${b.direction}|${b.key}`) ?? 0 : 0 }));
  const tot = (d: 'in' | 'out', k: 'a' | 'b') => rows.filter((r) => r.direction === d).reduce((s, r) => s + r[k], 0);
  if (!rows.some((r) => r.b || r.a)) return <Empty text={L('Nessuna voce: il preventivo è vuoto e non ci sono movimenti nell\'anno.', 'Aucun poste : le budget est vide et il n\'y a pas de mouvements dans l\'année.')} />;
  const LB = [L('Preventivo', 'Budget'), L('Consuntivo', 'Réalisé'), L('Differenza', 'Écart')];
  const block = (d: 'in' | 'out') => {
    const secs: StLine['section'][] = [...new Set(rows.filter((r) => r.direction === d).map((r) => r.section))];
    return secs.map((sec) => {
      const rs = rows.filter((r) => r.direction === d && r.section === sec);
      const sb = rs.reduce((s, r) => s + r.b, 0), sa = rs.reduce((s, r) => s + r.a, 0);
      if (!sb && !sa) return null;
      return (
        <tbody key={`${d}${sec}`}>
          <tr className="sub"><td colSpan={2}><b>{L(rs[0].section_it, rs[0].section_fr)}</b></td>
            <td className="r num" data-l={LB[0]}><b>{m(sb)}</b></td><td className="r num" data-l={LB[1]}><b>{m(sa)}</b></td><td className={`r num ${d === 'out' && sb - sa < 0 ? 'neg' : ''}`} data-l={LB[2]}><b>{m(sb - sa)}</b></td></tr>
          {rs.filter((r) => r.b || r.a).map((r) => (
            <tr key={`${d}${r.key ?? 'x'}`} className={r.key ? undefined : 'warn'}>
              <td className="nw muted">{r.key ?? '–'}</td><td>{L(r.name_it, r.name_fr)}</td>
              <td className="r num" data-l={LB[0]}>{m(r.b)}</td><td className="r num" data-l={LB[1]}>{r.key ? m(r.a) : '–'}</td><td className={`r num ${d === 'out' && r.key && r.b - r.a < 0 ? 'neg' : ''}`} data-l={LB[2]}>{r.key ? m(r.b - r.a) : '–'}</td>
            </tr>
          ))}
        </tbody>
      );
    });
  };
  const inB = tot('in', 'b'), outB = tot('out', 'b'), inA = tot('in', 'a'), outA = tot('out', 'a');
  return (
    <div className="tscroll">
      <table className="t keep stmt">
        <thead><tr><th>{L('Voce', 'Poste')}</th><th /><th className="r">{L('Preventivo', 'Budget')}</th><th className="r">{L('Consuntivo', 'Réalisé')}</th><th className="r">{L('Differenza', 'Écart')}</th></tr></thead>
        <tbody><tr className="sec"><th colSpan={5} scope="rowgroup">{L('Uscite', 'Dépenses')}</th></tr></tbody>
        {block('out')}
        <tbody><tr className="tot"><td colSpan={2}>{L('Totale uscite', 'Total des dépenses')}</td><td className="r num" data-l={LB[0]}>{m(outB)}</td><td className="r num" data-l={LB[1]}>{m(outA)}</td><td className={`r num ${outB - outA < 0 ? 'neg' : ''}`} data-l={LB[2]}>{m(outB - outA)}</td></tr></tbody>
        <tbody><tr className="sec"><th colSpan={5} scope="rowgroup">{L('Entrate', 'Recettes')}</th></tr></tbody>
        {block('in')}
        <tbody>
          <tr className="tot"><td colSpan={2}>{L('Totale entrate', 'Total des recettes')}</td><td className="r num" data-l={LB[0]}>{m(inB)}</td><td className="r num" data-l={LB[1]}>{m(inA)}</td><td className="r num" data-l={LB[2]}>{m(inB - inA)}</td></tr>
          <tr className="tot"><td colSpan={2}>{L('Avanzo (disavanzo)', 'Excédent (déficit)')}</td><td className="r num" data-l={LB[0]}>{m(inB - outB)}</td><td className="r num" data-l={LB[1]}>{m(inA - outA)}</td><td /></tr>
        </tbody>
      </table>
    </div>
  );
}
