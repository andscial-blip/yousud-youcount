import Link from 'next/link';
import { CIcon } from '@/components/CIcon';
import { requireMe } from '@/lib/session';
import { money } from '@/lib/format';
import { Empty, ErrorNote, PageHead } from '@/components/Page';
import { ProjectIcon } from '@/components/ProjectIcon';
import { THEMES, themeOf } from '@/lib/project-theme';

export const dynamic = 'force-dynamic';

type Led = { project_id: string | null; kind: string; amount_eur: string | null };
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
    supabase.from('v_ledger').select('project_id, kind, amount_eur').eq('year', year).neq('kind', 'transfer').eq('out_of_report', false).limit(50000).returns<Led[]>(),
    bud ? supabase.from('budget_items').select('project_id, amount_eur, category:categories(direction)').eq('budget_id', bud.id).returns<BI[]>() : Promise.resolve({ data: [] as BI[] }),
  ]);
  const agg = new Map<string, { out: number; inc: number; n: number; bOut: number; bIn: number }>();
  const A = (id: string) => { let a = agg.get(id); if (!a) { a = { out: 0, inc: 0, n: 0, bOut: 0, bIn: 0 }; agg.set(id, a); } return a; };
  for (const l of ledger ?? []) { if (!l.project_id) continue; const a = A(l.project_id); if (l.kind === 'expense') a.out += Number(l.amount_eur ?? 0); else a.inc += Number(l.amount_eur ?? 0); a.n += 1; }
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
        const tones = ['#3E5C8A', '#5B7DB1', '#8FB7E0', '#B9D3EE', '#DCE8F6'];
        const mix = shown.filter((p) => A(p.id).out > 0).map((p, i) => ({ p, v: A(p.id).out, c: p.kind === 'structure' ? '#C9D2DF' : tones[Math.min(i, tones.length - 1)] }));
        return (<>
          <div className="ptiles">
            <div className="pt t-b"><span className="pt-l"><CIcon name="wallet" size={16} />{L('Previsto', 'Prévu')}</span><b className="num">{e0(tot.b)}</b><small>{L(`uscite ${year}`, `dépenses ${year}`)}</small></div>
            <div className="pt t-s"><span className="pt-l"><CIcon name="chart" size={16} />{L('Speso', 'Dépensé')}</span><b className="num">{e0(tot.out)}</b>
              <small>{tot.b ? L(`${Math.round(used * 100)} % del previsto · anno ${Math.round(elapsed * 100)} %`, `${Math.round(used * 100)} % du prévu · année ${Math.round(elapsed * 100)} %`) : L('nessun preventivo', 'aucun budget')}</small></div>
            <div className={`pt t-r${over ? ' warn' : ''}`}><span className="pt-l"><CIcon name="calc" size={16} />{L('Residuo', 'Reste')}</span><b className="num">{tot.b ? e0(tot.b - tot.out) : '–'}</b>
              <small>{over ? L(`${over} oltre il preventivo`, `${over} au-delà du budget`) : L('tutti nei limiti', 'tous dans les limites')}</small></div>
            <div className="pt t-i"><span className="pt-l"><CIcon name="trend" size={16} />{L('Entrate', 'Recettes')}</span><b className="num">{e0(tot.inc)}</b>
              <small>{L(`${shown.length} progetti attivi`, `${shown.length} projets actifs`)}</small></div>
          </div>
          {mix.length > 1 && (
            <div className="pmix" aria-label={L('Dove vanno i fondi', 'Où vont les fonds')}>
              <span className="pmix-l">{L('Dove vanno i fondi', 'Où vont les fonds')}</span>
              <div className="pmix-b">{mix.map(({ p, v, c }) => <i key={p.id} title={`${p.name}: ${e0(v)}`} style={{ width: `${(v / tot.out) * 100}%`, background: c }} />)}</div>
              <ul className="pmix-k">{mix.map(({ p, v, c }) => <li key={p.id}><i style={{ background: c }} />{p.name} <b className="num">{Math.round((v / tot.out) * 100)} %</b></li>)}</ul>
            </div>
          )}
        </>);
      })()}
      {shown.length === 0 ? <Empty text={t('prj_none_year').replace('{y}', String(year))} /> : (
        <div className="pcards">
          {shown.map((p) => {
            const a = A(p.id), used = a.bOut ? a.out / a.bOut : 0, res = a.bOut - a.out, bal = a.inc - a.out;
            const alert = a.bOut && a.out > a.bOut ? { c: 'late', t: L(`oltre il preventivo di ${e0(a.out - a.bOut)}`, `au-delà du budget de ${e0(a.out - a.bOut)}`) }
              : a.bOut && used > elapsed + 0.15 ? { c: 'soon', t: L('spesa più veloce del previsto', 'dépense plus rapide que prévu') }
              : !a.bOut && a.out > 0 ? { c: 'mid', t: L('nessun preventivo', 'aucun budget') } : null;
            return (
              <Link key={p.id} className="pcard" href={`/progetti/${p.id}?anno=${year}`}>
                <div className="pc-h"><ProjectIcon p={p} />
                  <div className="pc-n"><b>{p.name}</b><small>{L(THEMES[themeOf(p)].it, THEMES[themeOf(p)].fr)} · {L(`${a.n} movimenti`, `${a.n} mouvements`)}{p.demo ? ' · DEMO' : ''}</small></div>
                  {alert && <span className={`cdp ${alert.c}`}>{alert.t}</span>}</div>
                <div className="pc-big"><span>{L('Uscite', 'Dépenses')}</span><b className="num">{e0(a.out)}</b>{a.bOut > 0 && <small>{L('su', 'sur')} {e0(a.bOut)} {L('previsti', 'prévus')}</small>}</div>
                {a.bOut > 0 ? (
                  <div className="pc-meter"><div className="meter" role="img" aria-label={`${Math.round(used * 100)} %`}>
                    <i style={{ width: `${Math.min(100, used * 100).toFixed(1)}%`, background: a.out > a.bOut ? 'var(--tax)' : undefined }} /><span className="mk" style={{ left: `${Math.min(99.5, elapsed * 100)}%` }} /></div>
                    <span className="num">{Math.round(used * 100)}{' '}%</span></div>
                ) : <div className="pc-meter none">{L('Senza preventivo per l\'anno', 'Sans budget pour l\'année')}</div>}
                <dl className="pc-f">
                  <div><dt>{L('Entrate', 'Recettes')}</dt><dd className="num">{e0(a.inc)}</dd></div>
                  <div><dt>{L('Saldo', 'Solde')}</dt><dd className={`num ${bal < 0 ? 'neg' : ''}`}>{e0(bal)}</dd></div>
                  <div><dt>{L('Residuo', 'Reste')}</dt><dd className={`num ${a.bOut && res < 0 ? 'neg' : ''}`}>{a.bOut ? e0(res) : '–'}</dd></div>
                </dl>
              </Link>
            );
          })}
        </div>
      )}
      {hidden > 0 && <p className="muted" style={{ margin: 0 }}><Link href={`/progetti?anno=${year}&tutti=1`}>{L(`Mostra anche ${hidden} progetti senza movimenti né preventivo nel ${year}`, `Afficher aussi ${hidden} projets sans mouvements ni budget en ${year}`)}</Link></p>}
    </div>
  );
}
