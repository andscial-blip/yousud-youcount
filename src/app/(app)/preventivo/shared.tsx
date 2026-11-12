import Link from 'next/link';
import { ADMIN, RESP, STAFF, can, requireMe } from '@/lib/session';
import { date, dateTime, money } from '@/lib/format';
import { Panel } from '@/components/Page';
import { Viz } from '@/components/Charts';
import { approveBudget, deleteBudget, discardBudget, draftBudget } from './actions';

// Parti comuni alle due schede del Preventivo (richiesta del 12/11): «Preventivo analitico» (/preventivo) con le righe,
// e «Riepilogo» (/preventivo/riepilogo). Stessi dati, stessi riquadri in alto, stessa barra della versione.

export type Budget = { id: string; year: number; version: number; status: 'draft' | 'approved' | 'superseded'; title: string | null;
  approval_ref: string | null; approved_at: string | null; created_at: string; based_on: string | null; demo?: boolean };
export type Item = { id: string; line_no: number; project_id: string | null; category_id: string; counterparty_id: string | null; description: string | null;
  qty: string; unit: string | null; unit_cost: string; currency: string; fx_rate: string | null; amount: string; amount_eur: string; notes: string | null };
export type Cat = { id: string; code: string; name_it: string; name_fr: string; direction: 'in' | 'out'; active: boolean; group_id: string | null };
export type Grp = { id: string; code: string; name_it: string; name_fr: string; direction: 'in' | 'out'; sort: number };
export type Prj = { id: string; name: string; active: boolean; kind: string | null };
export type Cp = { id: string; name: string; kind: 'supplier' | 'donor' | 'beneficiary' | 'staff' | 'other'; active: boolean };

export const C_INC = 'var(--navy)';      // entrate: blu notte
export const C_EXP = 'var(--vz-sp)';     // uscite: giallo
export const C_NET = 'var(--green-soft)'; // avanzo: verde

