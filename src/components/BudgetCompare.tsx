import Link from 'next/link';
import { money } from '@/lib/format';
import { Empty } from './Page';

export type CmpRow = { direction: 'in' | 'out'; group_id: string; group_code: string; category_id: string; category_code: string; cat_it: string;
  cat_fr: string | null; project_id: string | null; project_name: string | null; budget_eur: string; actual_eur: string; committed_eur: string; movements: number };
type Grp = { id: string; code: string; name_it: string; name_fr: string | null; direction: 'in' | 'out'; sort: number };

const NEAR = 0.9;   // avviso quando speso più impegnato arriva al 90% della voce

// Confronto tra preventivo in vigore e consuntivo, una riga per codice (dal 12/11 sta in Analisi › Preventivo e consuntivo;
// prima era una scheda del Preventivo). Barra: speso su previsto; tacca = parte dell'anno trascorsa; rosso solo oltre il previsto.
export function BudgetCompare({ rows, groups, lang, year, prj }: { rows: CmpRow[]; groups: Grp[]; lang: 'it' | 'fr'; year: number; prj?: string }) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const N = (g: { name_it: string; name_fr: string | null }) => (lang === 'fr' && g.name_fr ? g.name_fr : g.name_it);
  const e0 = (v: number) => money(Math.round(v), 'EUR', lang).replace(/,00(?=\s?€)/, '');
  const fr = rows.filter((r) => (!prj || r.project_id === prj) && (Number(r.budget_eur) || Number(r.actual_eur) || Number(r.committed_eur)));
  const by = new Map<string, { b: number; a: number; c: number; n: number; r: CmpRow }>();
  for (const r of fr) { const x = by.get(r.category_id) ?? { b: 0, a: 0, c: 0, n: 0, r };
    x.b += Number(r.budget_eur); x.a += Number(r.actual_eur); x.c += Number(r.committed_eur); x.n += r.movements; by.set(r.category_id, x); }
  if (by.size === 0) return <Empty text={L('Nessuna voce: non c\'è un preventivo in vigore e non ci sono movimenti nell\'anno.', 'Aucun poste : il n\'y a pas de budget en vigueur ni de mouvements dans l\'année.')} />;
  const all = [...by.values()];
  const tot = (d: 'in' | 'out', k: 'a' | 'b') => all.filter((x) => x.r.direction === d).reduce((s, x) => s + x[k], 0);
  const inB = tot('in', 'b'), outB = tot('out', 'b'), inA = tot('in', 'a'), outA = tot('out', 'a');
  const over = all.filter((x) => x.r.direction === 'out' && x.a > x.b + 0.005);
  const near = all.filter((x) => x.r.direction === 'out' && x.b > 0 && x.a <= x.b && x.a + x.c >= x.b * NEAR);
  const now = new Date();
  const elapsed = year < now.getFullYear() ? 1 : year > now.getFullYear() ? 0
    : (now.getTime() - new Date(year, 0, 1).getTime()) / (new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime());
  const Bar = ({ b, a }: { b: number; a: number }) => { const p = b > 0 ? a / b : a > 0 ? 2 : 0;
    return <span className={`cb-bar${p > 1.0005 ? ' over' : ''}`} aria-hidden="true"><i style={{ width: `${Math.min(p, 1) * 100}%` }} />{b > 0 && year === now.getFullYear() && <em style={{ left: `${elapsed * 100}%` }} />}</span>; };
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '');
  const section = (d: 'in' | 'out') => groups.filter((g) => g.direction === d && all.some((x) => x.r.group_id === g.id)).map((g) => {
    const cs = all.filter((x) => x.r.group_id === g.id).sort((a, b) => a.r.category_code.localeCompare(b.r.category_code, 'it', { numeric: true }));
    const gb = cs.reduce((s, x) => s + x.b, 0), ga = cs.reduce((s, x) => s + x.a, 0);
    return (
      <tbody key={g.id}>
        <tr className="cb-grp"><th scope="rowgroup" colSpan={2}>{g.code} · {N(g)}</th><td className="r num">{e0(gb)}</td><td className="r num">{e0(ga)}</td>
          <td className={`r num ${d === 'out' && gb - ga < 0 ? 'neg' : ''}`}>{e0(gb - ga)}</td><td className="r num">{pct(ga, gb)}</td><td /></tr>
        {cs.map((x) => { const isOver = d === 'out' && x.a > x.b + 0.005;
          return (
            <tr key={x.r.category_id} className={isOver ? 'over' : ''}>
              <td className="nw" data-l={L('Codice', 'Code')}><b>{x.r.category_code}</b></td>
              <td data-l={L('Voce', 'Poste')}>{lang === 'fr' && x.r.cat_fr ? x.r.cat_fr : x.r.cat_it}{!x.b && x.a > 0 && <span className="chip warn">{L('non prevista', 'non prévue')}</span>}</td>
              <td className="r num" data-l={L('Previsto', 'Prévu')}>{e0(x.b)}</td>
              <td className="r num" data-l={d === 'out' ? L('Speso', 'Dépensé') : L('Incassato', 'Encaissé')}>{x.n > 0
                ? <Link href={`/movimenti?dal=${year}-01-01&al=${year}-12-31&codice=${x.r.category_id}${prj ? `&progetto=${prj}` : ''}`}>{e0(x.a)}</Link> : e0(x.a)}</td>
              <td className={`r num ${d === 'out' && x.b - x.a < 0 ? 'neg' : ''}`} data-l={L('Residuo', 'Reste')}>{e0(x.b - x.a)}</td>
              <td className="r num" data-l="%">{x.b > 0 ? pct(x.a, x.b) : '–'}</td>
              <td className="cb-bc"><Bar b={x.b} a={x.a} /></td>
            </tr>); })}
      </tbody>);
  });
  return (<>
    {(over.length > 0 || near.length > 0) && (
      <div className="cb-al">
        {over.length > 0 && <span className="chip bad">{over.length === 1 ? L('1 codice oltre il previsto', '1 code au-delà du prévu') : L(`${over.length} codici oltre il previsto`, `${over.length} codes au-delà du prévu`)}</span>}
        {near.length > 0 && <span className="chip warn">{near.length === 1 ? L('1 vicino al limite', '1 proche de la limite') : L(`${near.length} vicini al limite`, `${near.length} proches de la limite`)}</span>}
      </div>
    )}
    <div className="tscroll">
      <table className="t keep cbudget">
        <thead><tr><th>{L('Codice', 'Code')}</th><th>{L('Voce', 'Poste')}</th><th className="r">{L('Previsto', 'Prévu')}</th><th className="r">{L('Speso / incassato', 'Dépensé / encaissé')}</th>
          <th className="r">{L('Residuo', 'Reste')}</th><th className="r">%</th><th className="cb-bc" /></tr></thead>
        <tbody><tr className="bl-sec"><th colSpan={2} scope="rowgroup">{L('Uscite', 'Dépenses')}</th><td className="r num"><b>{e0(outB)}</b></td><td className="r num"><b>{e0(outA)}</b></td>
          <td className={`r num ${outB - outA < 0 ? 'neg' : ''}`}><b>{e0(outB - outA)}</b></td><td className="r num"><b>{pct(outA, outB)}</b></td><td className="cb-bc"><Bar b={outB} a={outA} /></td></tr></tbody>
        {section('out')}
        <tbody><tr className="bl-sec"><th colSpan={2} scope="rowgroup">{L('Entrate', 'Recettes')}</th><td className="r num"><b>{e0(inB)}</b></td><td className="r num"><b>{e0(inA)}</b></td>
          <td className="r num"><b>{e0(inB - inA)}</b></td><td className="r num"><b>{pct(inA, inB)}</b></td><td className="cb-bc"><Bar b={inB} a={inA} /></td></tr></tbody>
        {section('in')}
      </table>
    </div>
    <p className="bv-hint small">{L('Una riga per codice. Barra: speso su previsto; tacca = parte dell\'anno trascorsa; rosso solo oltre il previsto. Clic sull\'importo speso o incassato: i movimenti che lo compongono.',
      'Une ligne par code. Barre : dépensé sur prévu ; repère = part de l\'année écoulée ; rouge seulement au-delà du prévu. Clic sur le montant dépensé ou encaissé : les mouvements qui le composent.')}</p>
  </>);
}
