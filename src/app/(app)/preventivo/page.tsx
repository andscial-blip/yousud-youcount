import Link from 'next/link';
import { FilterBar } from '@/components/FilterBar';
import { CIcon } from '@/components/CIcon';
import { Ico } from '@/components/Ui';
import { ADMIN, RESP, STAFF, can, requireMe } from '@/lib/session';
import { date, dateTime, money, num } from '@/lib/format';
import { Denied, Empty, ErrorNote, PageHead, Panel } from '@/components/Page';
import { BudgetGrid, type GCell, type GCol, type GGroup, type GRow } from '@/components/BudgetGrid';
import { deleteBudget, approveBudget, deleteItem, discardBudget, draftBudget, saveItem } from './actions';

export const dynamic = 'force-dynamic';

type Budget = { id: string; year: number; version: number; status: 'draft' | 'approved' | 'superseded'; title: string | null;
  approval_ref: string | null; approved_at: string | null; created_at: string; based_on: string | null; demo?: boolean };
type Item = { id: string; project_id: string | null; category_id: string; description: string | null; qty: string; unit: string | null;
  unit_cost: string; currency: string; fx_rate: string | null; amount: string; amount_eur: string; notes: string | null };
type Cmp = { direction: 'in' | 'out'; group_id: string; group_code: string; category_id: string; category_code: string; cat_it: string;
  cat_fr: string; project_id: string | null; project_name: string | null; budget_eur: string; actual_eur: string; committed_eur: string; movements: number };
type Cat = { id: string; code: string; name_it: string; name_fr: string; direction: 'in' | 'out'; active: boolean; group_id: string | null };
type Grp = { id: string; code: string; name_it: string; name_fr: string; direction: 'in' | 'out'; sort: number };

const NEAR = 0.9;   // avviso quando l'eseguito arriva al 90% della voce

