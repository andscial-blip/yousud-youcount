import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { money } from '@/lib/format';
import { Empty, ErrorNote, H2 } from '@/components/Page';
import { Donut, Legend, PAL, Viz } from '@/components/Charts';
import { ProjectIcon } from '@/components/ProjectIcon';
import { THEMES, themeOf } from '@/lib/project-theme';

export const dynamic = 'force-dynamic';
const MESI_S = { it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'], fr: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'] } as const;

type Led = { project_id: string | null; kind: string; amount_eur: string | null; month: number; has_doc?: boolean };
type BI = { project_id: string | null; amount_eur: string | null; category: { direction: string } | null };

// Progetti nel disegno di Cairn (14/11): quattro riquadri con mini grafico, «Dove vanno i fondi» (anello con elenco) accanto a
// «Previsto e speso» (due barre per progetto), poi una scheda per progetto con quota usata, speso, previsto, residuo e andamento,
// con un solo avviso quando serve (oltre il preventivo, spesa in anticipo sul tempo, nessun preventivo). Il dettaglio è il cruscotto del progetto.
export default async function Projects({ searchParams }: { searchParams: Promise<{ anno?: string; tutti?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.anno) || now.getFullYear();
  const { supabase, t, lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const { data: bud } = await supabase.from('budgets').select('id').eq('year', year).eq('status', 'approved').maybeSingle();
  const [{ data: projects, error }, { data: ledger }, { data: items }] = await Promise.all([
    supabase.from('projects').select('id, name, kind, active, demo, theme').order('kind').order('name'),
    supabase.from('v_ledger').select('project_id, kind, amount_eur, month').eq('year', year).neq('kind', 'transfer').eq('out_of_report', false).limit(50000).returns<Led[]>(),
    bud ? supabase.from('budget_items').select('project_id, amount_eur, category:categories(direction)').eq('budget_id', bud.id).returns<BI[]>() : Promise.resolve({ data: [] as BI[] }),
  ]);
  const agg = new Map<string, { out: number; inc: number; n: number; bOut: number; bIn: number; m: number[] }>();
  const A = (id: string) => { let a = agg.get(id); if (!a) { a = { out: 0, inc: 0, n: 0, bOut: 0, bIn: 0, m: Array(12).fill(0) }; agg.set(id, a); } return a; };
  for (const l of ledger ?? []) { if (!l.project_id) continue; const a = A(l.project_id); if (l.kind === 'expense') { a.out += Number(l.amount_eur ?? 0); a.m[(l.month || 1) - 1] += Number(l.amount_eur ?? 0); } else a.inc += Number(l.amount_eur ?? 0); a.n += 1; }
  for (const i of items ?? []) { if (!i.project_id) continue; const a = A(i.project_id); if (i.category?.direction === 'in') a.bIn += Number(i.amount_eur ?? 0); else a.bOut += Number(i.amount_eur ?? 0); }
  const elapsed = year < now.getFullYear() ? 1 : year > now.getFullYear() ? 0 : (now.getTime() - new Date(year, 0, 1).getTime()) / (new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime());
  const all = (projects ?? []).filter((p) => p.active || A(p.id).n > 0);
  const shown = all.filter((p) => sp.tutti || A(p.id).n > 0 || A(p.id).bOut > 0).sort((x, y) => (y.kind === 'structure' ? 1 : 0) - (x.kind === 'structure' ? 1 : 0) || A(y.id).out - A(x.id).out);
  const hidden = all.length - shown.length;
  const e0 = (v: number) => money(Math.round(v), 'EUR', lang).replace(/,00(?=\s?€)/, '');
  const tot = shown.reduce((s, p) => { const a = A(p.id); s.out += a.out; s.inc += a.inc; s.b += a.bOut; return s; }, { out: 0, inc: 0, b: 0 });

  // riquadri e grafici nel disegno di Cairn (14/11): giallo = uscite, blu notte = entrate, azzurro = previsto, verde = disponibile
  const curM = year < now.getFullYear() ? 12 : year > now.getFullYear() ? 0 : now.getMonth() + 1;
  const mOut = Array(12).fill(0) as number[], mInc = Array(12).fill(0) as number[];
  const ids = new Set(shown.map((p) => p.id));
  for (const l of ledger ?? []) { if (!l.project_id || !ids.has(l.project_id)) continue; const k = (l.month || 1) - 1;
    if (l.kind === 'expense') mOut[k] += Number(l.amount_eur ?? 0); else mInc[k] += Number(l.amount_eur ?? 0); }
  const nMov = shown.reduce((n, p) => n + A(p.id).n, 0);
  const over = shown.filter((p) => A(p.id).bOut && A(p.id).out > A(p.id).bOut).length;
  const pc = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '–');
  const mTip = (title: string, vals: number[]) => `${title}\n${vals.map((v, k) => `${MESI_S[lang][k]}: ${e0(v)}`).filter((_, k) => k < Math.max(curM, 1)).join('\n')}`;
  const withB = shown.filter((p) => A(p.id).bOut > 0).sort((x, y) => A(y.id).bOut - A(x.id).bOut);
  const top5 = <T extends { v: number }>(xs: T[], rest: (v: number, n: number) => T) => xs.length > 6 ? [...xs.slice(0, 5), rest(xs.slice(5).reduce((a, x) => a + x.v, 0), xs.length - 5)] : xs;
  const mix = top5(shown.filter((p) => A(p.id).out > 0).sort((x, y) => A(y.id).out - A(x.id).out).map((p) => ({ k: p.id, label: p.name, v: A(p.id).out })),
    (v, n) => ({ k: 'rest', label: L(`Altri progetti (${n})`, `Autres projets (${n})`), v })).map((x, n) => ({ ...x, color: PAL[n % PAL.length] }));
  const pairs = shown.filter((p) => A(p.id).bOut > 0 || A(p.id).out > 0);
  const maxPair = Math.max(1, ...pairs.flatMap((p) => [A(p.id).bOut, A(p.id).out]));
  const C_PLAN = 'var(--vz-plan)', C_SP = 'var(--vz-sp)', C_IN = 'var(--navy)';

  return (
    <div className="stack prj">
      <ErrorNote prefix={t('error_load')} error={error} />
      <div className="kpis dk prk">
        <div className="kpi">
          <div className="l">{L('Previsto', 'Prévu')}</div>
          <div className="v num">{tot.b ? e0(tot.b) : '–'}</div>
          {withB.length > 0 && <><Viz.Stack segs={withB.slice(0, 6).map((p, n) => ({ v: A(p.id).bOut, c: `var(--dn${n + 1})` }))} max={tot.b} tip={withB.map((p) => `${p.name}: ${e0(A(p.id).bOut)}`).join('\n')} />
            <div className="vzl"><span>{withB[0]!.name}</span><span>{pc(A(withB[0]!.id).bOut, tot.b)}</span></div></>}
          <div className="s">{tot.b ? L(`uscite ${year} · ${withB.length === 1 ? '1 progetto' : `${withB.length} progetti`}`, `dépenses ${year} · ${withB.length === 1 ? '1 projet' : `${withB.length} projets`}`) : L('nessun preventivo in vigore', 'aucun budget en vigueur')}</div>
        </div>
        <div className="kpi">
          <div className="l">{L('Speso', 'Dépensé')}</div>
          <div className="v num">{e0(tot.out)}</div>
          <Viz.Cols vals={mOut} colors={mOut.map((_, k) => (k < curM ? C_SP : 'var(--band)'))} tip={mTip(`${L('Uscite', 'Dépenses')} ${year}`, mOut)} />
          <div className="vzl"><span>{tot.b ? L('del previsto', 'du prévu') : L('uscite dei progetti', 'dépenses des projets')}</span><span>{tot.b ? pc(tot.out, tot.b) : ''}</span></div>
          <div className="s">{tot.b ? L(`anno trascorso ${Math.round(elapsed * 100)} %`, `année écoulée ${Math.round(elapsed * 100)} %`) : (nMov === 1 ? L('1 movimento', '1 mouvement') : L(`${nMov} movimenti`, `${nMov} mouvements`))}</div>
        </div>
        <div className="kpi">
          <div className="l">{L('Residuo', 'Reste')}</div>
          <div className={`v num ${tot.b ? (tot.out > tot.b ? 'neg' : 'pos') : ''}`}>{tot.b ? e0(tot.b - tot.out) : '–'}</div>
          {tot.b > 0 && <><Viz.Stack segs={[{ v: Math.min(tot.out, tot.b), c: C_SP }, { v: Math.max(0, tot.b - tot.out), c: 'var(--green-soft)' }, { v: Math.max(0, tot.out - tot.b), c: 'var(--tax)' }]} max={Math.max(tot.b, tot.out)}
            tip={`${L('Previsto', 'Prévu')}: ${e0(tot.b)}\n${L('Speso', 'Dépensé')}: ${e0(tot.out)}`} />
            <div className="vzl"><span>{tot.out > tot.b ? L('oltre il previsto', 'au-delà du prévu') : L('ancora disponibile', 'encore disponible')}</span><span>{pc(Math.abs(tot.b - tot.out), tot.b)}</span></div></>}
          <div className="s">{!tot.b ? L('nessun preventivo in vigore', 'aucun budget en vigueur') : over ? (over === 1 ? L('1 progetto oltre il preventivo', '1 projet au-delà du budget') : L(`${over} progetti oltre il preventivo`, `${over} projets au-delà du budget`)) : L('tutti i progetti nei limiti', 'tous les projets dans les limites')}</div>
        </div>
        <div className="kpi">
          <div className="l">{L('Entrate', 'Recettes')}</div>
          <div className="v num">{e0(tot.inc)}</div>
          <Viz.Cols vals={mInc} colors={mInc.map((_, k) => (k < curM ? C_IN : 'var(--band)'))} tip={mTip(`${L('Entrate', 'Recettes')} ${year}`, mInc)} />
          <div className="vzl"><span>{L('saldo', 'solde')}</span><span>{e0(tot.inc - tot.out)}</span></div>
          <div className="s">{shown.length === 1 ? L('1 progetto', '1 projet') : L(`${shown.length} progetti`, `${shown.length} projets`)} · {nMov === 1 ? L('1 movimento', '1 mouvement') : L(`${nMov} movimenti`, `${nMov} mouvements`)}</div>
        </div>
      </div>

      {pairs.length > 0 && (
        <div className="prj-two">
          <section className="panel">
            <div className="panel-h"><H2 text={L('Dove vanno i fondi', 'Où vont les fonds')} icon={null} /><div className="spacer" /><span className="eyebrow">{L(`speso ${year}`, `dépensé ${year}`)}</span></div>
            <div className="panel-b">{mix.length === 0 ? <p className="muted bq-none">{L('Nessuna uscita registrata sui progetti.', 'Aucune dépense enregistrée sur les projets.')}</p> : (
              <div className="bq-donut">
                <Donut items={mix.map((r) => ({ label: r.label, value: r.v, color: r.color, tip: `${r.label}: ${e0(r.v)} (${pc(r.v, tot.out)})` }))} center={{ label: L('Speso', 'Dépensé'), value: e0(tot.out) }} />
                <ul className="bq-dl">{mix.map((r) => (
                  <li key={r.k}><i style={{ background: r.color }} />{r.k === 'rest' ? <span>{r.label}</span> : <Link href={`/progetti/${r.k}?anno=${year}`}>{r.label}</Link>}<b className="num">{e0(r.v)}</b><small className="num">{pc(r.v, tot.out)}</small></li>))}</ul>
              </div>)}</div>
          </section>
          <section className="panel">
            <div className="panel-h"><H2 text={L('Previsto e speso', 'Prévu et dépensé')} icon={null} /><div className="spacer" />
              <Legend items={[{ label: L('Previsto', 'Prévu'), color: C_PLAN }, { label: L('Speso', 'Dépensé'), color: C_SP }]} className="prj-leg" /></div>
            <div className="panel-b">
              <ul className="bq-pairs prj-pairs">{pairs.map((p) => { const a = A(p.id); return (
                <li key={p.id}>
                  <Link className="bq-pn" href={`/progetti/${p.id}?anno=${year}`}>{p.name}</Link>
                  <span className="bq-pb"><i className={a.bOut > 0 ? '' : 'z'} style={{ width: `${((a.bOut / maxPair) * 100).toFixed(1)}%`, background: C_PLAN }} />
                    <i className={a.out > 0 ? '' : 'z'} style={{ width: `${((a.out / maxPair) * 100).toFixed(1)}%`, background: a.bOut > 0 && a.out > a.bOut ? 'var(--tax)' : C_SP }} /></span>
                  <span className="bq-pv num"><b>{a.bOut ? e0(a.bOut) : '–'}</b><b>{e0(a.out)}</b></span>
                </li>); })}</ul>
            </div>
          </section>
        </div>
      )}

      {shown.length === 0 ? <Empty text={t('prj_none_year').replace('{y}', String(year))} /> : (
        <div className="pring-grid">
          {shown.map((p) => {
            const a = A(p.id), used = a.bOut ? a.out / a.bOut : 0, res = a.bOut - a.out, over = a.bOut > 0 && a.out > a.bOut;
            const R = 40, C = 2 * Math.PI * R, arc = Math.min(used, 1) * C, ex = over ? Math.min(used - 1, 1) * C : 0;
            const tick = elapsed * 2 * Math.PI - Math.PI / 2, mMax = Math.max(...a.m, 1), nowM = year === now.getFullYear() ? now.getMonth() : year < now.getFullYear() ? 11 : -1;
            const note = over ? { c: 'late', t: L(`oltre di ${e0(a.out - a.bOut)}`, `dépassé de ${e0(a.out - a.bOut)}`) }
              : a.bOut && used > elapsed + 0.15 ? { c: 'mid', t: L('spesa veloce', 'dépense rapide') } : !a.bOut && a.out > 0 ? { c: 'mid', t: L('senza preventivo', 'sans budget') } : null;
            return (
              <Link key={p.id} className={`pring${over ? ' over' : ''}`} href={`/progetti/${p.id}?anno=${year}`}>
                <div className="pr-h"><ProjectIcon p={p} />
                  <div className="pr-n"><b>{p.name}</b><small>{L(THEMES[themeOf(p)].it, THEMES[themeOf(p)].fr)}{p.demo ? ' · DEMO' : ''}</small></div>
                  {note && <span className={`cdp ${note.c}`}>{note.t}</span>}</div>
                <div className="pr-mid">
                  <svg className="pr-ring" viewBox="0 0 100 100" role="img" aria-label={a.bOut ? `${Math.round(used * 100)} %` : L('senza preventivo', 'sans budget')}>
                    <circle cx="50" cy="50" r={R} className="rg-t" />
                    {a.bOut > 0 && <circle cx="50" cy="50" r={R} className="rg-a" strokeDasharray={`${arc.toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 50 50)" />}
                    {ex > 0 && <circle cx="50" cy="50" r={R - 9} className="rg-x" strokeDasharray={`${((ex / C) * 2 * Math.PI * (R - 9)).toFixed(1)} ${(2 * Math.PI * (R - 9)).toFixed(1)}`} transform="rotate(-90 50 50)" />}
                    {a.bOut > 0 && <line x1={50 + Math.cos(tick) * (R - 7)} y1={50 + Math.sin(tick) * (R - 7)} x2={50 + Math.cos(tick) * (R + 7)} y2={50 + Math.sin(tick) * (R + 7)} className="rg-k" />}
                    <text x="50" y="55" textAnchor="middle" className="rg-v">{a.bOut ? `${Math.round(used * 100)}%` : '–'}</text>
                  </svg>
                  <dl className="pr-nums">
                    <div><dt>{L('Speso', 'Dépensé')}</dt><dd className="num">{e0(a.out)}</dd></div>
                    <div><dt>{L('Previsto', 'Prévu')}</dt><dd className="num">{a.bOut ? e0(a.bOut) : '–'}</dd></div>
                    <div><dt>{L('Residuo', 'Reste')}</dt><dd className={`num ${over ? 'neg' : ''}`}>{a.bOut ? e0(res) : '–'}</dd></div>
                  </dl>
                </div>
                <div className="pr-spark" aria-label={L('Uscite per mese', 'Dépenses par mois')}>
                  {a.m.map((v, i) => <i key={i} className={i === nowM ? 'cur' : i > nowM ? 'fut' : ''} style={{ height: `${Math.max(v > 0 ? 8 : 3, (v / mMax) * 100)}%` }} title={`${MESI_S[lang][i]}: ${e0(v)}`} />)}
                </div>
                <div className="pr-f"><span>{L('Entrate', 'Recettes')} <b className="num">{e0(a.inc)}</b></span><span>{L(`${a.n} movimenti`, `${a.n} mouvements`)}</span></div>
              </Link>
            );
          })}
        </div>
      )}
      {hidden > 0 && <p className="muted" style={{ margin: 0 }}><Link href={`/progetti?anno=${year}&tutti=1`}>{L(`Mostra anche ${hidden} progetti senza movimenti né preventivo nel ${year}`, `Afficher aussi ${hidden} projets sans mouvements ni budget en ${year}`)}</Link></p>}
    </div>
  );
}