export async function loadBudget(sp: { anno?: string; v?: string }) {
  const year = Number(sp.anno) || new Date().getFullYear();
  const { supabase, me, t, lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const staff = can(me, STAFF), resp = can(me, RESP), admin = can(me, ADMIN);
  const { data: versions, error } = staff ? await supabase.from('budgets')
    .select('id, year, version, status, title, approval_ref, approved_at, created_at, based_on, demo').eq('year', year).order('version').returns<Budget[]>()
    : { data: [] as Budget[], error: null };
  const vs = versions ?? [];
  const approved = vs.find((b) => b.status === 'approved') ?? null;
  const draft = vs.find((b) => b.status === 'draft') ?? null;
  // si apre sulla versione in vigore (la bozza da «Apri la bozza» o subito dopo «Prepara una revisione»)
  const shown = vs.find((b) => b.id === sp.v) ?? approved ?? draft ?? vs[vs.length - 1] ?? null;
  const diffBase = shown?.status === 'draft' && approved ? approved : null;
  const [{ data: items }, { data: cats }, { data: groups }, { data: projects }, { data: cps }, { data: rate }, { data: prev }, { data: baseItems }] = staff ? await Promise.all([
    shown ? supabase.from('budget_items')
      .select('id, line_no, project_id, category_id, counterparty_id, description, qty, unit, unit_cost, currency, fx_rate, amount, amount_eur, notes')
      .eq('budget_id', shown.id).order('line_no').returns<Item[]>() : Promise.resolve({ data: [] as Item[] }),
    supabase.from('categories').select('id, code, name_it, name_fr, direction, active, group_id').order('direction', { ascending: false }).order('sort').returns<Cat[]>(),
    supabase.from('category_groups').select('id, code, name_it, name_fr, direction, sort').order('sort').returns<Grp[]>(),
    supabase.from('projects').select('id, name, active, kind').order('name').returns<Prj[]>(),
    supabase.from('counterparties').select('id, name, kind, active').order('name').limit(2000).returns<Cp[]>(),
    supabase.rpc('fx_rate_for', { p_date: `${year}-01-01` }),
    supabase.from('budgets').select('id').eq('year', year - 1).limit(1),
    diffBase ? supabase.from('budget_items').select('category_id, amount_eur').eq('budget_id', diffBase.id)
      .returns<{ category_id: string; amount_eur: string }[]>() : Promise.resolve({ data: null }),
  ]) : [{ data: [] as Item[] }, { data: [] as Cat[] }, { data: [] as Grp[] }, { data: [] as Prj[] }, { data: [] as Cp[] }, { data: null }, { data: [] }, { data: null }];
  const its = items ?? [];
  const catBy = new Map((cats ?? []).map((c) => [c.id, c]));
  const grpBy = new Map((groups ?? []).map((g) => [g.id, g]));
  const prjBy = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const cpBy = new Map((cps ?? []).map((c) => [c.id, c]));
  const CL = (c: { name_it: string; name_fr: string }) => (lang === 'fr' && c.name_fr ? c.name_fr : c.name_it);
  const dirOf = (i: { category_id: string }) => catBy.get(i.category_id)?.direction ?? 'out';
  const eur = (xs: { amount_eur: string }[]) => xs.reduce((s, i) => s + Number(i.amount_eur), 0);
  const totIn = eur(its.filter((i) => dirOf(i) === 'in')), totOut = eur(its.filter((i) => dirOf(i) === 'out'));
  const baseOut = eur((baseItems ?? []).filter((i) => dirOf(i) === 'out'));
  return {
    supabase, me, t, lang, L, year, staff, resp, admin, error, vs, approved, draft, shown, its, cats: cats ?? [], groups: groups ?? [], projects: projects ?? [],
    cps: cps ?? [], rate: rate == null ? null : Number(rate), hasPrev: (prev ?? []).length > 0, hasBase: baseItems != null, baseOut,
    catBy, grpBy, prjBy, cpBy, CL, dirOf, eur, totIn, totOut,
    m: (v: number | string) => money(v, 'EUR', lang),
    e0: (v: number) => money(Math.round(v), 'EUR', lang).replace(/,00(?=\s?€)/, ''),
    vLabel: (b: Budget) => (b.version === 1 ? L('Originale', 'Initial') : `${L('Revisione', 'Révision')} ${b.version - 1}`),
    stLabel: (s: Budget['status']) => (s === 'draft' ? L('Bozza', 'Brouillon') : s === 'approved' ? L('In vigore', 'En vigueur') : L('Superata', 'Remplacée')),
    // bozza: la scrivono i responsabili; versione in vigore: righe aggiunte, corrette o eliminate una per una
    // da un amministratore con il motivo (versione DEMO: basta un responsabile, senza motivo)
    editing: shown?.status === 'draft' && resp,
    amending: shown?.status === 'approved' && (admin || (Boolean(shown?.demo) && resp)),
    needReason: shown?.status === 'approved' && !shown?.demo,
  };
}
export type Ctx = Awaited<ReturnType<typeof loadBudget>>;

export function BudgetNotes({ c, sp }: { c: Ctx; sp: { ok?: string; err?: string; n?: string } }) {
  const { L } = c;
  const errText = sp.err ? (sp.err === 'missing' ? L('Scegli il codice e indica il costo unitario.', 'Choisissez le code et indiquez le coût unitaire.') : sp.err) : null;
  return (<>
    {sp.ok && <div className="note ok" role="status">{sp.ok === 'deleted' ? L(`Preventivo eliminato (${sp.n ?? 0} righe).`, `Budget supprimé (${sp.n ?? 0} lignes).`)
      : sp.ok === 'row_deleted' ? L('Riga eliminata.', 'Ligne supprimée.')
      : sp.ok === 'row' ? L(`Riga n. ${sp.n ?? ''} salvata.`, `Ligne n° ${sp.n ?? ''} enregistrée.`) : L('Salvato.', 'Enregistré.')}</div>}
    {errText && <div className="note err">{errText}</div>}
    {c.error && <div className="note err">{c.t('error_load')}: {c.error.message}</div>}
  </>);
}

// Nessuna versione per l'anno: cosa è il preventivo e come si comincia.
export function NoBudget({ c }: { c: Ctx }) {
  const { L, year } = c;
  return (
    <Panel pad title={L('Nessun preventivo per quest\'anno', 'Aucun budget pour cette année')}>
      <p className="muted" style={{ marginTop: 0 }}>{L(
        'Il preventivo si scrive riga per riga: per ogni riga il codice (di uscita o di entrata), il progetto, la descrizione, la quantità, l\'unità, il costo unitario e, se serve, il donatore o il fornitore. Contiene sia le entrate sia le uscite, come il rendiconto per cassa. Si approva con gli estremi della delibera; le versioni precedenti restano consultabili.',
        'Le budget s\'écrit ligne par ligne : pour chaque ligne le code (de dépense ou de recette), le projet, la description, la quantité, l\'unité, le coût unitaire et, si besoin, le donateur ou le fournisseur. Il contient les recettes et les dépenses, comme le compte rendu de caisse. Il s\'approuve avec la référence de la délibération ; les versions précédentes restent consultables.')}</p>
      {c.resp && (
        <div className="row-actions">
          <form action={draftBudget}><input type="hidden" name="year" value={year} />
            <button className="btn primary" type="submit">{L('Nuovo preventivo vuoto', 'Nouveau budget vide')}</button></form>
          {c.hasPrev && (
            <form action={draftBudget}><input type="hidden" name="year" value={year} /><input type="hidden" name="from" value={year - 1} />
              <button className="btn" type="submit">{L(`Copia dal ${year - 1}`, `Copier de ${year - 1}`)}</button></form>
          )}
        </div>
      )}
    </Panel>
  );
}

// Quattro riquadri nel disegno di Cairn, calcolati sulle righe della versione mostrata.
export function BudgetTiles({ c }: { c: Ctx }) {
  const { L, e0, its, groups, catBy, CL, totIn, totOut, dirOf, eur } = c;
  const byGroup = (d: 'in' | 'out') => groups.filter((g) => g.direction === d)
    .map((g) => ({ g, v: eur(its.filter((i) => catBy.get(i.category_id)?.group_id === g.id)) })).filter((x) => x.v > 0);
  const gIn = byGroup('in'), gOut = byGroup('out');
  const nIn = its.filter((i) => dirOf(i) === 'in').length, nOut = its.length - nIn;
  const top = (xs: { g: Grp; v: number }[]) => [...xs].sort((a, b) => b.v - a.v)[0];
  const rows = (n: number) => (n === 1 ? L('1 riga', '1 ligne') : L(`${n} righe`, `${n} lignes`));
  const pc = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '–');
  const net = totIn - totOut;
  // «progetti» = centri di costo veri; le righe senza progetto o su un centro di tipo «struttura» sono spese generali
  const isPrj = (id: string | null) => Boolean(id) && c.projects.find((p) => p.id === id)?.kind !== 'structure';
  const prjOut = eur(its.filter((i) => dirOf(i) === 'out' && isPrj(i.project_id)));
  const nPrj = new Set(its.filter((i) => isPrj(i.project_id)).map((i) => i.project_id)).size;
  const tile = (label: string, tot: number, gs: { g: Grp; v: number }[], color: string, n: number) => (
    <div className="kpi">
      <div className="l">{label}</div>
      <div className="v num">{e0(tot)}</div>
      {gs.length > 0 && <><Viz.Cols vals={gs.map((x) => x.v)} colors={gs.map(() => color)} tip={gs.map((x) => `${x.g.code} · ${CL(x.g)}: ${e0(x.v)}`).join('\n')} />
        <div className="vzl"><span>{top(gs)!.g.code} · {CL(top(gs)!.g)}</span><span>{pc(top(gs)!.v, tot)}</span></div></>}
      <div className="s">{n ? `${rows(n)} · ${gs.length === 1 ? L('1 gruppo di voci', '1 groupe de postes') : L(`${gs.length} gruppi di voci`, `${gs.length} groupes de postes`)}` : L('nessuna riga', 'aucune ligne')}</div>
    </div>);
  return (
    <div className="kpis dk bqk">
      {tile(L('Entrate previste', 'Recettes prévues'), totIn, gIn, C_INC, nIn)}
      {tile(L('Uscite previste', 'Dépenses prévues'), totOut, gOut, C_EXP, nOut)}
      <div className="kpi">
        <div className="l">{L('Saldo previsto', 'Solde prévu')}</div>
        <div className={`v num ${net < -0.005 ? 'neg' : 'pos'}`}>{e0(net)}</div>
        {totOut > 0 && <><Viz.Stack segs={[{ v: Math.min(totIn, totOut), c: C_NET }, { v: Math.max(0, totOut - totIn), c: 'var(--tax)' }]} max={totOut}
          tip={`${L('Entrate', 'Recettes')}: ${e0(totIn)}\n${L('Uscite', 'Dépenses')}: ${e0(totOut)}`} />
          <div className="vzl"><span>{L('uscite coperte', 'dépenses couvertes')}</span><span>{pc(Math.min(totIn, totOut), totOut)}</span></div></>}
        <div className="s">{net < -0.005 ? L('disavanzo da coprire', 'déficit à couvrir') : net > 0.005 ? L('avanzo previsto', 'excédent prévu') : L('entrate e uscite in pareggio', 'recettes et dépenses à l\'équilibre')}</div>
      </div>
      <div className="kpi">
        {totOut > 0 && <Viz.Ring p={prjOut / totOut} color={C_INC} tip={`${L('Progetti', 'Projets')}: ${e0(prjOut)}\n${L('Struttura generale', 'Structure générale')}: ${e0(totOut - prjOut)}`} />}
        <div className="l">{L('Destinato ai progetti', 'Affecté aux projets')}</div>
        <div className="v num">{e0(prjOut)}</div>
        {totOut > 0 && <><Viz.Stack segs={[{ v: prjOut, c: C_INC }, { v: totOut - prjOut, c: 'var(--band)' }]} max={totOut}
          tip={`${L('Progetti', 'Projets')}: ${e0(prjOut)}\n${L('Struttura generale', 'Structure générale')}: ${e0(totOut - prjOut)}`} />
          <div className="vzl"><span>{L('delle uscite', 'des dépenses')}</span><span>{pc(prjOut, totOut)}</span></div></>}
        <div className="s">{nPrj === 1 ? L('1 progetto', '1 projet') : L(`${nPrj} progetti`, `${nPrj} projets`)} · {L('struttura', 'structure')} {e0(totOut - prjOut)}</div>
      </div>
    </div>
  );
}

