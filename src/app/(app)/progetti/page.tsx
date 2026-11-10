import Link from 'next/link';
import { CIcon } from '@/components/CIcon';
import { requireMe } from '@/lib/session';
import { money } from '@/lib/format';
import { Empty, ErrorNote, PageHead } from '@/components/Page';
import { ProjectIcon } from '@/components/ProjectIcon';
import { THEMES, themeOf } from '@/lib/project-theme';

export const dynamic = 'force-dynamic';
const MESI_S = { it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'], fr: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'] } as const;

type Led = { project_id: string | null; kind: string; amount_eur: string | null; month: number; has_doc?: boolean };
type BI = { project_id: string | null; amount_eur: string | null; category: { direction: string } | null };

// Progetti come schede: preventivo dell'anno, uscite, entrate, saldo, residuo e quota usata, con un solo avviso
// quando serve (oltre il preventivo, spesa in anticipo sul tempo, nessun preventivo). Il dettaglio è il cruscotto del progetto.
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

  return (
    <div className="stack">
      <PageHead title={`${t('nav_projects')} ${year}`} />
      <ErrorNote prefix={t('error_load')} error={error} />
      {(() => {
        const over = shown.filter((p) => A(p.id).bOut && A(p.id).out > A(p.id).bOut).length;
        const used = tot.b ? tot.out / tot.b : 0;
        const tones = ['#23735F', '#5B7FA6', '#5FB8A3', '#8FAFD6', '#A9D9CB', '#C9D6EA'];
        const mix = shown.filter((p) => A(p.id).out > 0).map((p, i) => ({ p, v: A(p.id).out, c: p.kind === 'structure' ? '#3E5470' : tones[i % tones.length] }));
        return (<>
          <div className="kpi4 ptiles">
            <div className="k4 k-plan"><span className="k4-t"><CIcon name="wallet" size={15} />{L('Previsto', 'Prévu')}</span><b className="num">{e0(tot.b)}</b><small>{L(`uscite ${year}`, `dépenses ${year}`)}</small></div>
            <div className="k4 k-spent"><span className="k4-t"><CIcon name="chart" size={15} />{L('Speso', 'Dépensé')}</span><b className="num">{e0(tot.out)}</b>
              <small>{tot.b ? L(`${Math.round(used * 100)} % del previsto · anno ${Math.round(elapsed * 100)} %`, `${Math.round(used * 100)} % du prévu · année ${Math.round(elapsed * 100)} %`) : L('nessun preventivo', 'aucun budget')}</small></div>
            <div className={`k4 k-res${tot.b && tot.out > tot.b ? ' warn' : ''}`}><span className="k4-t"><CIcon name="calc" size={15} />{L('Residuo', 'Reste')}</span><b className={`num ${tot.b && tot.out > tot.b ? 'neg' : 'pos'}`}>{tot.b ? e0(tot.b - tot.out) : '–'}</b>
              <small className={over ? 'neg' : ''}>{over ? L(`${over} oltre il preventivo`, `${over} au-delà du budget`) : L('tutti nei limiti', 'tous dans les limites')}</small></div>
            <div className="k4 k-in"><span className="k4-t"><CIcon name="trend" size={15} />{L('Entrate', 'Recettes')}</span><b className="num">{e0(tot.inc)}</b>
              <small>{L(`${shown.length} progetti attivi`, `${shown.length} projets actifs`)}</small></div>
          </div>
          {mix.length > 1 && (
            <div className="pmix" aria-label={L('Dove vanno i fondi', 'Où vont les fonds')}>
              <span className="pmix-l">{L('Dove vanno i fondi', 'Où vont les fonds')}</span>
              <div className="pmix-b">{mix.map(({ p, v, c }) => <i key={p.id} title={`${p.name}: ${e0(v)}`} style={{ width: `${(v / tot.out) * 100}%`, background: c }} />)}</div>
              <ul className="pmix-k">{mix.map(({ p, v, c }) => <li key={p.id}><i style={{ background: c }} /><span>{p.name}</span><b className="num">{Math.round((v / tot.out) * 100)} %</b></li>)}</ul>
            </div>
          )}
        </>);
      })()}
      {shown.length === 0 ? <Empty text={t('prj_none_year').replace('{y}', String(year))} /> : (
        <div className="pring-grid">
          {shown.map((p) => {
            const a = A(p.id), used = a.bOut ? a.out / a.bOut : 0, res = a.bOut - a.out, over = a.bOut > 0 && a.out > a.bOut;
            const R = 40, C = 2 * Math.PI * R, arc = Math.min(used, 1) * C, ex = over ? Math.min(used - 1, 1) * C : 0;
            const tick = elapsed * 2 * Math.PI - Math.PI / 2, mMax = Math.max(...a.m, 1), curM = year === now.getFullYear() ? now.getMonth() : 11;
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
                  {a.m.map((v, i) => <i key={i} className={i === curM ? 'cur' : i > curM ? 'fut' : ''} style={{ height: `${Math.max(v > 0 ? 8 : 3, (v / mMax) * 100)}%` }} title={`${MESI_S[lang][i]}: ${e0(v)}`} />)}
                </div>
                <div className="pr-f"><span>{L('Entrate', 'Recettes')} <b className="num pos">{e0(a.inc)}</b></span><span>{L(`${a.n} movimenti`, `${a.n} mouvements`)}</span></div>
              </Link>
            );
          })}
        </div>
      )}
      {hidden > 0 && <p className="muted" style={{ margin: 0 }}><Link href={`/progetti?anno=${year}&tutti=1`}>{L(`Mostra anche ${hidden} progetti senza movimenti né preventivo nel ${year}`, `Afficher aussi ${hidden} projets sans mouvements ni budget en ${year}`)}</Link></p>}
    </div>
  );
}
