import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can, requireMe, RESP, STAFF } from '@/lib/session';
import { date, money } from '@/lib/format';
import { Empty, Help, PageHead, Panel } from '@/components/Page';
import { BudgetTable, type BudgetRow } from '@/components/Budget';
import { MonthBars } from '@/components/Charts';
import { DOC_TYPES } from '@/lib/doc-model';

export const dynamic = 'force-dynamic';

type Led = { month: number; kind: string; amount_eur: string | null; category_id: string | null };

// Cruscotto contabile del progetto: preventivo e consuntivo, saldo, residuo, andamento mensile, voci di spesa,
// movimenti, documenti, scadenze e finanziamenti collegati.
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
  const { data: p } = await supabase.from('projects').select('id, name, kind, start_date, end_date, demo').eq('id', id).maybeSingle();
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
  const back = `/progetti/${id}?anno=${year}`;
  return (
    <div className="stack">
      <PageHead title={`${p.name} · ${year}`} lead={<Link className="btn ghost small" href={`/progetti?anno=${year}`}>← {t('nav_projects')}</Link>}>
        <Link className="btn" href={`/movimenti?progetto=${id}&dal=${year}-01-01&al=${year}-12-31`}>{L('Tutti i movimenti', 'Tous les mouvements')}</Link>
        <Link className="btn" href={`/documenti-emessi/nuovo?progetto=${id}`}>{L('Emetti documento', 'Émettre un document')}</Link>
      </PageHead>
      {sp.ok === 'budget' && <div className="note ok" role="status">{t('b_saved')}</div>}
      {sp.err && <div className="note err">{sp.err}</div>}
      <div className="kpis">
        <div className="kpi"><div className="l">{L('Preventivo uscite', 'Budget dépenses')}</div><div className="v num">{bOut ? e0(bOut) : '–'}</div>
          <div className="s">{bOut ? L(`usato ${Math.round(used * 100)} % · anno trascorso ${Math.round(elapsed * 100)} %`, `utilisé ${Math.round(used * 100)} % · année écoulée ${Math.round(elapsed * 100)} %`) : L('nessun preventivo approvato', 'aucun budget approuvé')}</div>
          {bOut > 0 && <div className="meter" style={{ marginTop: 8 }}><i style={{ width: `${Math.min(100, used * 100).toFixed(1)}%`, background: out > bOut ? 'var(--tax)' : undefined }} /><span className="mk" style={{ left: `${Math.min(99.5, elapsed * 100)}%` }} /></div>}</div>
        <div className="kpi"><div className="l">{L('Uscite', 'Dépenses')}</div><div className="v num">{e0(out)}</div><div className="s">{L(`${nMoves ?? 0} movimenti nell'anno`, `${nMoves ?? 0} mouvements dans l'année`)}</div></div>
        <div className="kpi"><div className="l">{L('Entrate', 'Recettes')}</div><div className="v num">{e0(inc)}</div><div className="s">{L('Saldo', 'Solde')} <b className={inc - out < 0 ? 'neg' : 'pos'}>{e0(inc - out)}</b></div></div>
        <div className="kpi"><div className="l">{L('Residuo', 'Reste')}</div><div className={`v num ${bOut && bOut - out < 0 ? 'neg' : ''}`}>{bOut ? e0(bOut - out) : '–'}</div>
          <div className="s">{bOut ? (out > bOut ? L('oltre il preventivo', 'au-delà du budget') : L('ancora disponibile', 'encore disponible')) : ''}</div></div>
      </div>
      <div className="grid">
        <Panel className="c8" title={L(`Andamento mensile ${year}`, `Évolution mensuelle ${year}`)}>
          <div className="panel-b"><MonthBars data={months} lang={lang} labels={{ in: L('Entrate', 'Recettes'), out: L('Uscite', 'Dépenses') }}
            hrefFor={(m) => `/movimenti?progetto=${id}&dal=${year}-${String(m).padStart(2, '0')}-01&al=${year}-${String(m).padStart(2, '0')}-${String(new Date(year, m, 0).getDate()).padStart(2, '0')}`} /></div>
        </Panel>
        <Panel className="c4" title={L('Voci di spesa', 'Postes de dépense')}>
          <div className="panel-b">{gparts.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t('none')}</p> : (
            <ul className="hcat pbars">{gparts.map(([n, v]) => (
              <li key={n}><span className="hc-n">{n}</span><b className="num">{e0(v)} <small>{Math.round((v / gtot) * 100)}{' '}%</small></b>
                <span className="hc-b"><i style={{ width: `${((v / gparts[0]![1]) * 100).toFixed(1)}%`, background: 'var(--amber-soft)' }} /></span></li>))}</ul>)}</div>
        </Panel>
      </div>
      {staff && (
        <Panel title={L('Preventivo e consuntivo per codice', 'Budget et réalisé par code')} pad>
          <BudgetTable rows={(budget ?? []) as BudgetRow[]} t={t} lang={lang} edit={can(me, RESP) ? { scope: 'project', id, year, back } : undefined} />
        </Panel>
      )}
      <div className="grid">
        <Panel className="c6" title={t('prj_recent')} right={<Link className="eyebrow" href={`/movimenti?progetto=${id}&dal=${year}-01-01&al=${year}-12-31`}>{L('tutti', 'tous')} →</Link>}>
          {(moves ?? []).length === 0 ? <Empty text={t('none')} /> : (
            <table className="t keep"><tbody>
              {moves!.map((m) => (
                <tr key={m.id}>
                  <td className="num nw">{date(m.op_date)}</td>
                  <td><Link className="rowlink" href={`/movimenti/${m.id}`}>{m.description || t(`k_${m.kind as 'income'}`)}</Link></td>
                  <td className="r num nw"><span className="two"><b>{money(Number(m.amount) * m.sign * (m.kind === 'income' ? 1 : -1), m.currency, lang)}</b>
                    {m.currency !== 'EUR' && m.amount_eur && <small>{money(Number(m.amount_eur), 'EUR', lang)}</small>}</span></td>
                </tr>
              ))}
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
      <Help summary={L('Come si calcolano questi numeri', 'Comment ces chiffres sont calculés')}>
        <p>{L('Uscite ed entrate: movimenti registrati e verificati del progetto nell\'anno, in euro al tasso salvato su ciascun movimento. Preventivo: righe del preventivo approvato dell\'anno assegnate al progetto. Residuo = preventivo − uscite. La tacca sulla barra è la parte dell\'anno già trascorsa.',
          'Dépenses et recettes : mouvements enregistrés et vérifiés du projet dans l\'année, en euros au taux enregistré sur chaque mouvement. Budget : lignes du budget approuvé de l\'année affectées au projet. Reste = budget − dépenses. Le repère sur la barre est la part de l\'année écoulée.')}</p>
      </Help>
    </div>
  );
}
