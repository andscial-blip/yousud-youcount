import Link from 'next/link';
import { ADMIN, RESP, STAFF, can, requireMe } from '@/lib/session';
import { date, dateTime, money } from '@/lib/format';
import { Denied, Empty, ErrorNote, PageHead, Panel } from '@/components/Page';
import { BudgetBar } from '@/components/Charts';
import { approveBudget, deleteItem, discardBudget, draftBudget, saveItem } from './actions';

export const dynamic = 'force-dynamic';

type Budget = { id: string; year: number; version: number; status: 'draft' | 'approved' | 'superseded'; title: string | null;
  approval_ref: string | null; approved_at: string | null; created_at: string; based_on: string | null };
type Item = { id: string; project_id: string | null; category_id: string; description: string | null; qty: string; unit: string | null;
  unit_cost: string; currency: string; fx_rate: string | null; amount: string; amount_eur: string; notes: string | null };
type Cmp = { direction: 'in' | 'out'; group_id: string; group_code: string; category_id: string; category_code: string; cat_it: string;
  cat_fr: string; project_id: string | null; project_name: string | null; budget_eur: string; actual_eur: string; committed_eur: string; movements: number };
type Cat = { id: string; code: string; name_it: string; name_fr: string; direction: 'in' | 'out'; active: boolean };
type Grp = { id: string; code: string; name_it: string; name_fr: string; direction: 'in' | 'out'; sort: number };

const NEAR = 0.9;   // avviso quando l'eseguito arriva al 90% della voce

