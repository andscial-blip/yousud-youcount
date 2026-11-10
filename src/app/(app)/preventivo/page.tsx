import Link from 'next/link';
import { FilterBar } from '@/components/FilterBar';
import { CIcon } from '@/components/CIcon';
import { Ico } from '@/components/Ui';
import { ADMIN, RESP, STAFF, can, requireMe } from '@/lib/session';
import { date, dateTime, money, num } from '@/lib/format';
import { Denied, Empty, ErrorNote, PageHead, Panel } from '@/components/Page';
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

// Preventivo annuale (richiesta del 10/11): si scrive riga per riga come un preventivo vero — codice di spesa, progetto,
// descrizione, quantità, unità, costo unitario, valuta (ariary con il tasso), totale e note — con la riga di inserimento
// sempre pronta in fondo. Il confronto con il consuntivo è una tabella semplice: una riga per codice, previsto, speso, residuo.
// Il preventivo è solo annuale: niente ripartizione mensile.
export default async function BudgetPage({ searchParams }: {
  searchParams: Promise<{ anno?: string; v?: string; vista?: string; progetto?: string; edit?: string; elimina?: string; dir?: string;
    schema?: string; ok?: string; err?: string; n?: string; lc?: string; lp?: string }>;
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
  // tre schede: voci (si compila riga per riga) · riepilogo (per entrate/uscite, codice, progetto; Mod. D) · confronto
  // vecchi indirizzi: modifica/righe/preventivo → voci; riassunto/schema → riepilogo; analisi → confronto
  const view: 'rows' | 'sum' | 'cmp' = sp.vista === 'confronto' || sp.vista === 'analisi' ? 'cmp'
    : sp.vista === 'riepilogo' || sp.vista === 'riassunto' || sp.vista === 'schema' ? 'sum' : 'rows';
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
  const [{ data: stB }, { data: stA }] = showSchema && view === 'sum' ? await Promise.all([
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


  // ── righe del preventivo (filtro progetto), ordinate per sezione, codice, progetto ──
  const prjList = (projects ?? []).filter((p) => p.active || its.some((i) => i.project_id === p.id))
    .sort((a, b) => (a.kind === 'structure' ? -1 : 0) - (b.kind === 'structure' ? -1 : 0) || String(a.name).localeCompare(String(b.name)));
  const rowsOf = (d: 'in' | 'out') => its.filter((i) => catBy.get(i.category_id)?.direction === d && inPrj(i.project_id))
    .sort((a, b) => (catBy.get(a.category_id)?.code ?? '').localeCompare(catBy.get(b.category_id)?.code ?? '', 'it', { numeric: true })
      || (prjBy.get(a.project_id ?? '') ?? '').localeCompare(prjBy.get(b.project_id ?? '') ?? ''));
  const totOf = (d: 'in' | 'out') => rowsOf(d).reduce((s, i) => s + Number(i.amount_eur), 0);
  const rowActions = editing || amending;
  const edit = rowActions ? its.find((i) => i.id === sp.edit) : undefined;
  const delRow = rowActions ? its.find((i) => i.id === sp.elimina) : undefined;
  const ret = `vista=voci${prj ? `&progetto=${prj}` : ''}`;
  const lastCat = /^[0-9a-f-]{36}$/.test(sp.lc ?? '') ? sp.lc! : '';
  const lastPrj = /^[0-9a-f-]{36}$/.test(sp.lp ?? '') ? sp.lp! : prj && prj !== 'gen' ? prj : '';
  const nf = (v: string | number) => String(Number(v)).replace('.', ',');
  const catOptions = (d: 'in' | 'out' | null, keep?: string) => (['out', 'in'] as const).filter((x) => !d || x === d).map((x) => (
    <optgroup key={x} label={x === 'out' ? L('Uscite', 'Dépenses') : L('Entrate', 'Recettes')}>
      {(cats ?? []).filter((c) => c.direction === x && (c.active || c.id === keep)).map((c) => <option key={c.id} value={c.id}>{c.code} · {CL(c)}</option>)}
    </optgroup>));
  const prjOptions = (keep?: string | null) => (<>
    <option value="">{L('Generale (struttura)', 'Général (structure)')}</option>
    {prjList.filter((p) => p.active || p.id === keep).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</>);
  // campi di una riga (nuova o in modifica): si usano dentro le celle della tabella, collegati al modulo con l'attributo form
  const fields = (f: string, i?: Item) => (<>
    <td data-l={L('Codice', 'Code')}><select className="input" name="category_id" form={f} required defaultValue={i?.category_id ?? lastCat} aria-label={L('Codice di spesa o entrata', 'Code de dépense ou recette')}>
      <option value="" disabled>{L('Codice…', 'Code…')}</option>{catOptions(null, i?.category_id)}</select></td>
    <td data-l={L('Progetto', 'Projet')}><select className="input" name="project_id" form={f} defaultValue={i ? i.project_id ?? '' : lastPrj} aria-label={L('Progetto', 'Projet')}>{prjOptions(i?.project_id)}</select></td>
    <td data-l={L('Descrizione e note', 'Description et notes')}><div className="bl-two">
      <input className="input" name="description" form={f} maxLength={300} defaultValue={i?.description ?? ''} placeholder={L('Cosa (es. quaderni e penne)', 'Quoi (ex. cahiers et stylos)')} aria-label={L('Descrizione', 'Description')} />
      <input className="input bl-sm" name="notes" form={f} maxLength={500} defaultValue={i?.notes ?? ''} placeholder={L('Note (facoltative)', 'Notes (facultatives)')} aria-label={L('Note', 'Notes')} /></div></td>
    <td data-l={L('Quantità e unità', 'Quantité et unité')}><div className="bl-qu">
      <input className="input num" name="qty" form={f} inputMode="decimal" defaultValue={i ? nf(i.qty) : '1'} aria-label={L('Quantità', 'Quantité')} />
      <input className="input" name="unit" form={f} maxLength={30} defaultValue={i?.unit ?? ''} placeholder={L('unità', 'unité')} aria-label={L('Unità (es. mesi, kit)', 'Unité (ex. mois, kits)')} /></div></td>
    <td data-l={L('Costo unitario, valuta, tasso', 'Coût unitaire, devise, taux')}><div className="bl-cu">
      <input className="input num" name="unit_cost" form={f} inputMode="decimal" required defaultValue={i ? nf(i.unit_cost) : ''} placeholder="0" aria-label={L('Costo unitario', 'Coût unitaire')} />
      <select className="input" name="currency" form={f} defaultValue={i?.currency ?? 'EUR'} aria-label={L('Valuta', 'Devise')}><option>EUR</option><option>MGA</option></select>
      <input className="input num bl-sm" name="fx_rate" form={f} inputMode="decimal" defaultValue={i?.fx_rate ? nf(i.fx_rate) : rate ? nf(Number(rate).toFixed(2)) : ''} placeholder={L('tasso', 'taux')} title={L('Tasso MGA per 1 EUR (solo ariary)', 'Taux MGA pour 1 EUR (ariary seulement)')} aria-label={L('Tasso MGA per 1 EUR (solo ariary)', 'Taux MGA pour 1 EUR (ariary seulement)')} /></div></td>
  </>);
  const sectionRows = (d: 'in' | 'out') => rowsOf(d).map((i) => {
    const c = catBy.get(i.category_id);
    if (edit?.id === i.id) return (
      <tr key={i.id} className="bl-edit">
        {fields('bl-ed', i)}
        <td className="r num bl-tcell" data-l={L('Totale attuale', 'Total actuel')}>{m(i.amount_eur)}</td>
        <td className="r bl-act" data-l="">
          <button className="btn small primary" type="submit" form="bl-ed">{L('Salva', 'Enregistrer')}</button>
          <Link className="btn small ghost" href={href({ v: shown?.id, vista: 'voci', progetto: prj })}>{L('Annulla', 'Annuler')}</Link></td>
      </tr>);
    return (
      <tr key={i.id} className={delRow?.id === i.id ? 'sel' : ''}>
        <td data-l={L('Codice', 'Code')}><b>{c?.code}</b> <span className="muted bl-cn">{c ? CL(c) : ''}</span></td>
        <td data-l={L('Progetto', 'Projet')}>{i.project_id ? prjBy.get(i.project_id) : <span className="muted">{L('Generale', 'Général')}</span>}</td>
        <td data-l={L('Descrizione', 'Description')}>{i.description || <span className="muted">–</span>}{i.notes && <small className="muted bl-note">{i.notes}</small>}</td>
        <td className="r num nw" data-l={L('Quantità', 'Quantité')}>{num(Number(i.qty), lang)}{i.unit ? ` ${i.unit}` : ''}</td>
        <td className="r num nw" data-l={L('Costo unitario', 'Coût unitaire')}>{money(i.unit_cost, i.currency, lang)}{i.currency === 'MGA' && i.fx_rate ? <small className="muted bl-note">{L('tasso', 'taux')} {num(Number(i.fx_rate), lang)}</small> : null}</td>
        <td className="r num nw" data-l={L('Totale', 'Total')}><b>{m(i.amount_eur)}</b>{i.currency !== 'EUR' && <small className="muted bl-orig">{money(i.amount, i.currency, lang)}</small>}</td>
        {rowActions && <td className="r bl-act nw" data-l="">
          <Link className="btn small" href={`${href({ v: shown?.id, vista: 'voci', progetto: prj, edit: i.id })}#r-${i.id}`} id={`r-${i.id}`}>{L('Modifica', 'Modifier')}</Link>
          <Link className="btn small ghost" href={`${href({ v: shown?.id, vista: 'voci', progetto: prj, elimina: i.id })}#r-${i.id}`}>{L('Elimina', 'Supprimer')}</Link></td>}
      </tr>);
  });

  // ── confronto: una riga per codice (progetti filtrati), raggruppata come nel rendiconto ──
  const cmpByCat = new Map<string, { b: number; a: number; c: number; n: number }>();
  for (const r of fr) { const x = cmpByCat.get(r.category_id) ?? { b: 0, a: 0, c: 0, n: 0 }; x.b += Number(r.budget_eur); x.a += Number(r.actual_eur); x.c += Number(r.committed_eur); x.n += r.movements; cmpByCat.set(r.category_id, x); }
  const Bar = ({ b, a }: { b: number; a: number }) => {
    const p = b > 0 ? a / b : a > 0 ? 2 : 0;
    return <span className={`cb-bar${p > 1.0005 ? ' over' : ''}`} aria-hidden="true"><i style={{ width: `${Math.min(p, 1) * 100}%` }} />{b > 0 && year === now.getFullYear() && <em style={{ left: `${elapsed * 100}%` }} />}</span>;
  };
  const cmpSection = (d: 'in' | 'out') => (groups ?? []).filter((g) => g.direction === d && (cats ?? []).some((c) => c.group_id === g.id && cmpByCat.has(c.id))).map((g) => {
    const cs = (cats ?? []).filter((c) => c.group_id === g.id && cmpByCat.has(c.id));
    const gb = cs.reduce((s, c) => s + cmpByCat.get(c.id)!.b, 0), ga = cs.reduce((s, c) => s + cmpByCat.get(c.id)!.a, 0);
    return (
      <tbody key={g.id}>
        <tr className="cb-grp"><th scope="rowgroup" colSpan={2}>{g.code} · {CL(g)}</th><td className="r num">{e0(gb)}</td><td className="r num">{e0(ga)}</td>
          <td className={`r num ${d === 'out' && gb - ga < 0 ? 'neg' : ''}`}>{e0(gb - ga)}</td><td className="r num">{gb > 0 ? `${Math.round((ga / gb) * 100)}%` : ''}</td><td /></tr>
        {cs.map((c) => { const x = cmpByCat.get(c.id)!; const over = d === 'out' && x.a > x.b + 0.005;
          return (
            <tr key={c.id} className={over ? 'over' : ''}>
              <td className="nw" data-l={L('Codice', 'Code')}><b>{c.code}</b></td>
              <td data-l={L('Voce', 'Poste')}>{CL(c)}{!x.b && x.a > 0 && <span className="chip warn">{L('non prevista', 'non prévue')}</span>}</td>
              <td className="r num" data-l={L('Previsto', 'Prévu')}>{e0(x.b)}</td>
              <td className="r num" data-l={d === 'out' ? L('Speso', 'Dépensé') : L('Incassato', 'Encaissé')}>{x.n > 0
                ? <Link href={`/movimenti?dal=${year}-01-01&al=${year}-12-31&codice=${c.id}${prj && prj !== 'gen' ? `&progetto=${prj}` : ''}`}>{e0(x.a)}</Link> : e0(x.a)}</td>
              <td className={`r num ${d === 'out' && x.b - x.a < 0 ? 'neg' : ''}`} data-l={L('Residuo', 'Reste')}>{e0(x.b - x.a)}</td>
              <td className="r num" data-l="%">{x.b > 0 ? `${Math.round((x.a / x.b) * 100)}%` : '–'}</td>
              <td className="cb-bc"><Bar b={x.b} a={x.a} /></td>
            </tr>); })}
      </tbody>);
  });

  // ── riepilogo: il preventivo (versione mostrata, progetti filtrati) per codice e per progetto ──
  const fil = its.filter((i) => inPrj(i.project_id));
  const totIn = fil.filter((i) => catBy.get(i.category_id)?.direction === 'in').reduce((s, i) => s + Number(i.amount_eur), 0);
  const totOut = fil.filter((i) => catBy.get(i.category_id)?.direction === 'out').reduce((s, i) => s + Number(i.amount_eur), 0);
  const byCodeSum: SumRow[] = (['out', 'in'] as const).flatMap((d) => {
    const tot = d === 'out' ? totOut : totIn;
    const head: SumRow = { k: `s-${d}`, label: d === 'out' ? L('Uscite', 'Dépenses') : L('Entrate', 'Recettes'), v: tot, lvl: 0, share: 1, dir: d };
    const gs = (groups ?? []).filter((g) => g.direction === d).flatMap((g) => {
      const cs = (cats ?? []).filter((c) => c.group_id === g.id).map((c) => ({ c, v: fil.filter((i) => i.category_id === c.id).reduce((s, i) => s + Number(i.amount_eur), 0) })).filter((x) => x.v);
      if (!cs.length) return [];
      const gv = cs.reduce((s, x) => s + x.v, 0);
      return [{ k: g.id, label: `${g.code} · ${CL(g)}`, v: gv, lvl: 1, share: tot ? gv / tot : 0, dir: d } as SumRow,
        ...cs.map((x) => ({ k: x.c.id, label: `${x.c.code} · ${CL(x.c)}`, v: x.v, lvl: 2, share: tot ? x.v / tot : 0, dir: d } as SumRow))];
    });
    return gs.length ? [head, ...gs] : [];
  });
  const byPrjSum: SumRow[] = [...new Set(fil.map((i) => i.project_id ?? ''))]
    .map((p) => { const xs = fil.filter((i) => (i.project_id ?? '') === p);
      const o = xs.filter((i) => catBy.get(i.category_id)?.direction === 'out').reduce((s, i) => s + Number(i.amount_eur), 0);
      const n = xs.filter((i) => catBy.get(i.category_id)?.direction === 'in').reduce((s, i) => s + Number(i.amount_eur), 0);
      return { k: p || 'gen', label: p ? prjBy.get(p) ?? '–' : L('Generale (struttura)', 'Général (structure)'), v: o, inc: n, lvl: 2 as const, share: totOut ? o / totOut : 0, dir: 'out' as const }; })
    .sort((a, b) => b.v - a.v);

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
                <Link role="tab" aria-selected={view === 'rows'} href={href({ v: shown.id, vista: 'voci', progetto: prj })}>{L('Voci del preventivo', 'Postes du budget')} · {its.length}</Link>
                <Link role="tab" aria-selected={view === 'sum'} href={href({ v: shown.id, vista: 'riepilogo', progetto: prj })}>{L('Riepilogo', 'Récapitulatif')}</Link>
                <Link role="tab" aria-selected={view === 'cmp'} href={href({ v: shown.id, vista: 'confronto', progetto: prj })}>{L('Confronto con il consuntivo', 'Comparaison avec le réalisé')}</Link>
              </div>
              <div className="bv-tr">
                <FilterBar action="/preventivo" lang={lang} hidden={{ anno: String(year), v: shown.id, vista: view === 'cmp' ? 'confronto' : view === 'sum' ? 'riepilogo' : 'voci' }}
                  inline={<select className="input" name="progetto" defaultValue={prj} aria-label={L('Progetto', 'Projet')}>
                    <option value="">{L('Tutti i progetti', 'Tous les projets')}</option>
                    <option value="gen">{L('Generale (struttura)', 'Général (structure)')}</option>
                    {prjList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>} />
                <a className="btn" href={`/api/v1/export/budget?anno=${year}&v=${shown.id}`}><Ico name="download" />Excel</a>
              </div>
            </div>

            {view === 'rows' ? (<>
              {!editing && !amending && <p className="bv-hint">{shown.status === 'draft'
                ? L('Bozza in preparazione: la modificano gli amministratori e i responsabili.', 'Brouillon en préparation : il est modifié par les administrateurs et les responsables.')
                : L('Questa versione non si modifica: per cambiare il preventivo si prepara una revisione.', 'Cette version ne se modifie pas : pour changer le budget, on prépare une révision.')}</p>}
              {amending && <p className="bv-hint">{shown.demo
                ? L('Versione DEMO in vigore: puoi correggere o eliminare le righe una per una.', 'Version DEMO en vigueur : vous pouvez corriger ou supprimer les lignes une par une.')
                : L('Versione approvata: puoi correggere o eliminare una riga indicando il motivo (resta nello storico). Per aggiungere righe si prepara una revisione.', 'Version approuvée : vous pouvez corriger ou supprimer une ligne en indiquant le motif (reste dans l\'historique). Pour ajouter des lignes, on prépare une révision.')}</p>}
              {delRow && (
                <form action={deleteItem} className="del-row bl-del">
                  <input type="hidden" name="year" value={year} /><input type="hidden" name="id" value={delRow.id} /><input type="hidden" name="budget_id" value={shown.id} />
                  <input type="hidden" name="ret" value={ret} />
                  <p style={{ margin: 0 }}><b>{L('Eliminare questa riga?', 'Supprimer cette ligne ?')}</b> {catBy.get(delRow.category_id)?.code} · {delRow.description || (catBy.get(delRow.category_id) ? CL(catBy.get(delRow.category_id)!) : '')} · {money(delRow.amount, delRow.currency, lang)}</p>
                  {needReason && <input className="input" id="del-reason" name="reason" required minLength={5} maxLength={500} aria-label={L('Motivo', 'Motif')} placeholder={L('Motivo (es. voce annullata con delibera del…)', 'Motif (ex. poste annulé par délibération du…)')} />}
                  <label className="chk"><input type="checkbox" name="confirm" required /> {L('Confermo', 'Je confirme')}</label>
                  <button className="btn small danger" type="submit">{L('Elimina la riga', 'Supprimer la ligne')}</button>
                  <Link className="btn small ghost" href={href({ v: shown.id, vista: 'righe', progetto: prj })}>{L('Annulla', 'Annuler')}</Link>
                </form>
              )}
              {edit && <form id="bl-ed" action={saveItem} className="vh-form">
                <input type="hidden" name="year" value={year} /><input type="hidden" name="budget_id" value={shown.id} /><input type="hidden" name="id" value={edit.id} />
                <input type="hidden" name="ret" value={ret} />
                {needReason && <div className="bl-reason"><label htmlFor="bi-reason">{L('Motivo della modifica (resta nello storico)', 'Motif de la modification (reste dans l\'historique)')}</label>
                  <input className="input" id="bi-reason" name="reason" required minLength={5} maxLength={500} placeholder={L('Es. importo corretto dopo il nuovo preventivo del fornitore', 'Ex. montant corrigé après le nouveau devis du fournisseur')} /></div>}
              </form>}
              {editing && <form id="bl-new" action={saveItem} className="vh-form">
                <input type="hidden" name="year" value={year} /><input type="hidden" name="budget_id" value={shown.id} /><input type="hidden" name="ret" value={ret} />
              </form>}
              <div className="tscroll">
                <table className="t keep blines">
                  <thead><tr>
                    <th>{L('Codice', 'Code')}</th><th>{L('Progetto', 'Projet')}</th><th>{L('Descrizione', 'Description')}</th><th className="r">{L('Quantità', 'Quantité')}</th>
                    <th className="r">{L('Costo unitario', 'Coût unitaire')}</th><th className="r">{L('Totale', 'Total')} EUR</th>{rowActions && <th />}
                  </tr></thead>
                  {(['out', 'in'] as const).map((d) => (
                    <tbody key={d}>
                      <tr className="bl-sec"><th colSpan={5} scope="rowgroup">{d === 'out' ? L('Uscite', 'Dépenses') : L('Entrate', 'Recettes')} · {rowsOf(d).length}</th>
                        <td className="r num"><b>{m(totOf(d))}</b></td>{rowActions && <td />}</tr>
                      {sectionRows(d)}
                    </tbody>
                  ))}
                  {editing && (
                    <tbody>
                      <tr className="bl-sec bl-newh"><th colSpan={rowActions ? 7 : 6} scope="rowgroup">{L('Nuova riga', 'Nouvelle ligne')}</th></tr>
                      <tr className="bl-new">
                        {fields('bl-new')}
                        <td className="r muted bl-tcell" data-l="">=</td>
                        <td className="r bl-act" data-l=""><button className="btn small primary" type="submit" form="bl-new">+ {L('Aggiungi', 'Ajouter')}</button></td>
                      </tr>
                    </tbody>
                  )}
                  <tfoot><tr className="bl-tot"><th colSpan={5}>{L('Saldo previsto (entrate − uscite)', 'Solde prévu (recettes − dépenses)')}</th>
                    <td className={`r num ${totOf('in') - totOf('out') < 0 ? 'neg' : ''}`}><b>{m(totOf('in') - totOf('out'))}</b></td>{rowActions && <td />}</tr></tfoot>
                </table>
              </div>
              {editing && <p className="bv-hint small">{L(
                'Ogni riga è una voce del preventivo: codice, progetto, cosa, quantità × costo unitario. In ariary indica il tasso (MGA per 1 euro): il totale si converte in euro. Dopo «Aggiungi» la riga nuova ripropone codice e progetto dell\'ultima.',
                'Chaque ligne est un poste du budget : code, projet, quoi, quantité × coût unitaire. En ariary indiquez le taux (MGA pour 1 euro) : le total est converti en euros. Après « Ajouter » la nouvelle ligne reprend le code et le projet de la précédente.')}</p>}
            </>) : view === 'sum' ? (<>
              <div className="sum-pairs">
                <SumTable title={L('Per codice', 'Par code')} rows={byCodeSum} tot={totIn - totOut} lang={lang} L={L} m={e0} />
                <SumTable title={L('Per progetto', 'Par projet')} rows={byPrjSum} tot={totIn - totOut} lang={lang} L={L} m={e0} cols />
              </div>
            </>) : (<>
              {(over.length > 0 || near.length > 0) && (
                <div className="cb-al">
                  {over.length > 0 && <span className="chip bad">{over.length === 1 ? L('1 codice oltre il previsto', '1 code au-delà du prévu') : L(`${over.length} codici oltre il previsto`, `${over.length} codes au-delà du prévu`)}</span>}
                  {near.length > 0 && <span className="chip warn">{near.length === 1 ? L('1 vicino al limite', '1 proche de la limite') : L(`${near.length} vicini al limite`, `${near.length} proches de la limite`)}</span>}
                </div>
              )}
              {cmpByCat.size === 0 ? <Empty text={L('Nessuna voce.', 'Aucun poste.')} /> : (
                <div className="tscroll">
                  <table className="t keep cbudget">
                    <thead><tr><th>{L('Codice', 'Code')}</th><th>{L('Voce', 'Poste')}</th><th className="r">{L('Previsto', 'Prévu')}</th><th className="r">{L('Speso / incassato', 'Dépensé / encaissé')}</th>
                      <th className="r">{L('Residuo', 'Reste')}</th><th className="r">%</th><th className="cb-bc" /></tr></thead>
                    <tbody><tr className="bl-sec"><th colSpan={2} scope="rowgroup">{L('Uscite', 'Dépenses')}</th><td className="r num"><b>{e0(outB)}</b></td><td className="r num"><b>{e0(outA)}</b></td>
                      <td className={`r num ${outB - outA < 0 ? 'neg' : ''}`}><b>{e0(outB - outA)}</b></td><td className="r num"><b>{outB > 0 ? `${Math.round((outA / outB) * 100)}%` : ''}</b></td><td className="cb-bc"><Bar b={outB} a={outA} /></td></tr></tbody>
                    {cmpSection('out')}
                    <tbody><tr className="bl-sec"><th colSpan={2} scope="rowgroup">{L('Entrate', 'Recettes')}</th><td className="r num"><b>{e0(inB)}</b></td><td className="r num"><b>{e0(inA)}</b></td>
                      <td className="r num"><b>{e0(inB - inA)}</b></td><td className="r num"><b>{inB > 0 ? `${Math.round((inA / inB) * 100)}%` : ''}</b></td><td className="cb-bc"><Bar b={inB} a={inA} /></td></tr></tbody>
                    {cmpSection('in')}
                  </table>
                </div>
              )}
              <p className="bv-hint small">{L('Una riga per codice, sommando i progetti scelti nel filtro. Barra: speso su previsto; tacca = parte dell\'anno trascorsa; rosso solo oltre il previsto. Clic sull\'importo speso: i movimenti.',
                'Une ligne par code, en additionnant les projets du filtre. Barre : dépensé sur prévu ; repère = part de l\'année écoulée ; rouge seulement au-delà du prévu. Clic sur le montant : les mouvements.')}</p>
            </>)}
          </section>

          {view === 'sum' && (showSchema ? (
            <Panel title={`${L('Schema del rendiconto per cassa (Mod. D)', 'Schéma du compte rendu de caisse (Mod. D)')} · ${vLabel(shown)}`}
              right={<Link className="btn small ghost" href={href({ v: shown.id, vista: 'riepilogo', progetto: prj })}>{L('Nascondi', 'Masquer')}</Link>}>
              <StatementTable budget={(stB ?? []) as StLine[]} actual={(stA ?? []) as StAct[]} lang={lang} />
            </Panel>
          ) : (
            <Link className="bv-more" href={`${href({ v: shown.id, vista: 'riepilogo', progetto: prj, schema: 1 })}#mod-d`}>
              ▸ {L('Mostra lo schema del rendiconto (Mod. D) · per il commercialista', 'Afficher le schéma du compte rendu (Mod. D) · pour l\'expert-comptable')}</Link>
          ))}
          <span id="mod-d" />
        </>
      )}
    </div>
  );
}

type SumRow = { k: string; label: string; v: number; inc?: number; lvl: 0 | 1 | 2; share: number; dir: 'in' | 'out' };
// Riepilogo: una tabella con importo, quota sul totale e barra; per progetto anche le entrate previste.
function SumTable({ title, rows, tot, lang, L, m, cols }: { title: string; rows: SumRow[]; tot: number; lang: 'it' | 'fr'; L: (it: string, fr: string) => string;
  m: (v: number) => string; cols?: boolean }) {
  return (
    <section className="panel sum-t">
      <div className="panel-h"><h2>{title}</h2></div>
      {rows.length === 0 ? <Empty text={L('Nessuna voce.', 'Aucun poste.')} /> : (
        <div className="tscroll">
          <table className="t keep">
            <thead><tr><th>{cols ? L('Progetto', 'Projet') : L('Voce', 'Poste')}</th>{cols && <th className="r">{L('Entrate', 'Recettes')}</th>}
              <th className="r">{cols ? L('Uscite', 'Dépenses') : L('Importo', 'Montant')}</th><th className="r">{cols ? L('% uscite', '% dépenses') : '%'}</th><th className="sum-bc" /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.k} className={`lv${r.lvl}`}>
                <td>{r.label}</td>{cols && <td className="r num">{m(r.inc ?? 0)}</td>}
                <td className="r num">{m(r.v)}</td>
                <td className="r num">{r.lvl ? `${Math.round(r.share * 100)}%` : ''}</td>
                <td className="sum-bc">{r.lvl > 0 && <span className={`sum-bar ${r.dir}`}><i style={{ width: `${Math.min(r.share, 1) * 100}%` }} /></span>}</td>
              </tr>))}</tbody>
            {!cols && <tfoot><tr className="lv0"><td>{L('Saldo previsto (entrate − uscite)', 'Solde prévu (recettes − dépenses)')}</td><td className={`r num ${tot < 0 ? 'neg' : ''}`}>{m(tot)}</td><td /><td /></tr></tfoot>}
          </table>
        </div>
      )}
    </section>
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
