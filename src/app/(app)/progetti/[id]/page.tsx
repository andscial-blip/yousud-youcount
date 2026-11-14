import { nth } from '@/lib/palette';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can, requireMe, STAFF } from '@/lib/session';
import { date, money } from '@/lib/format';
import { Empty, PageHead, Panel } from '@/components/Page';
import { BudgetTable, type BudgetRow } from '@/components/Budget';
import { MonthBars, Viz } from '@/components/Charts';
import { DOC_TYPES } from '@/lib/doc-model';
import { ProjectIcon } from '@/components/ProjectIcon';

export const dynamic = 'force-dynamic';

const MESI_S = { it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'], fr: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'] } as const;
type Led = { month: number; kind: string; amount_eur: string | null; category_id: string | null };

// Cruscotto contabile del progetto nel disegno di Cairn (14/11): quattro riquadri con mini grafico (giallo = uscite, blu notte = entrate),
// andamento mensile, voci di spesa, preventivo e consuntivo, movimenti, documenti, scadenze e finanziamenti collegati.
export default async function ProjectDetail({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ anno?: string; ok?: string; err?: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.anno) || now.getFullYear();
  const { supabase, me, t, lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const { data: p } = await supabase.from('projects').select('id, name, kind, start_date, end_date, demo, theme').eq('id', id).maybeSingle();
  if (!p) notFound();
  const staff = can(me, STAFF);
  const [{ data: budget }, { data: moves, count: nMoves }, { data: grants }, { data: ledger }, { data: cats }, { data: docs }, { data: dls }] = await Promise.all([
    staff ? supabase.rpc('budget_vs_actual', { p_project: id, p_year: year, p_grant: null }) : Promise.resolve({ data: [] }),
    supabase.from('movements').select('id, ref, op_date, kind, description, amount, currency, sign, status, amount_eur', { count: 'exact' })
      .eq('project_id', id).gte('op_date', `${year}-01-01`).lte('op_date', `${year}-12-31`).order('op_date', { ascending: false }).limit(12),
    supabase.from('grants').select('id, title, code, status').eq('project_id', id).order('title'),
    supabase.from('v_ledger').select('month, kind, amount_eur, category_id').eq('project_id', id).eq('year', year).neq('kind', 'transfer').eq('out_of_report', false).limit(20000).returns<Led[]>(),
    supabase.from('categories').select('id, code, name_it, name_fr, group:category_groups(code, name_it, name_fr)'),
    supabase.from('issued_docs').select('id, type, number, status, doc_date, party_name').eq('project_id', id).order('doc_date', { ascending: false }).limit(8),
    supabase.from('deadlines').select('id, title, due_date, status').eq('project_id', id).eq('status', 'open').order('due_date').limit(6),
  ]);
  const months = Array.from({ length: 12 }, () => ({ inc: 0, out: 0 }));
  const grp = new Map(((cats ?? []) as unknown as { id: string; group: { code: string; name_it: string; name_fr: string | null } | null }[]).map((c) => [c.id, c.group]));
  const byG = new Map<string, number>();
  for (const l of ledger ?? []) {
    const v = Number(l.amount_eur ?? 0);
    if (l.kind === 'income') months[l.month - 1].inc += v;
    else { months[l.month - 1].out += v; const g = l.category_id ? grp.get(l.category_id) : null; const k = g ? (lang === 'fr' && g.name_fr ? g.name_fr : g.name_it) : L('Senza codice', 'Sans code'); byG.set(k, (byG.get(k) ?? 0) + v); }
  }
  const inc = months.reduce((a, m) => a + m.inc, 0), out = months.reduce((a, m) => a + m.out, 0);
  // preventivo delle uscite del progetto: gruppi di codici di spesa (quelli di entrata iniziano per E)
  const bOut = ((budget ?? []) as BudgetRow[]).filter((r) => !r.group_code.startsWith('E')).reduce((s, r) => s + Number(r.budget_eur ?? 0), 0);
  const elapsed = year < now.getFullYear() ? 1 : year > now.getFullYear() ? 0 : (now.getTime() - new Date(year, 0, 1).getTime()) / (new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime());
  const e0 = (v: number) => money(Math.round(v), 'EUR', lang).replace(/,00(?=\s?€)/, '');
  const used = bOut ? out / bOut : 0;
  const gparts = [...byG.entries()].sort((a, b) => b[1] - a[1]);
  const gtot = gparts.reduce((a, [, v]) => a + v, 0) || 1;
  const curM = year < now.getFullYear() ? 12 : year > now.getFullYear() ? 0 : now.getMonth() + 1;
  const pc = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}\u00a0%` : '–');
  const mTip = (title: string, f: (m: { inc: number; out: number }) => number) => `${title}\n${months.slice(0, Math.max(curM, 1)).map((m, k) => `${MESI_S[lang][k]}: ${e0(f(m))}`).join('\n')}`;
  return (
    <div className="stack prj prj-d">
      <PageHead title={`${p.name} · ${year}`} lead={<ProjectIcon p={p} size={34} />}>
        <div className="prj-act">
          <Link className="btn" href={`/movimenti?progetto=${id}&dal=${year}-01-01&al=${year}-12-31`}>{L('Tutti i movimenti', 'Tous les mouvements')}</Link>
          <Link className="btn" href={`/documenti-emessi/nuovo?progetto=${id}`}>{L('Emetti documento', 'Émettre un document')}</Link>
        </div>
      </PageHead>
      {sp.ok === 'budget' && <div className="note ok" role="status">{t('b_saved')}</div>}
      {sp.err && <div className="note err">{sp.err}</div>}
      <div className="kpis dk prk">
        <div className="kpi">
          <div className="l">{L('Preventivo uscite', 'Budget dépenses')}</div>
          <div className="v num">{bOut ? e0(bOut) : '–'}</div>
          {bOut > 0 && <><Viz.Stack segs={[{ v: Math.min(out, bOut), c: 'var(--vz-sp)' }, { v: Math.max(0, bOut - out), c: 'var(--band)' }, { v: Math.max(0, out - bOut), c: 'var(--tax)' }]} max={Math.max(bOut, out)}
            marks={year === now.getFullYear() ? [{ v: elapsed * bOut, c: 'var(--navy)', dash: true }] : undefined}
            tip={`${L('Previsto', 'Prévu')}: ${e0(bOut)}\n${L('Speso', 'Dépensé')}: ${e0(out)}\n${L('Anno trascorso', 'Année écoulée')}: ${Math.round(elapsed * 100)} %`} />
            <div className="vzl"><span>{L('usato', 'utilisé')}</span><span>{pc(out, bOut)}</span></div></>}
          <div className="s">{bOut ? L(`anno trascorso ${Math.round(elapsed * 100)} %`, `année écoulée ${Math.round(elapsed * 100)} %`) : L('nessun preventivo in vigore', 'aucun budget en vigueur')}</div>
        </div>
        <div className="kpi">
          <div className="l">{L('Uscite', 'Dépenses')}</div>
          <div className="v num">{e0(out)}</div>
          <Viz.Cols vals={months.map((m) => m.out)} colors={months.map((_, k) => (k < curM ? 'var(--vz-sp)' : 'var(--band)'))} tip={mTip(`${L('Uscite', 'Dépenses')} ${year}`, (m) => m.out)} />
          <div className="vzl"><span>{L('media al mese', 'moyenne par mois')}</span><span>{e0(out / Math.max(curM, 1))}</span></div>
          <div className="s">{(nMoves ?? 0) === 1 ? L('1 movimento nell\'anno', '1 mouvement dans l\'année') : L(`${nMoves ?? 0} movimenti nell'anno`, `${nMoves ?? 0} mouvements dans l'année`)}</div>
        </div>
        <div className="kpi">
          <div className="l">{L('Entrate', 'Recettes')}</div>
          <div className="v num">{e0(inc)}</div>
          <Viz.Cols vals={months.map((m) => m.inc)} colors={months.map((_, k) => (k < curM ? 'var(--navy)' : 'var(--band)'))} tip={mTip(`${L('Entrate', 'Recettes')} ${year}`, (m) => m.inc)} />
          <div className="vzl"><span>{L('saldo', 'solde')}</span><span>{e0(inc - out)}</span></div>
          <div className="s">{inc - out < -0.005 ? L('uscite superiori alle entrate', 'dépenses supérieures aux recettes') : L('entrate che coprono le uscite', 'recettes couvrant les dépenses')}</div>
        </div>
        <div className="kpi">
          {bOut > 0 && <Viz.Ring p={Math.min(used, 1)} color={out > bOut ? 'var(--tax)' : 'var(--vz-sp)'} tip={`${L('Usato', 'Utilisé')}: ${pc(out, bOut)}`} />}
          <div className="l">{L('Residuo', 'Reste')}</div>
          <div className={`v num ${bOut ? (bOut - out < 0 ? 'neg' : 'pos') : ''}`}>{bOut ? e0(bOut - out) : '–'}</div>
          {bOut > 0 && <><Viz.Stack segs={out > bOut ? [{ v: bOut, c: 'var(--band)' }, { v: out - bOut, c: 'var(--tax)' }] : [{ v: bOut - out, c: 'var(--green-soft)' }, { v: out, c: 'var(--band)' }]} max={Math.max(bOut, out)}
            tip={`${L('Previsto', 'Prévu')}: ${e0(bOut)}\n${L('Speso', 'Dépensé')}: ${e0(out)}`} />
            <div className="vzl"><span>{out > bOut ? L('oltre il preventivo', 'au-delà du budget') : L('ancora disponibile', 'encore disponible')}</span><span>{pc(Math.abs(bOut - out), bOut)}</span></div></>}
          <div className="s">{bOut ? L('preventivo meno speso', 'budget moins dépensé') : L('nessun preventivo in vigore', 'aucun budget en vigueur')}</div>
        </div>
      </div>
      <div className="grid">
        <Panel className="c8" title={L(`Andamento mensile ${year}`, `Évolution mensuelle ${year}`)}>
          <div className="panel-b"><MonthBars data={months} lang={lang} labels={{ in: L('Entrate', 'Recettes'), out: L('Uscite', 'Dépenses') }}
            hrefFor={(m) => `/movimenti?progetto=${id}&dal=${year}-${String(m).padStart(2, '0')}-01&al=${year}-${String(m).padStart(2, '0')}-${String(new Date(year, m, 0).getDate()).padStart(2, '0')}`} /></div>
        </Panel>
        <Panel className="c4" title={L('Voci di spesa', 'Postes de dépense')}>
          <div className="panel-b">{gparts.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t('none')}</p> : (
            <ul className="hcat pbars">{gparts.map(([n, v], gi) => (
              <li key={n}><span className="hc-n">{n}</span><b className="num">{e0(v)} <small>{Math.round((v / gtot) * 100)}{' '}%</small></b>
                <span className="hc-b"><i style={{ width: `${((v / gparts[0]![1]) * 100).toFixed(1)}%`, background: nth(gi) }} /></span></li>))}</ul>)}</div>
        </Panel>
      </div>
      {staff && (
        <Panel title={L('Preventivo e consuntivo per codice', 'Budget et réalisé par code')} pad
          right={<Link className="eyebrow" href={`/preventivo?anno=${year}&progetto=${id}#righe`}>{L('modifica nel Preventivo', 'modifier dans le Budget')} →</Link>}>
          {/* una sola fonte: il preventivo si modifica solo nella pagina Preventivo (versioni e delibera) */}
          <BudgetTable rows={(budget ?? []) as BudgetRow[]} t={t} lang={lang} />
        </Panel>
      )}
      <div className="grid">
        <Panel className="c6" title={t('prj_recent')} right={<Link className="eyebrow" href={`/movimenti?progetto=${id}&dal=${year}-01-01&al=${year}-12-31`}>{L('tutti', 'tous')} →</Link>}>
          {(moves ?? []).length === 0 ? <Empty text={t('none')} /> : (
            <table className="t keep recent"><tbody>
              {moves!.map((m) => {
                const sg = m.sign * (m.kind === 'income' ? 1 : -1);
                const eur = m.currency !== 'EUR' && m.amount_eur ? Number(m.amount_eur) * sg : null;
                return (
                  <tr key={m.id}>
                    <td><Link className="rowlink" href={`/movimenti/${m.id}`}>{m.description || t(`k_${m.kind as 'income'}`)}</Link>
                      <small className="muted num rc-d">{date(m.op_date)}</small></td>
                    <td className="r num nw"><span className="two"><b>{eur != null ? money(eur, 'EUR', lang) : money(Number(m.amount) * sg, m.currency, lang)}</b>
                      {eur != null && <small>{money(Number(m.amount) * sg, m.currency, lang)}</small>}</span></td>
                  </tr>
                );
              })}
            </tbody></table>
          )}
        </Panel>
        <div className="c6 stack">
          <Panel title={L('Scadenze', 'Échéances')}>
            {(dls ?? []).length === 0 ? <p className="panel-b muted" style={{ margin: 0 }}>{L('Nessuna scadenza aperta.', 'Aucune échéance ouverte.')}</p> : (
              <ul className="acclist">{dls!.map((d) => <li key={d.id}><span className={`cdp ${d.due_date < now.toISOString().slice(0, 10) ? 'late' : 'mid'}`}>{date(d.due_date)}</span><span className="an">{d.title}</span><span /></li>)}</ul>)}
          </Panel>
          <Panel title={L('Documenti emessi', 'Documents émis')}>
            {(docs ?? []).length === 0 ? <p className="panel-b muted" style={{ margin: 0 }}>{L('Nessun documento.', 'Aucun document.')}</p> : (
              <ul className="acclist">{docs!.map((d) => <li key={d.id}><span className="muted num">{date(d.doc_date)}</span>
                <Link className="an" href={`/documenti-emessi/${d.id}`}>{d.number ?? L('Bozza', 'Brouillon')} · {L(DOC_TYPES[d.type as keyof typeof DOC_TYPES]?.it ?? d.type, DOC_TYPES[d.type as keyof typeof DOC_TYPES]?.fr ?? d.type)}</Link><span className="muted">{d.party_name}</span></li>)}</ul>)}
          </Panel>
          <Panel title={t('prj_grants')}>
            {(grants ?? []).length === 0 ? <p className="panel-b muted" style={{ margin: 0 }}>{t('none')}</p> : (
              <ul className="acclist">{grants!.map((g) => <li key={g.id}><span className={`chip ${g.status === 'active' ? 'ok' : ''}`}>{g.status === 'active' ? t('g_active') : t('g_closed')}</span>
                <Link className="an" href={`/finanziamenti/${g.id}`}>{g.title}</Link><span className="muted">{g.code}</span></li>)}</ul>)}
          </Panel>
        </div>
      </div>
    </div>
  );
}