// Preventivo annuale in una pagina sola (scelta 5 · proposta dell'esperto): una griglia codici × progetti dove si scrive
// direttamente nella bozza, e la stessa griglia per il confronto con il consuntivo. Versioni e Mod. D si aprono solo quando servono.
// Il preventivo è solo annuale: niente ripartizione mensile.
export default async function BudgetPage({ searchParams }: {
  searchParams: Promise<{ anno?: string; v?: string; vista?: string; progetto?: string; cella?: string; edit?: string; elimina?: string; add?: string;
    schema?: string; ok?: string; err?: string; n?: string }>;
}) {
  const sp = await searchParams;
  const year = Number(sp.anno) || new Date().getFullYear();
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, STAFF)) return <Denied text={t('only_staff')} />;
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const resp = can(me, RESP), admin = can(me, ADMIN);
  const { data: versions } = await supabase.from('budgets')
    .select('id, year, version, status, title, approval_ref, approved_at, created_at, based_on, demo').eq('year', year).order('version').returns<Budget[]>();
  const vs = versions ?? [];
  const approved = vs.find((b) => b.status === 'approved') ?? null;
  const draft = vs.find((b) => b.status === 'draft') ?? null;
  // si apre sulla versione in vigore (la bozza da «Apri la bozza» o subito dopo «Prepara una revisione»)
  const shown = vs.find((b) => b.id === sp.v) ?? approved ?? draft ?? vs[vs.length - 1] ?? null;
  // vecchi indirizzi: modifica/righe/riassunto/schema → griglia; analisi → confronto
  const view: 'grid' | 'cmp' = sp.vista === 'confronto' || sp.vista === 'analisi' ? 'cmp' : 'grid';
  const showSchema = sp.schema === '1' || sp.vista === 'schema' || sp.vista === 'riassunto';
  const prj = /^[0-9a-f-]{36}$/.test(sp.progetto ?? '') ? sp.progetto! : sp.progetto === 'gen' ? 'gen' : '';
  const diffBase = shown?.status === 'draft' && approved ? approved : null;

  const [{ data: items }, { data: cmp, error }, { data: cats }, { data: groups }, { data: projects }, { data: rate }, { data: prev }, { data: baseItems }] = await Promise.all([
    shown ? supabase.from('budget_items').select('id, project_id, category_id, description, qty, unit, unit_cost, currency, fx_rate, amount, amount_eur, notes')
      .eq('budget_id', shown.id).order('sort').order('id').returns<Item[]>() : Promise.resolve({ data: [] as Item[] }),
    supabase.rpc('budget_compare', { p_year: year, p_budget: shown && shown.status !== 'approved' ? shown.id : null }),
    supabase.from('categories').select('id, code, name_it, name_fr, direction, active, group_id').order('direction', { ascending: false }).order('sort').returns<Cat[]>(),
    supabase.from('category_groups').select('id, code, name_it, name_fr, direction, sort').order('sort').returns<Grp[]>(),
    supabase.from('projects').select('id, name, active, kind').order('name'),
    supabase.rpc('fx_rate_for', { p_date: `${year}-01-01` }),
    supabase.from('budgets').select('id').eq('year', year - 1).limit(1),
    diffBase ? supabase.from('budget_items').select('project_id, category_id, amount_eur').eq('budget_id', diffBase.id)
      .returns<{ project_id: string | null; category_id: string; amount_eur: string }[]>() : Promise.resolve({ data: null }),
  ]);
  const [{ data: stB }, { data: stA }] = showSchema && view === 'grid' ? await Promise.all([
    supabase.rpc('budget_statement', { p_year: year, p_budget: shown && shown.status !== 'approved' ? shown.id : null }),
    supabase.rpc('report_cash_statement', { p_year: year }),
  ]) : [{ data: null }, { data: null }];
  const rows = (cmp ?? []) as Cmp[];
  const its = items ?? [];
  const catBy = new Map((cats ?? []).map((c) => [c.id, c]));
  const prjBy = new Map((projects ?? []).map((p) => [p.id, p.name as string]));
  const CL = (c: { name_it: string; name_fr: string }) => (lang === 'fr' && c.name_fr ? c.name_fr : c.name_it);
  const m = (v: number | string) => money(v, 'EUR', lang);
  const e0 = (v: number) => money(Math.round(v), 'EUR', lang).replace(/,00(?=\s?€)/, '');
  const href = (q: Record<string, string | number | undefined | null>) => {
    const u = new URLSearchParams({ anno: String(year) });
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
    return `/preventivo?${u}`;
  };
  const vLabel = (b: Budget) => `${b.version === 1 ? L('Originale', 'Initial') : `${L('Revisione', 'Révision')} ${b.version - 1}`}`;
  const stLabel = (s: Budget['status']) => (s === 'draft' ? L('Bozza', 'Brouillon') : s === 'approved' ? L('In vigore', 'En vigueur') : L('Superata', 'Remplacée'));
  const editing = shown?.status === 'draft' && resp;
  // versione in vigore: righe correggibili o eliminabili una per una dal dettaglio, con motivo (DEMO: responsabile, senza motivo)
  const amending = shown?.status === 'approved' && (admin || (Boolean(shown?.demo) && resp));
  const needReason = amending && !shown?.demo;
  const errText = sp.err ? (sp.err === 'missing' ? L('Compila codice e costo unitario.', 'Remplissez code et coût unitaire.') : sp.err) : null;

  // ── totali (filtro progetto compreso) e avvisi ──
  const inPrj = (id: string | null) => !prj || (prj === 'gen' ? id === null : id === prj);
  const fr = rows.filter((r) => inPrj(r.project_id) && (Number(r.budget_eur) || Number(r.actual_eur) || Number(r.committed_eur)));
  const sum = (d: 'in' | 'out', k: 'budget_eur' | 'actual_eur' | 'committed_eur') => fr.filter((r) => r.direction === d).reduce((s, r) => s + Number(r[k]), 0);
  const inB = sum('in', 'budget_eur'), outB = sum('out', 'budget_eur'), inA = sum('in', 'actual_eur'), outA = sum('out', 'actual_eur');
  const byCode = new Map<string, { b: number; a: number; c: number; r: Cmp }>();
  for (const r of fr.filter((x) => x.direction === 'out')) {
    const k = r.category_id, x = byCode.get(k) ?? { b: 0, a: 0, c: 0, r };
    x.b += Number(r.budget_eur); x.a += Number(r.actual_eur); x.c += Number(r.committed_eur); byCode.set(k, x);
  }
  const over = [...byCode.values()].filter((x) => x.a > x.b + 0.005);
  const near = [...byCode.values()].filter((x) => x.b > 0 && x.a <= x.b && x.a + x.c >= x.b * NEAR);
  const now = new Date();
  const elapsed = year < now.getFullYear() ? 1 : year > now.getFullYear() ? 0 : (now.getTime() - new Date(year, 0, 1).getTime()) / (new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime());
  const baseOut = (baseItems ?? []).filter((i) => catBy.get(i.category_id)?.direction === 'out').reduce((s, i) => s + Number(i.amount_eur), 0);
  const draftOut = its.filter((i) => catBy.get(i.category_id)?.direction === 'out').reduce((s, i) => s + Number(i.amount_eur), 0);

  // ── griglia: colonne (generale + progetti), righe (codici con importi, o aggiunti), celle ──
  // «Generale» (righe senza progetto) solo se usata o se si sta scrivendo la bozza
  const useGen = editing || its.some((i) => !i.project_id) || (baseItems ?? []).some((i) => !i.project_id) || rows.some((r) => !r.project_id && Number(r.actual_eur));
  const allCols: GCol[] = [...(useGen ? [{ id: '', name: L('Generale', 'Général') }] : []),
    ...(projects ?? []).filter((p) => p.active || its.some((i) => i.project_id === p.id) || rows.some((r) => r.project_id === p.id && Number(r.actual_eur)))
      .sort((a, b) => (a.kind === 'structure' ? -1 : 0) - (b.kind === 'structure' ? -1 : 0) || String(a.name).localeCompare(String(b.name)))
      .map((p) => ({ id: p.id as string, name: p.name as string }))];
  const cols = prj ? allCols.filter((c) => (prj === 'gen' ? c.id === '' : c.id === prj)) : allCols;
  const cellKey = (cat: string, p: string | null) => `${cat}|${p ?? ''}`;
  const cells: Record<string, GCell> = {};
  for (const i of its) {
    const k = cellKey(i.category_id, i.project_id), c = cells[k] ?? { eur: 0, n: 0, simple: false };
    c.eur = Math.round((c.eur + Number(i.amount_eur)) * 100) / 100; c.n += 1; c.simple = c.n === 1 && i.currency === 'EUR' && Number(i.qty) === 1; cells[k] = c;
  }
  if (diffBase) {
    const base = new Map<string, number>();
    for (const i of baseItems ?? []) base.set(cellKey(i.category_id, i.project_id), (base.get(cellKey(i.category_id, i.project_id)) ?? 0) + Number(i.amount_eur));
    for (const [k, b] of base) cells[k] = { ...(cells[k] ?? { eur: 0, n: 0, simple: false }), base: b };
    for (const k of Object.keys(cells)) if (cells[k].base === undefined) cells[k].base = null;
  }
  const addCat = /^[0-9a-f-]{36}$/.test(sp.add ?? '') ? sp.add! : '';
  const usedCats = new Set([...its.map((i) => i.category_id), ...(baseItems ?? []).map((i) => i.category_id), ...(addCat ? [addCat] : [])]);
  const grpBy = new Map((groups ?? []).map((g) => [g.id, g]));
  const gridRows: GRow[] = (cats ?? []).filter((c) => usedCats.has(c.id))
    .map((c) => ({ id: c.id, code: c.code, name: CL(c), dir: c.direction, group: c.group_id ?? `x-${c.direction}` }));
  const gridGroups: GGroup[] = [...(groups ?? []).map((g) => ({ id: g.id, label: `${g.code} · ${CL(g)}`, dir: g.direction })),
    { id: 'x-out', label: L('Altre uscite', 'Autres dépenses'), dir: 'out' as const }, { id: 'x-in', label: L('Altre entrate', 'Autres recettes'), dir: 'in' as const }];
  const ret = `vista=preventivo${prj ? `&progetto=${prj}` : ''}`;
  const detail: Record<string, string> = {};
  if (editing || amending) for (const r of gridRows) for (const c of cols) {
    const k = `${r.id}|${c.id}`;
    if (editing || (cells[k]?.n ?? 0) > 0) detail[k] = href({ v: shown?.id, vista: 'preventivo', progetto: prj, cella: `${r.id}~${c.id || 'gen'}` });
  }
  const sig = `${shown?.id}|${its.map((i) => `${i.id}:${i.amount_eur}`).join(',')}|${prj}|${addCat}`;

  // ── dettaglio di una cella (☰): righe con quantità × costo, valuta, tasso, note ──
  const [selCat, selPrj] = (sp.cella ?? '').split('~');
  const selC = selCat ? catBy.get(selCat) : undefined;
  const selP = selPrj === 'gen' ? null : selPrj && prjBy.has(selPrj) ? selPrj : undefined;
  const cellItems = selC && selP !== undefined ? its.filter((i) => i.category_id === selC.id && i.project_id === selP) : [];
  const edit = selC ? cellItems.find((i) => i.id === sp.edit) : undefined;
  const delRow = selC ? cellItems.find((i) => i.id === sp.elimina) : undefined;
  const cellHref = (q: Record<string, string>) => href({ v: shown?.id, vista: 'preventivo', progetto: prj, cella: sp.cella, ...q });
  const closeHref = href({ v: shown?.id, vista: 'preventivo', progetto: prj });

  // ── confronto: stessa griglia, ogni cella speso su previsto con la barra (rosso solo oltre il 100%) ──
  const cmpCell = new Map<string, { b: number; a: number; n: number }>();
  for (const r of rows) {
    const k = cellKey(r.category_id, r.project_id), x = cmpCell.get(k) ?? { b: 0, a: 0, n: 0 };
    x.b += Number(r.budget_eur); x.a += Number(r.actual_eur); x.n += r.movements; cmpCell.set(k, x);
  }
  const cmpCats = (cats ?? []).filter((c) => cols.some((col) => { const x = cmpCell.get(cellKey(c.id, col.id || null)); return x && (x.b || x.a); }));
  const pc = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
  const CmpCell = ({ b, a, hrefMov }: { b: number; a: number; hrefMov?: string }) => {
    if (!b && !a) return <td className="cg-c" />;
    const p = pc(a, b), w = b > 0 ? Math.min(a / b, 1) * 100 : 100, cls = b > 0 && a > b + 0.005 ? 'over' : !b ? 'nob' : '';
    return (
      <td className={`cg-c ${cls}`}>
        <span className="cg-a num">{hrefMov && a ? <Link href={hrefMov}>{e0(a)}</Link> : e0(a)}</span>
        <span className="cg-b num">{b ? `${L('su', 'sur')} ${e0(b)}` : L('non previsto', 'non prévu')}</span>
        <span className="cg-bar" aria-hidden="true"><i style={{ width: `${w}%` }} />{b > 0 && <em style={{ left: `${Math.min(elapsed, 1) * 100}%` }} />}</span>
        {p != null && <span className="cg-p">{p}%</span>}
      </td>
    );
  };
  const cmpBody = (d: 'in' | 'out') => {
    const gs = (groups ?? []).filter((g) => g.direction === d && cmpCats.some((c) => c.group_id === g.id));
    return gs.map((g) => {
      const cs = cmpCats.filter((c) => c.group_id === g.id);
      const gx = (col: string | null) => cs.reduce((s, c) => { const x = cmpCell.get(cellKey(c.id, col)); return { b: s.b + (x?.b ?? 0), a: s.a + (x?.a ?? 0) }; }, { b: 0, a: 0 });
      const gt = cols.reduce((s, col) => { const x = gx(col.id || null); return { b: s.b + x.b, a: s.a + x.a }; }, { b: 0, a: 0 });
      return (
        <tbody key={g.id}>
          <tr className="bg-grp"><th scope="rowgroup" className="bg-sticky">{g.code} · {CL(g)}</th>
            {cols.map((col) => { const x = gx(col.id || null); return <td key={col.id} className="r num">{x.b || x.a ? `${e0(x.a)} / ${e0(x.b)}` : ''}</td>; })}
            {cols.length > 1 && <td className="r num bg-tot">{e0(gt.a)} / {e0(gt.b)}</td>}</tr>
          {cs.map((c) => {
            const rt = cols.reduce((s, col) => { const x = cmpCell.get(cellKey(c.id, col.id || null)); return { b: s.b + (x?.b ?? 0), a: s.a + (x?.a ?? 0) }; }, { b: 0, a: 0 });
            return (
              <tr key={c.id}>
                <th scope="row" className="bg-sticky bg-code"><span className="bg-cw"><span className="bg-c">{c.code}</span><span className="bg-n">{CL(c)}</span></span></th>
                {cols.map((col) => { const x = cmpCell.get(cellKey(c.id, col.id || null));
                  return <CmpCell key={col.id} b={x?.b ?? 0} a={x?.a ?? 0} hrefMov={`/movimenti?dal=${year}-01-01&al=${year}-12-31&codice=${c.id}${col.id ? `&progetto=${col.id}` : ''}`} />; })}
                {cols.length > 1 && <CmpCell b={rt.b} a={rt.a} />}
              </tr>
            );
          })}
        </tbody>
      );
    });
  };

  return (
    <div className="stack">
      <PageHead title={`${L('Preventivo', 'Budget')} ${year}`} />
      {sp.ok && <div className="note ok" role="status">{sp.ok === 'deleted' ? L(`Preventivo eliminato (${sp.n ?? 0} righe).`, `Budget supprimé (${sp.n ?? 0} lignes).`)
        : sp.ok === 'row_deleted' ? L('Riga eliminata.', 'Ligne supprimée.') : L('Salvato.', 'Enregistré.')}</div>}
      {errText && <div className="note err">{errText}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />

      {vs.length === 0 || !shown ? (
        <Panel pad title={L('Nessun preventivo per quest\'anno', 'Aucun budget pour cette année')}>
          <p className="muted" style={{ marginTop: 0 }}>{L(
            'Il preventivo è una griglia: codici di spesa e di entrata sulle righe, progetti sulle colonne. Si scrive l\'importo nella cella; per quantità × costo o importi in ariary si apre il dettaglio. Si approva con gli estremi della delibera; dopo l\'approvazione si cambia con una revisione, e le versioni precedenti restano consultabili.',
            'Le budget est une grille : codes de dépenses et de recettes en lignes, projets en colonnes. On écrit le montant dans la cellule ; pour quantité × coût ou montants en ariary on ouvre le détail. Il s\'approuve avec la référence de la délibération ; ensuite il change par une révision, et les versions précédentes restent consultables.')}</p>
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
          {/* barra della versione: quale si vede, quale è in vigore, cosa cambia; azioni solo quando servono */}
          <section className={`panel bv-bar st-${shown.status}`}>
            <div className="bv-l">
              <span className={`chip ${shown.status === 'approved' ? 'ok' : shown.status === 'draft' ? 'warn' : ''}`}>{stLabel(shown.status)}</span>
              <b>{L('Preventivo', 'Budget')} {year} · {vLabel(shown)}</b>{shown.demo && <span className="chip warn">DEMO</span>}
              <span className="muted bv-s">
                {shown.status === 'approved' ? (shown.approval_ref ?? '')
                  : approved ? <>{L('in vigore', 'en vigueur')}: {vLabel(approved)}{approved.approval_ref ? ` · ${approved.approval_ref}` : ''}
                    {shown.status === 'draft' && Math.abs(draftOut - baseOut) > 0.5 ? <> · {L('uscite', 'dépenses')} <b className="num">{draftOut - baseOut > 0 ? '+' : '−'}{e0(Math.abs(draftOut - baseOut))}</b></> : null}</> : L('non ancora approvato', 'pas encore approuvé')}
              </span>
            </div>
            <div className="bv-r">
              {draft && shown.id !== draft.id && <Link className="btn small" href={href({ v: draft.id, vista: 'preventivo' })}>{L('Apri la bozza', 'Ouvrir le brouillon')}</Link>}
              {resp && !draft && approved && (
                <form action={draftBudget}><input type="hidden" name="year" value={year} />
                  <button className="btn small" type="submit">{L('Prepara una revisione', 'Préparer une révision')}</button></form>
              )}
              {draft && shown.id === draft.id && admin && (
                <details className="bv-pop">
                  <summary className="btn small primary">{L('Approva…', 'Approuver…')}</summary>
                  <form action={approveBudget} className="bv-menu stack">
                    <input type="hidden" name="year" value={year} /><input type="hidden" name="id" value={draft.id} />
                    <label htmlFor="apref">{L('Delibera di approvazione', 'Délibération d\'approbation')}</label>
                    <input className="input" id="apref" name="ref" required minLength={3} maxLength={300} placeholder={L('Es. delibera CdA del 15/01', 'Ex. délibération du CA du 15/01')} />
                    <button className="btn primary" type="submit">{L(`Approva ${vLabel(draft).toLowerCase()}`, `Approuver ${vLabel(draft).toLowerCase()}`)}</button>
                  </form>
                </details>
              )}
              <details className="bv-pop">
                <summary className="btn small">{L('Versioni', 'Versions')} · {vs.length}</summary>
                <div className="bv-menu">
                  <ol className="versions">
                    {vs.map((b) => (
                      <li key={b.id} aria-current={b.id === shown.id ? 'true' : undefined}>
                        <Link href={href({ v: b.id, vista: view === 'cmp' ? 'confronto' : 'preventivo' })}>
                          <span className="v-name"><b>{vLabel(b)}</b>{b.title && <span className="v-title">{b.title}</span>}</span>
                          <span className="v-chips"><span className={`chip ${b.status === 'approved' ? 'ok' : b.status === 'draft' ? 'warn' : ''}`}>{stLabel(b.status)}</span>{b.demo && <span className="chip warn">DEMO</span>}</span>
                        </Link>
                        <span className="muted">{b.approved_at ? `${L('Approvato il', 'Approuvé le')} ${dateTime(b.approved_at, lang)} · ${b.approval_ref}` : `${L('Creato il', 'Créé le')} ${date(b.created_at)}`}</span>
                      </li>
                    ))}
                  </ol>
                  {resp && draft && shown.id === draft.id && (
                    <form action={discardBudget}><input type="hidden" name="year" value={year} /><input type="hidden" name="id" value={draft.id} />
                      <button className="btn small danger" type="submit">{L('Elimina la bozza', 'Supprimer le brouillon')}</button></form>
                  )}
                  {shown.status !== 'draft' && (admin || (shown.demo && resp)) && (
                    <details className="danger-zone">
                      <summary className="btn small ghost">{L(`Elimina ${vLabel(shown).toLowerCase()}…`, `Supprimer ${vLabel(shown).toLowerCase()}…`)}</summary>
                      <form action={deleteBudget} className="stack" style={{ gap: 8, marginTop: 10 }}>
                        <input type="hidden" name="year" value={year} /><input type="hidden" name="id" value={shown.id} />
                        <p className="muted" style={{ margin: 0 }}>{shown.demo
                          ? L('Versione dimostrativa: si eliminano la versione e tutte le sue righe.', 'Version de démonstration : la version et toutes ses lignes sont supprimées.')
                          : L('Versione approvata reale: solo un amministratore, con il motivo. Resta traccia nel registro modifiche e torna in vigore la versione precedente, se c\'è.',
                            'Version approuvée réelle : seulement un administrateur, avec le motif. La trace reste dans l\'historique et la version précédente redevient en vigueur, s\'il y en a une.')}</p>
                        {!shown.demo && <input className="input" name="reason" required minLength={5} maxLength={300} placeholder={L('Motivo dell\'eliminazione', 'Motif de la suppression')} aria-label={L('Motivo', 'Motif')} />}
                        <label className="check"><input type="checkbox" name="confirm" required /> {L(`Confermo: elimina ${vLabel(shown).toLowerCase()} del ${year} con ${its.length} righe`, `Je confirme : supprimer ${vLabel(shown).toLowerCase()} ${year} avec ${its.length} lignes`)}</label>
                        <div><button className="btn danger" type="submit">{L('Elimina definitivamente', 'Supprimer définitivement')}</button></div>
                      </form>
                    </details>
                  )}
                </div>
              </details>
            </div>
          </section>

          <div className="kpi4">
            <div className="k4 k-in"><span className="k4-t"><CIcon name="trend" size={15} />{L('Entrate previste', 'Recettes prévues')}</span><b className="num">{e0(inB)}</b>
              <small>{L('incassate', 'encaissées')} {e0(inA)}</small></div>
            <div className="k4 k-out"><span className="k4-t"><CIcon name="chart" size={15} />{L('Uscite previste', 'Dépenses prévues')}</span><b className="num">{e0(outB)}</b>
              <small>{L('spese', 'dépensées')} {e0(outA)}</small></div>
            <div className="k4 k-net"><span className="k4-t"><CIcon name="calc" size={15} />{L('Saldo previsto', 'Solde prévu')}</span><b className={`num ${inB - outB < 0 ? 'neg' : ''}`}>{e0(inB - outB)}</b>
              <small>{inB - outB < 0 ? L('disavanzo da coprire', 'déficit à couvrir') : L('avanzo', 'excédent')}</small></div>
            <div className="k4 k-liq"><span className="k4-t"><CIcon name="wallet" size={15} />{L('Preventivo usato', 'Budget utilisé')}</span><b className="num">{outB > 0 ? `${Math.round((outA / outB) * 100)} %` : '–'}</b>
              <small className={over.length ? 'neg' : ''}>{over.length ? L(`${over.length} codici oltre il previsto`, `${over.length} codes au-delà du prévu`) : L(`anno trascorso ${Math.round(elapsed * 100)} %`, `année écoulée ${Math.round(elapsed * 100)} %`)}</small></div>
          </div>

          <section className="panel">
            <div className="bv-tools">
              <div className="segs" role="tablist" aria-label={L('Vista', 'Vue')}>
                <Link role="tab" aria-selected={view === 'grid'} href={href({ v: shown.id, vista: 'preventivo', progetto: prj })}>{L('Preventivo', 'Budget')}</Link>
                <Link role="tab" aria-selected={view === 'cmp'} href={href({ v: shown.id, vista: 'confronto', progetto: prj })}>{L('Confronto con il consuntivo', 'Comparaison avec le réalisé')}</Link>
              </div>
              <div className="bv-tr">
                <FilterBar action="/preventivo" lang={lang} hidden={{ anno: String(year), v: shown.id, vista: view === 'cmp' ? 'confronto' : 'preventivo' }}
                  inline={<select className="input" name="progetto" defaultValue={prj} aria-label={L('Progetto', 'Projet')}>
                    <option value="">{L('Tutti i progetti', 'Tous les projets')}</option>
                    <option value="gen">{L('Generale (struttura)', 'Général (structure)')}</option>
                    {allCols.filter((c) => c.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>} />
                <a className="btn" href={`/api/v1/export/budget?anno=${year}&v=${shown.id}`}><Ico name="download" />Excel</a>
              </div>
            </div>

            {view === 'grid' ? (<>
              {!editing && !amending && <p className="bv-hint">{shown.status === 'draft'
                ? L('Bozza in preparazione: la modificano gli amministratori e i responsabili.', 'Brouillon en préparation : il est modifié par les administrateurs et les responsables.')
                : L('Questa versione non si modifica: per cambiare il preventivo si prepara una revisione.', 'Cette version ne se modifie pas : pour changer le budget, on prépare une révision.')}</p>}
              {amending && <p className="bv-hint">{shown.demo
                ? L('Versione DEMO in vigore: con ☰ correggi o elimini le righe una per una.', 'Version DEMO en vigueur : avec ☰ vous corrigez ou supprimez les lignes une par une.')
                : L('Versione approvata: con ☰ correggi o elimini una riga indicando il motivo (resta nello storico). Per aggiungere voci si prepara una revisione.', 'Version approuvée : avec ☰ vous corrigez ou supprimez une ligne en indiquant le motif (reste dans l\'historique). Pour ajouter des postes, on prépare une révision.')}</p>}
              {gridRows.length === 0 ? <Empty text={editing ? L('Bozza vuota: aggiungi il primo codice qui sotto.', 'Brouillon vide : ajoutez le premier code ci-dessous.') : L('Nessuna voce.', 'Aucun poste.')} /> : (
                <BudgetGrid budgetId={shown.id} rows={gridRows} groups={gridGroups} cols={cols} cells={cells} editable={Boolean(editing)} lang={lang}
                  detail={detail} sig={sig} />
              )}
              {editing && (
                <form className="bv-add" action="/preventivo" method="get">
                  <input type="hidden" name="anno" value={year} /><input type="hidden" name="v" value={shown.id} /><input type="hidden" name="vista" value="preventivo" />
                  {prj && <input type="hidden" name="progetto" value={prj} />}
                  <label className="vh" htmlFor="bv-add">{L('Aggiungi codice', 'Ajouter un code')}</label>
                  <select className="input" id="bv-add" name="add" required defaultValue="">
                    <option value="" disabled>{L('+ Aggiungi codice…', '+ Ajouter un code…')}</option>
                    {(['out', 'in'] as const).map((d) => (
                      <optgroup key={d} label={d === 'out' ? L('Uscite', 'Dépenses') : L('Entrate', 'Recettes')}>
                        {(cats ?? []).filter((c) => c.direction === d && c.active && !usedCats.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.code} · {CL(c)}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <button className="btn" type="submit">{L('Aggiungi', 'Ajouter')}</button>
                </form>
              )}
              {editing && gridRows.length > 0 && <p className="bv-hint small">{L(
                'Scrivi l\'importo in euro nella cella: Invio o uscita dalla cella salva e aggiorna i totali. ☰ apre il dettaglio (quantità × costo, ariary con il tasso, note). Bordo azzurro: cambiata rispetto alla versione in vigore.',
                'Écrivez le montant en euros dans la cellule : Entrée ou sortie de la cellule enregistre et met à jour les totaux. ☰ ouvre le détail (quantité × coût, ariary avec le taux, notes). Bordure bleue : modifiée par rapport à la version en vigueur.')}</p>}
            </>) : (<>
              {(over.length > 0 || near.length > 0) && (
                <details className="alerts bv-al" open={over.length + near.length <= 4}>
                  <summary className={`note ${over.length ? 'err' : ''}`}>{over.length ? (over.length === 1 ? L('1 codice oltre il preventivo', '1 code au-delà du budget') : L(`${over.length} codici oltre il preventivo`, `${over.length} codes au-delà du budget`)) : ''}{over.length && near.length ? ' · ' : ''}{near.length ? (near.length === 1 ? L('1 vicino al limite', '1 proche de la limite') : L(`${near.length} vicini al limite`, `${near.length} proches de la limite`)) : ''} <span className="muted">{L('· mostra il dettaglio', '· afficher le détail')}</span></summary>
                  {over.map((x) => <div key={x.r.category_id} className="note err">{x.r.category_code} {lang === 'fr' && x.r.cat_fr ? x.r.cat_fr : x.r.cat_it}: {L('speso', 'dépensé')} {m(x.a)} {L('su', 'sur')} {m(x.b)} {L('previsti', 'prévus')} ({x.b > 0 ? `+${m(x.a - x.b)}` : L('voce non prevista', 'poste non prévu')})</div>)}
                  {near.map((x) => <div key={x.r.category_id} className="note">{x.r.category_code} {lang === 'fr' && x.r.cat_fr ? x.r.cat_fr : x.r.cat_it}: {Math.round(((x.a + x.c) / x.b) * 100)}% {L('del previsto, impegni compresi', 'du prévu, engagements compris')}</div>)}
                </details>
              )}
              {cmpCats.length === 0 ? <Empty text={L('Nessuna voce.', 'Aucun poste.')} /> : (
                <div className="tscroll bg-wrap">
                  <table className="t keep bgrid cgrid">
                    <thead><tr><th className="bg-sticky">{L('Codice', 'Code')}</th>{cols.map((c) => <th key={c.id} className="r">{c.name}</th>)}{cols.length > 1 && <th className="r bg-tot">{L('Totale', 'Total')}</th>}</tr></thead>
                    {(['out', 'in'] as const).map((d) => cmpCats.some((c) => c.direction === d) && [
                      <tbody key={`h${d}`}><tr className="bg-sec"><th scope="rowgroup" className="bg-sticky">{d === 'out' ? L('Uscite', 'Dépenses') : L('Entrate', 'Recettes')}</th>
                        {cols.map((col) => <td key={col.id} />)}{cols.length > 1 && <td className="bg-tot" />}</tr></tbody>,
                      ...cmpBody(d),
                    ])}
                  </table>
                </div>
              )}
              <p className="bv-hint small">{L('Speso su previsto per codice e progetto. Tacca sulla barra = anno trascorso; rosso solo oltre il 100%. Clic sull\'importo: i movimenti.',
                'Dépensé sur prévu par code et projet. Repère sur la barre = année écoulée ; rouge seulement au-delà de 100 %. Clic sur le montant : les mouvements.')}</p>
            </>)}
          </section>

          {view === 'grid' && (showSchema ? (
            <Panel title={`${L('Schema del rendiconto per cassa (Mod. D)', 'Schéma du compte rendu de caisse (Mod. D)')} · ${vLabel(shown)}`}
              right={<Link className="btn small ghost" href={href({ v: shown.id, vista: 'preventivo', progetto: prj })}>{L('Nascondi', 'Masquer')}</Link>}>
              <StatementTable budget={(stB ?? []) as StLine[]} actual={(stA ?? []) as StAct[]} lang={lang} />
            </Panel>
          ) : (
            <Link className="bv-more" href={`${href({ v: shown.id, vista: 'preventivo', progetto: prj, schema: 1 })}#mod-d`}>
              ▸ {L('Mostra lo schema del rendiconto (Mod. D) · per il commercialista', 'Afficher le schéma du compte rendu (Mod. D) · pour l\'expert-comptable')}</Link>
          ))}
          <span id="mod-d" />

          {selC && selP !== undefined && (
            <div className="sheet-bg dl-sheet-bg">
              <Link className="dl-sheet-x" href={closeHref} scroll={false} aria-label={L('Chiudi', 'Fermer')} />
              <aside className="sheet sheet-help dl-sheet bv-sheet" role="dialog" aria-modal="true" aria-label={`${selC.code} · ${selP ? prjBy.get(selP) : L('Generale', 'Général')}`}>
                <div className="sheet-h"><h2>{selC.code} · {CL(selC)}</h2><div className="spacer" />
                  <Link className="btn ghost" href={closeHref} scroll={false}>{L('Chiudi', 'Fermer')}</Link></div>
                <div className="sheet-b">
                  <p className="muted" style={{ margin: '0 0 10px' }}>{selP ? prjBy.get(selP) : L('Generale (struttura)', 'Général (structure)')} · {vLabel(shown)} · {L('totale', 'total')} <b className="num">{m(cellItems.reduce((s, i) => s + Number(i.amount_eur), 0))}</b></p>
                  {cellItems.length === 0 ? <p className="muted">{L('Nessuna riga in questa cella.', 'Aucune ligne dans cette cellule.')}</p> : (
                    <ul className="bv-items">
                      {cellItems.map((i) => (
                        <li key={i.id} className={i.id === sp.edit ? 'sel' : ''}>
                          <div><b>{i.description || CL(selC)}</b>
                            <small className="muted num">{num(Number(i.qty), lang)}{i.unit ? ` ${i.unit}` : ''} × {money(i.unit_cost, i.currency, lang)}{i.currency !== 'EUR' && i.fx_rate ? ` · ${L('tasso', 'taux')} ${num(Number(i.fx_rate), lang)}` : ''}{i.notes ? ` · ${i.notes}` : ''}</small></div>
                          <span className="bv-amt"><b className="num">{money(i.amount, i.currency, lang)}</b>{i.currency !== 'EUR' && <small className="muted num">≈ {m(i.amount_eur)}</small>}</span>
                          {(editing || amending) && <span className="row-btns">
                            <Link className="btn small" href={cellHref({ edit: i.id })} scroll={false}>{L('Modifica', 'Modifier')}</Link>
                            <Link className="btn small danger" href={cellHref({ elimina: i.id })} scroll={false}>{L('Elimina', 'Supprimer')}</Link></span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {delRow && (
                    <form action={deleteItem} className="del-row stack" style={{ gap: 8 }}>
                      <input type="hidden" name="year" value={year} /><input type="hidden" name="id" value={delRow.id} /><input type="hidden" name="budget_id" value={shown.id} />
                      <input type="hidden" name="ret" value={`${ret}&cella=${sp.cella}`} />
                      <p style={{ margin: 0 }}><b>{L('Eliminare questa riga?', 'Supprimer cette ligne ?')}</b> {delRow.description || CL(selC)} · {money(delRow.amount, delRow.currency, lang)}</p>
                      {needReason && <div className="field"><label htmlFor="del-reason">{L('Motivo', 'Motif')}</label>
                        <input className="input" id="del-reason" name="reason" required minLength={5} maxLength={500} placeholder={L('Es. voce annullata con delibera del…', 'Ex. poste annulé par délibération du…')} /></div>}
                      <label className="chk"><input type="checkbox" name="confirm" required /> {L('Confermo l\'eliminazione', 'Je confirme la suppression')}</label>
                      <div className="row-actions"><button className="btn danger" type="submit">{L('Elimina la riga', 'Supprimer la ligne')}</button>
                        <Link className="btn ghost" href={cellHref({})} scroll={false}>{L('Annulla', 'Annuler')}</Link></div>
                    </form>
                  )}
                  {(editing || edit) && !delRow && (
                    <form action={saveItem} className="fgrid" key={edit?.id ?? 'new'} id="riga">
                      <input type="hidden" name="year" value={year} /><input type="hidden" name="budget_id" value={shown.id} />
                      <input type="hidden" name="ret" value={`${ret}&cella=${sp.cella}`} />
                      <input type="hidden" name="category_id" value={selC.id} /><input type="hidden" name="project_id" value={selP ?? ''} />
                      {edit && <input type="hidden" name="id" value={edit.id} />}
                      <h3 className="span2" style={{ margin: '6px 0 0' }}>{edit ? L('Modifica la riga', 'Modifier la ligne') : L('Nuova riga in questa cella', 'Nouvelle ligne dans cette cellule')}</h3>
                      <div className="field span2"><label htmlFor="bi-desc">{L('Descrizione', 'Description')}</label>
                        <input className="input" id="bi-desc" name="description" maxLength={300} defaultValue={edit?.description ?? ''} placeholder={L('Es. quaderni e penne', 'Ex. cahiers et stylos')} /></div>
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
                      {edit && needReason && <div className="field span2"><label htmlFor="bi-reason">{L('Motivo della modifica (resta nello storico)', 'Motif de la modification (reste dans l\'historique)')}</label>
                        <input className="input" id="bi-reason" name="reason" required minLength={5} maxLength={500} placeholder={L('Es. importo corretto dopo il nuovo preventivo del fornitore', 'Ex. montant corrigé après le nouveau devis du fournisseur')} /></div>}
                      <div className="span2 row-actions">
                        <button className="btn primary" type="submit">{edit ? L('Salva la riga', 'Enregistrer la ligne') : L('Aggiungi la riga', 'Ajouter la ligne')}</button>
                        {edit && <Link className="btn ghost" href={cellHref({})} scroll={false}>{L('Annulla', 'Annuler')}</Link>}
                      </div>
                    </form>
                  )}
                </div>
              </aside>
            </div>
          )}
        </>
      )}
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