// Preventivo annuale: versioni (originale e revisioni), righe per codice e progetto, confronto con il consuntivo.
// Il preventivo è solo annuale: niente ripartizione mensile (non si sa in che mese avverranno le spese).
export default async function BudgetPage({ searchParams }: {
  searchParams: Promise<{ anno?: string; v?: string; vista?: string; progetto?: string; edit?: string; ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const year = Number(sp.anno) || new Date().getFullYear();
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, STAFF)) return <Denied text={t('only_staff')} />;
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const resp = can(me, RESP), admin = can(me, ADMIN);
  const { data: versions } = await supabase.from('budgets')
    .select('id, year, version, status, title, approval_ref, approved_at, created_at, based_on').eq('year', year).order('version').returns<Budget[]>();
  const vs = versions ?? [];
  const approved = vs.find((b) => b.status === 'approved') ?? null;
  const draft = vs.find((b) => b.status === 'draft') ?? null;
  const shown = vs.find((b) => b.id === sp.v) ?? draft ?? approved ?? vs[vs.length - 1] ?? null;
  const view = sp.vista === 'righe' || (!approved && shown?.status === 'draft') ? 'righe' : 'confronto';
  const prj = /^[0-9a-f-]{36}$/.test(sp.progetto ?? '') ? sp.progetto! : '';

  const [{ data: items }, { data: cmp, error }, { data: cats }, { data: groups }, { data: projects }, { data: rate }, { data: prev }] = await Promise.all([
    shown ? supabase.from('budget_items').select('id, project_id, category_id, description, qty, unit, unit_cost, currency, fx_rate, amount, amount_eur, notes')
      .eq('budget_id', shown.id).order('sort').order('id').returns<Item[]>() : Promise.resolve({ data: [] as Item[] }),
    supabase.rpc('budget_compare', { p_year: year, p_budget: shown && shown.status !== 'approved' ? shown.id : null }),
    supabase.from('categories').select('id, code, name_it, name_fr, direction, active').order('direction', { ascending: false }).order('sort').returns<Cat[]>(),
    supabase.from('category_groups').select('id, code, name_it, name_fr, direction, sort').order('sort').returns<Grp[]>(),
    supabase.from('projects').select('id, name, active').order('name'),
    supabase.rpc('fx_rate_for', { p_date: `${year}-01-01` }),
    supabase.from('budgets').select('id').eq('year', year - 1).limit(1),
  ]);
  const rows = (cmp ?? []) as Cmp[];
  const its = items ?? [];
  const catBy = new Map((cats ?? []).map((c) => [c.id, c]));
  const prjBy = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const CL = (c: { name_it: string; name_fr: string }) => (lang === 'fr' && c.name_fr ? c.name_fr : c.name_it);
  const m = (v: number | string) => money(v, 'EUR', lang);

  const fr = rows.filter((r) => !prj || r.project_id === prj);
  const sum = (d: 'in' | 'out', k: 'budget_eur' | 'actual_eur' | 'committed_eur') => fr.filter((r) => r.direction === d).reduce((s, r) => s + Number(r[k]), 0);
  const inB = sum('in', 'budget_eur'), outB = sum('out', 'budget_eur'), inA = sum('in', 'actual_eur'), outA = sum('out', 'actual_eur'), outC = sum('out', 'committed_eur');
  // voci di uscita aggregate per codice (sui progetti filtrati): base degli avvisi
  const byCode = new Map<string, { b: number; a: number; c: number; r: Cmp }>();
  for (const r of fr.filter((x) => x.direction === 'out')) {
    const k = r.category_id, x = byCode.get(k) ?? { b: 0, a: 0, c: 0, r };
    x.b += Number(r.budget_eur); x.a += Number(r.actual_eur); x.c += Number(r.committed_eur); byCode.set(k, x);
  }
  const over = [...byCode.values()].filter((x) => x.a > x.b + 0.005);
  const near = [...byCode.values()].filter((x) => x.b > 0 && x.a <= x.b && x.a + x.c >= x.b * NEAR);
  const status = (b: number, a: number, c: number) =>
    a > b + 0.005 ? <span className="chip bad">{b > 0 ? L('Oltre il preventivo', 'Au-delà du budget') : L('Non prevista', 'Non prévue')}</span>
      : b > 0 && a + c >= b * NEAR ? <span className="chip warn">{L('Vicino al limite', 'Proche de la limite')}</span>
        : b > 0 ? <span className="chip ok">{L('In linea', 'Conforme')}</span> : null;
  const errText = sp.err ? (sp.err === 'missing' ? L('Compila codice e costo unitario.', 'Remplissez code et coût unitaire.') : sp.err) : null;
  const href = (q: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams({ anno: String(year) });
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') u.set(k, String(v));
    return `/preventivo?${u}`;
  };
  const vLabel = (b: Budget) => `${b.version === 1 ? L('Originale', 'Initial') : `${L('Revisione', 'Révision')} ${b.version - 1}`}`;
  const stLabel = (s: Budget['status']) => (s === 'draft' ? L('Bozza', 'Brouillon') : s === 'approved' ? L('In vigore', 'En vigueur') : L('Superata', 'Remplacée'));
  const editing = shown?.status === 'draft' && resp;
  const edit = its.find((i) => i.id === sp.edit);

  // tabella del confronto: entrate e uscite, gruppo → codice, con l'eventuale progetto
  const section = (d: 'in' | 'out') => {
    const list = fr.filter((r) => r.direction === d);
    const gs = (groups ?? []).filter((g) => g.direction === d && list.some((r) => r.group_id === g.id));
    return gs.map((g) => {
      const gr = list.filter((r) => r.group_id === g.id);
      const gb = gr.reduce((s, r) => s + Number(r.budget_eur), 0), ga = gr.reduce((s, r) => s + Number(r.actual_eur), 0);
      const gc = gr.reduce((s, r) => s + Number(r.committed_eur), 0);
      return (
        <tbody key={g.id}>
          <tr className="grp">
            <th scope="rowgroup" colSpan={2}>{g.code} · {CL(g)}</th>
            <td className="r num"><b>{m(gb)}</b></td><td className="r num"><b>{m(ga)}</b></td>
            <td className="r num hm">{d === 'out' ? m(gc) : ''}</td><td className="r num"><b>{m(gb - ga)}</b></td>
            <td className="hm">{gb > 0 ? `${Math.round((ga / gb) * 100)}%` : ''}</td><td />
          </tr>
          {gr.map((r) => {
            const b = Number(r.budget_eur), a = Number(r.actual_eur), c = Number(r.committed_eur);
            return (
              <tr key={`${r.category_id}-${r.project_id}`}>
                <td className="nw">{r.category_code}</td>
                <td>{lang === 'fr' && r.cat_fr ? r.cat_fr : r.cat_it}{r.project_name && <span className="muted"> · {r.project_name}</span>}</td>
                <td className="r num">{m(b)}</td>
                <td className="r num">{r.movements > 0
                  ? <Link href={`/movimenti?dal=${year}-01-01&al=${year}-12-31&codice=${r.category_id}${r.project_id ? `&progetto=${r.project_id}` : ''}`}>{m(a)}</Link> : m(a)}</td>
                <td className="r num hm">{d === 'out' && c ? m(c) : ''}</td>
                <td className={`r num ${b - a < 0 ? 'neg' : ''}`}>{m(b - a)}</td>
                <td className="hm">{d === 'out' && <BudgetBar budget={b} spent={a + c} />}</td>
                <td>{d === 'out' && status(b, a, c)}</td>
              </tr>
            );
          })}
        </tbody>
      );
    });
  };

  return (
    <div className="stack">
      <PageHead title={`${L('Preventivo', 'Budget')} ${year}`}>
        <div className="seg" role="group" aria-label={L('Anno', 'Année')}>
          <Link href={`/preventivo?anno=${year - 1}`} aria-label={String(year - 1)}>← {year - 1}</Link>
          <Link href={`/preventivo?anno=${year + 1}`} aria-label={String(year + 1)}>{year + 1} →</Link>
        </div>
      </PageHead>
      {sp.ok && <div className="note ok" role="status">{L('Salvato.', 'Enregistré.')}</div>}
      {errText && <div className="note err">{errText}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />

      {vs.length === 0 ? (
        <Panel pad title={L('Nessun preventivo per quest\'anno', 'Aucun budget pour cette année')}>
          <p className="muted" style={{ marginTop: 0 }}>{L(
            'Il preventivo si costruisce per righe: codice contabile, progetto, quantità per costo unitario, in euro o in ariary. Si approva con gli estremi della delibera; dopo l\'approvazione si cambia solo con una revisione, e le versioni precedenti restano consultabili.',
            'Le budget se construit par lignes : code comptable, projet, quantité × coût unitaire, en euros ou en ariary. Il s\'approuve avec la référence de la délibération ; ensuite il ne change que par une révision, et les versions précédentes restent consultables.')}</p>
          {resp && (
            <div className="row-actions">
              <form action={draftBudget}><input type="hidden" name="year" value={year} />
                <button className="btn primary" type="submit">{L('Nuovo preventivo vuoto', 'Nouveau budget vide')}</button></form>
              {(prev ?? []).length > 0 && (
                <form action={draftBudget}><input type="hidden" name="year" value={year} /><input type="hidden" name="from" value={year - 1} />
                  <button className="btn" type="submit">{L(`Copia dal ${year - 1}`, `Copier de ${year - 1}`)}</button></form>
              )}
            </div>
          )}
        </Panel>
      ) : (
        <>
          <section className="panel">
            <div className="panel-h"><h2>{L('Versioni', 'Versions')}</h2></div>
            <ol className="versions">
              {vs.map((b) => (
                <li key={b.id} aria-current={b.id === shown?.id ? 'true' : undefined}>
                  <Link href={href({ v: b.id })}>
                    <b>{vLabel(b)}</b>{b.title ? ` · ${b.title}` : ''}
                    <span className={`chip ${b.status === 'approved' ? 'ok' : b.status === 'draft' ? 'warn' : ''}`}>{stLabel(b.status)}</span>
                  </Link>
                  <span className="muted">{b.approved_at ? `${L('Approvato il', 'Approuvé le')} ${dateTime(b.approved_at, lang)} · ${b.approval_ref}` : `${L('Creato il', 'Créé le')} ${date(b.created_at)}`}</span>
                </li>
              ))}
            </ol>
            {resp && (
              <div className="panel-b row-actions">
                {!draft && approved && (
                  <form action={draftBudget}><input type="hidden" name="year" value={year} />
                    <button className="btn" type="submit">{L('Crea una revisione', 'Créer une révision')}</button></form>
                )}
                {draft && admin && (
                  <form action={approveBudget} className="inline-form">
                    <input type="hidden" name="year" value={year} /><input type="hidden" name="id" value={draft.id} />
                    <label className="vh" htmlFor="apref">{L('Delibera di approvazione', 'Délibération d\'approbation')}</label>
                    <input className="input" id="apref" name="ref" required minLength={3} maxLength={300}
                           placeholder={L('Es. delibera CdA del 15/01', 'Ex. délibération du CA du 15/01')} />
                    <button className="btn primary" type="submit">{L(`Approva ${vLabel(draft).toLowerCase()}`, `Approuver ${vLabel(draft).toLowerCase()}`)}</button>
                  </form>
                )}
                {draft && (
                  <form action={discardBudget}><input type="hidden" name="year" value={year} /><input type="hidden" name="id" value={draft.id} />
                    <button className="btn danger" type="submit">{L('Elimina la bozza', 'Supprimer le brouillon')}</button></form>
                )}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="figs">
              <div><span>{L('Entrate previste', 'Recettes prévues')}</span><b className="num">{m(inB)}</b><small>{L('incassate', 'encaissées')} {m(inA)}</small></div>
              <div><span>{L('Uscite previste', 'Dépenses prévues')}</span><b className="num">{m(outB)}</b><small>{L('eseguite', 'réalisées')} {m(outA)}{outB > 0 ? ` · ${Math.round((outA / outB) * 100)}%` : ''}{outC > 0 ? ` · ${L('impegnate', 'engagées')} ${m(outC)}` : ''}</small></div>
              <div className={inB - outB < 0 ? 'bad' : ''}><span>{L('Saldo previsto', 'Solde prévu')}</span><b className="num">{m(inB - outB)}</b>
                <small>{inB - outB < 0 ? L('disavanzo da coprire', 'déficit à couvrir') : L('avanzo', 'excédent')}</small></div>
              <div className={over.length ? 'bad' : ''}><span>{L('Codici oltre il preventivo', 'Codes au-delà du budget')}</span><b className="num">{over.length}</b>
                <small>{near.length} {L('vicini al limite', 'proches de la limite')}</small></div>
            </div>
          </section>

          <div className="segs" role="tablist" aria-label={L('Vista', 'Vue')}>
            <Link role="tab" aria-selected={view === 'confronto'} href={href({ v: shown?.id, vista: 'confronto', progetto: prj })}>{L('Preventivo e consuntivo', 'Budget et réalisé')}</Link>
            <Link role="tab" aria-selected={view === 'righe'} href={href({ v: shown?.id, vista: 'righe' })}>{L('Righe del preventivo', 'Lignes du budget')} · {its.length}</Link>
            <a href={`/api/v1/export/budget?anno=${year}${shown ? `&v=${shown.id}` : ''}`}>{L('Excel', 'Excel')}</a>
          </div>

          {view === 'confronto' ? (
            <Panel title={`${L('Confronto', 'Comparaison')} · ${shown ? `${vLabel(shown)} (${stLabel(shown.status).toLowerCase()})` : ''}`}>
              <form className="filters panel-b" method="get" action="/preventivo">
                <input type="hidden" name="anno" value={year} />{shown && <input type="hidden" name="v" value={shown.id} />}
                <label className="vh" htmlFor="bprj">{L('Progetto', 'Projet')}</label>
                <select className="input" id="bprj" name="progetto" defaultValue={prj}>
                  <option value="">{L('Tutti i progetti', 'Tous les projets')}</option>
                  {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="btn" type="submit">{L('Filtra', 'Filtrer')}</button>
              </form>
              {(over.length > 0 || near.length > 0) && (
                <div className="panel-b alerts">
                  {over.map((x) => <div key={x.r.category_id} className="note err">{x.r.category_code} {lang === 'fr' && x.r.cat_fr ? x.r.cat_fr : x.r.cat_it}: {L('eseguito', 'réalisé')} {m(x.a)} {L('su', 'sur')} {m(x.b)} {L('previsti', 'prévus')} ({x.b > 0 ? `+${m(x.a - x.b)}` : L('voce non prevista', 'poste non prévu')})</div>)}
                  {near.map((x) => <div key={x.r.category_id} className="note">{x.r.category_code} {lang === 'fr' && x.r.cat_fr ? x.r.cat_fr : x.r.cat_it}: {Math.round(((x.a + x.c) / x.b) * 100)}% {L('del previsto, impegni compresi', 'du prévu, engagements compris')}</div>)}
                </div>
              )}
              {fr.length === 0 ? <Empty text={L('Nessuna voce.', 'Aucun poste.')} /> : (
                <div className="tscroll">
                  <table className="t keep cmp">
                    <thead><tr>
                      <th>{L('Codice', 'Code')}</th><th>{L('Voce', 'Poste')}</th><th className="r">{L('Preventivo', 'Budget')}</th>
                      <th className="r">{L('Consuntivo', 'Réalisé')}</th><th className="r hm">{L('Impegnato', 'Engagé')}</th>
                      <th className="r">{L('Residuo', 'Reste')}</th><th className="hm" /><th />
                    </tr></thead>
                    <tbody><tr className="sec"><th colSpan={8} scope="rowgroup">{L('Entrate', 'Recettes')}</th></tr></tbody>
                    {section('in')}
                    <tbody><tr className="sec"><th colSpan={8} scope="rowgroup">{L('Uscite', 'Dépenses')}</th></tr></tbody>
                    {section('out')}
                  </table>
                </div>
              )}
              <p className="hint panel-b" style={{ margin: 0 }}>{L(
                'Consuntivo: movimenti registrati e verificati dell\'anno, in euro al cambio del movimento. Impegnato: spese ancora in bozza (rimborsi da pagare, spese da completare).',
                'Réalisé : mouvements enregistrés et vérifiés de l\'année, en euros au taux du mouvement. Engagé : dépenses encore en brouillon (remboursements à payer, dépenses à compléter).')}</p>
            </Panel>
          ) : (
            <Panel title={`${L('Righe', 'Lignes')} · ${shown ? vLabel(shown) : ''}`}>
              {!editing && shown?.status !== 'draft' && <div className="panel-b note">{L(
                'Questa versione è approvata o superata e non si modifica: per cambiare il preventivo crea una revisione.',
                'Cette version est approuvée ou remplacée et ne se modifie pas : pour changer le budget, créez une révision.')}</div>}
              {its.length === 0 ? <Empty text={L('Ancora nessuna riga.', 'Aucune ligne pour l\'instant.')} /> : (
                <div className="tscroll">
                  <table className="t">
                    <thead><tr>
                      <th>{L('Codice', 'Code')}</th><th>{L('Progetto', 'Projet')}</th><th>{L('Descrizione', 'Description')}</th>
                      <th className="r">{L('Quantità × costo', 'Quantité × coût')}</th><th className="r">{L('Importo', 'Montant')}</th><th className="r">EUR</th>{editing && <th />}
                    </tr></thead>
                    <tbody>
                      {its.map((i) => {
                        const c = catBy.get(i.category_id);
                        return (
                          <tr key={i.id} className={i.id === sp.edit ? 'sel' : ''}>
                            <td className="nw">{c ? `${c.code}` : ''} <span className={`chip ${c?.direction === 'in' ? 'ok' : ''}`}>{c?.direction === 'in' ? L('entrata', 'recette') : L('uscita', 'dépense')}</span></td>
                            <td>{i.project_id ? prjBy.get(i.project_id) : <span className="muted">{L('Generale', 'Général')}</span>}</td>
                            <td>{i.description || (c ? CL(c) : '')}</td>
                            <td className="r num nw">{Number(i.qty).toLocaleString(lang === 'fr' ? 'fr-FR' : 'it-IT')}{i.unit ? ` ${i.unit}` : ''} × {money(i.unit_cost, i.currency, lang)}</td>
                            <td className="r num">{money(i.amount, i.currency, lang)}</td>
                            <td className="r num">{m(i.amount_eur)}</td>
                            {editing && (
                              <td className="nw r">
                                <Link className="btn small" href={href({ v: shown!.id, vista: 'righe', edit: i.id })}>{L('Modifica', 'Modifier')}</Link>{' '}
                                <form action={deleteItem} style={{ display: 'inline' }}>
                                  <input type="hidden" name="year" value={year} /><input type="hidden" name="id" value={i.id} />
                                  <button className="btn small danger" type="submit" aria-label={L('Elimina riga', 'Supprimer la ligne')}>×</button>
                                </form>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {editing && shown && (
                <form action={saveItem} className="fgrid panel-b" key={edit?.id ?? 'new'}>
                  <input type="hidden" name="year" value={year} /><input type="hidden" name="budget_id" value={shown.id} />
                  {edit && <input type="hidden" name="id" value={edit.id} />}
                  <h3 className="span2" style={{ margin: 0 }}>{edit ? L('Modifica la riga', 'Modifier la ligne') : L('Nuova riga', 'Nouvelle ligne')}</h3>
                  <div className="field"><label htmlFor="bi-cat">{L('Codice contabile', 'Code comptable')}</label>
                    <select className="input" id="bi-cat" name="category_id" required defaultValue={edit?.category_id ?? ''}>
                      <option value="">{L('Scegli…', 'Choisir…')}</option>
                      {(['out', 'in'] as const).map((d) => (
                        <optgroup key={d} label={d === 'out' ? L('Uscite', 'Dépenses') : L('Entrate', 'Recettes')}>
                          {(cats ?? []).filter((c) => c.direction === d && (c.active || c.id === edit?.category_id)).map((c) => <option key={c.id} value={c.id}>{c.code} · {CL(c)}</option>)}
                        </optgroup>
                      ))}
                    </select></div>
                  <div className="field"><label htmlFor="bi-prj">{L('Progetto', 'Projet')}</label>
                    <select className="input" id="bi-prj" name="project_id" defaultValue={edit?.project_id ?? ''}>
                      <option value="">{L('Generale (struttura)', 'Général (structure)')}</option>
                      {(projects ?? []).filter((p) => p.active || p.id === edit?.project_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select></div>
                  <div className="field span2"><label htmlFor="bi-desc">{L('Descrizione', 'Description')}</label>
                    <input className="input" id="bi-desc" name="description" maxLength={300} defaultValue={edit?.description ?? ''} /></div>
                  <div className="field"><label htmlFor="bi-qty">{L('Quantità', 'Quantité')}</label>
                    <input className="input num" id="bi-qty" name="qty" inputMode="decimal" defaultValue={edit ? String(Number(edit.qty)).replace('.', ',') : '1'} /></div>
                  <div className="field"><label htmlFor="bi-unit">{L('Unità (es. mesi, persone)', 'Unité (ex. mois, personnes)')}</label>
                    <input className="input" id="bi-unit" name="unit" maxLength={30} defaultValue={edit?.unit ?? ''} /></div>
                  <div className="field"><label htmlFor="bi-cost">{L('Costo unitario', 'Coût unitaire')}</label>
                    <input className="input num" id="bi-cost" name="unit_cost" inputMode="decimal" required defaultValue={edit ? String(Number(edit.unit_cost)).replace('.', ',') : ''} /></div>
                  <div className="field"><label htmlFor="bi-cur">{L('Valuta', 'Devise')}</label>
                    <select className="input" id="bi-cur" name="currency" defaultValue={edit?.currency ?? 'EUR'}><option>EUR</option><option>MGA</option></select></div>
                  <div className="field"><label htmlFor="bi-rate">{L('Tasso MGA per 1 EUR (solo ariary)', 'Taux MGA pour 1 EUR (ariary seulement)')}</label>
                    <input className="input num" id="bi-rate" name="fx_rate" inputMode="decimal" defaultValue={edit?.fx_rate ? String(Number(edit.fx_rate)).replace('.', ',') : rate ? String(rate) : ''} /></div>
                  <div className="field"><label htmlFor="bi-notes">{L('Note', 'Notes')}</label>
                    <input className="input" id="bi-notes" name="notes" maxLength={500} defaultValue={edit?.notes ?? ''} /></div>
                  <div className="span2 row-actions">
                    <button className="btn primary" type="submit">{edit ? L('Salva la riga', 'Enregistrer la ligne') : L('Aggiungi la riga', 'Ajouter la ligne')}</button>
                    {edit && <Link className="btn ghost" href={href({ v: shown.id, vista: 'righe' })}>{L('Annulla', 'Annuler')}</Link>}
                  </div>
                </form>
              )}
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