// Barra della versione: quale si vede, quale è in vigore, cosa cambia; azioni solo quando servono.
export function VersionBar({ c, base }: { c: Ctx; base: string }) {
  const { L, year, vs, shown, approved, draft, resp, admin, vLabel, stLabel, e0, its } = c;
  if (!shown) return null;
  const href = (v: string) => `${base}?anno=${year}&v=${v}`;
  const draftOut = c.totOut;
  return (
    <section className="panel bv-bar">
      <div className="bv-l">
        <span className={`chip ${shown.status === 'approved' ? 'ok' : shown.status === 'draft' ? 'warn' : ''}`}>{stLabel(shown.status)}</span>
        <b>{L('Preventivo', 'Budget')} {year} · {vLabel(shown)}</b>{shown.demo && <span className="chip warn">DEMO</span>}
        <span className="muted bv-s">
          {shown.status === 'approved' ? (shown.approval_ref ?? '')
            : approved ? <>{L('in vigore', 'en vigueur')}: {vLabel(approved)}{approved.approval_ref ? ` · ${approved.approval_ref}` : ''}
              {shown.status === 'draft' && c.hasBase && Math.abs(draftOut - c.baseOut) > 0.5 ? <> · {L('uscite', 'dépenses')} <b className="num">{draftOut - c.baseOut > 0 ? '+' : '−'}{e0(Math.abs(draftOut - c.baseOut))}</b></> : null}</> : L('non ancora approvato', 'pas encore approuvé')}
        </span>
      </div>
      <div className="bv-r">
        {draft && shown.id !== draft.id && <Link className="btn small" href={href(draft.id)}>{L('Apri la bozza', 'Ouvrir le brouillon')}</Link>}
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
                  <Link href={href(b.id)}>
                    <span className="v-name"><b>{vLabel(b)}</b>{b.title && <span className="v-title">{b.title}</span>}</span>
                    <span className="v-chips"><span className={`chip ${b.status === 'approved' ? 'ok' : b.status === 'draft' ? 'warn' : ''}`}>{stLabel(b.status)}</span>{b.demo && <span className="chip warn">DEMO</span>}</span>
                  </Link>
                  <span className="muted">{b.approved_at ? `${L('Approvato il', 'Approuvé le')} ${dateTime(b.approved_at, c.lang)} · ${b.approval_ref}` : `${L('Creato il', 'Créé le')} ${date(b.created_at)}`}</span>
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
  );
}
