import Link from 'next/link';
import { STAFF, can, requireMe } from '@/lib/session';
import { date, money } from '@/lib/format';
import { DL_CAT, THRESHOLDS, ruleItems, type DlCat } from '@/lib/deadline-rules';
import { ErrorNote, PageHead, Panel } from '@/components/Page';
import { Ico } from '@/components/Ui';
import { CIcon } from '@/components/CIcon';
import { saveDeadline, setDeadlineStatus } from './actions';

export const dynamic = 'force-dynamic';

type D = { id: string; rule_key: string | null; title: string; category: DlCat; due_date: string; amount: string | null; currency: string | null;
  project_id: string | null; owner_id: string | null; priority: 'low' | 'normal' | 'high'; status: 'open' | 'done' | 'cancelled'; repeat: string;
  notes: string | null; done_at: string | null };
type Item = { key: string; id?: string; rule_key?: string; date: string; cat: DlCat; title: string; sub: string; amount?: number; currency?: string;
  status: 'open' | 'done' | 'cancelled'; priority: 'low' | 'normal' | 'high'; applies: boolean; href?: string; auto?: boolean; owner?: string | null; project?: string | null };

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const daysTo = (d: string) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 864e5);

// Scadenziario: scadenze a mano (pagamenti, incassi, rendicontazioni), adempimenti ricorrenti ETS e promemoria
// calcolati dai dati (rimborsi da pagare, mesi da chiudere, finanziamenti in scadenza). Vista elenco e calendario.
export default async function Deadlines({ searchParams }: {
  searchParams: Promise<{ periodo?: string; tipo?: string; vista?: string; mese?: string; edit?: string; nuovo?: string; ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const staff = can(me, STAFF), writer = me?.role !== 'read_only';
  const td = today(), Y = Number(td.slice(0, 4));
  const per = ['late', '14', '30', '90', 'all'].includes(sp.periodo ?? '') ? sp.periodo! : '90';
  const tipo = (Object.keys(DL_CAT) as DlCat[]).includes(sp.tipo as DlCat) ? sp.tipo as DlCat : '';
  const view = sp.vista === 'calendario' ? 'cal' : 'list';
  const month = /^\d{4}-\d{2}$/.test(sp.mese ?? '') ? sp.mese! : td.slice(0, 7);

  const [{ data: saved, error }, { data: projects }, { data: users }, inc0, inc1, inc2, drafts, due, unver, periods, rate, grants, adv, bud] = await Promise.all([
    supabase.from('deadlines').select('id, rule_key, title, category, due_date, amount, currency, project_id, owner_id, priority, status, repeat, notes, done_at')
      .gte('due_date', `${Y - 1}-01-01`).order('due_date').returns<D[]>(),
    supabase.from('projects').select('id, name').eq('active', true).order('name'),
    supabase.rpc('user_directory'),
    staff ? supabase.rpc('income_of_year', { p_year: Y - 2 }) : Promise.resolve({ data: 0 }),
    staff ? supabase.rpc('income_of_year', { p_year: Y - 1 }) : Promise.resolve({ data: 0 }),
    staff ? supabase.rpc('income_of_year', { p_year: Y }) : Promise.resolve({ data: 0 }),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('status', 'draft').is('reimb_status', null),
    supabase.from('movements').select('amount_eur').eq('reimb_status', 'due'),
    staff ? supabase.from('movements').select('id', { count: 'exact', head: true }).eq('status', 'recorded') : Promise.resolve({ count: 0 }),
    supabase.from('periods').select('year, month, closed_at').not('closed_at', 'is', null).order('year', { ascending: false }).order('month', { ascending: false }).limit(1),
    supabase.rpc('fx_rate_for', { p_date: td }),
    supabase.from('grants').select('id, title, end_date').eq('status', 'active').not('end_date', 'is', null),
    staff ? supabase.rpc('advance_summary') : Promise.resolve({ data: [] }),
    staff ? supabase.from('budgets').select('id, status').eq('year', Y + 1) : Promise.resolve({ data: [] }),
  ]);
  const inc = (y: number) => Number((y === Y - 2 ? inc0.data : y === Y - 1 ? inc1.data : inc2.data) ?? 0);
  const prjBy = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const userBy = new Map(((users ?? []) as { id: string; full_name: string | null; active: boolean }[]).map((u) => [u.id, u.full_name ?? '–']));
  const sv = saved ?? [];
  const byRule = new Map(sv.filter((d) => d.rule_key).map((d) => [d.rule_key!, d]));

  // 1) adempimenti ricorrenti (le date spostate o segnate fatte vengono dalla riga salvata)
  // come nel Gestionale: gli adempimenti dell'app non segnati restano in elenco fino a 120 giorni dopo la data
  const items: Item[] = staff ? ruleItems([Y - 1, Y, Y + 1], inc).filter((r) => byRule.has(r.rule_key) || r.date >= addDays(td, -120)).map((r) => {
    const s = byRule.get(r.rule_key);
    return { key: r.rule_key, id: s?.id, rule_key: r.rule_key, date: s?.due_date ?? r.date, cat: r.cat, title: L(r.it, r.fr), sub: L(r.dit, r.dfr),
      status: s?.status ?? 'open', priority: s?.priority ?? 'normal', applies: r.applies, owner: s?.owner_id ?? null };
  }) : [];
  // 2) scadenze inserite a mano
  for (const d of sv.filter((x) => !x.rule_key)) items.push({ key: d.id, id: d.id, date: d.due_date, cat: d.category, title: d.title, sub: d.notes ?? '',
    amount: d.amount ? Number(d.amount) : undefined, currency: d.currency ?? undefined, status: d.status, priority: d.priority, applies: true,
    owner: d.owner_id, project: d.project_id ? prjBy.get(d.project_id) ?? null : null });
  // 3) promemoria calcolati dai dati: non si segnano fatti, spariscono quando il dato è a posto
  const auto = (key: string, dt: string, cat: DlCat, title: string, sub: string, href: string, amount?: number) =>
    items.push({ key, date: dt, cat, title, sub, href, status: 'open', priority: 'high', applies: true, auto: true, amount, currency: amount ? 'EUR' : undefined });
  const dueList = due.data ?? [];
  if (dueList.length) auto('a-reimb', td, 'pay', L(`Rimborsi da pagare: ${dueList.length}`, `Remboursements à payer : ${dueList.length}`),
    L('Spese anticipate di tasca propria da rimborsare.', 'Dépenses avancées sur fonds propres à rembourser.'), '/rimborsi', dueList.reduce((s, m) => s + Number(m.amount_eur ?? 0), 0));
  if ((drafts.count ?? 0) > 0) auto('a-drafts', td, 'doc', L(`Movimenti da completare: ${drafts.count}`, `Mouvements à compléter : ${drafts.count}`),
    L('Bozze che non contano nei saldi finché non si registrano.', 'Brouillons hors soldes tant qu\'ils ne sont pas enregistrés.'), '/movimenti?stato=draft');
  if ((unver.count ?? 0) > 0) auto('a-verify', td, 'int', L(`Movimenti da verificare: ${unver.count}`, `Mouvements à vérifier : ${unver.count}`),
    L('Controllo a quattro occhi prima della chiusura del mese.', 'Contrôle à quatre yeux avant la clôture du mois.'), '/verifica');
  const lastClosed = (periods.data ?? [])[0];
  const prevMonth = (() => { const d = new Date(`${td}T00:00:00Z`); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
  const closedKey = lastClosed ? `${lastClosed.year}-${String(lastClosed.month).padStart(2, '0')}` : '';
  if (staff && closedKey < prevMonth) auto('a-close', `${td.slice(0, 7)}-15`, 'int', L(`Chiudere il mese ${prevMonth.split('-').reverse().join('/')}`, `Clôturer le mois ${prevMonth.split('-').reverse().join('/')}`),
    L('Dopo giustificativi, verifica di cassa e tasso del mese.', 'Après justificatifs, contrôle de caisse et taux du mois.'), '/admin/periodi');
  if (!rate.data) auto('a-rate', td, 'int', L('Manca il tasso di cambio del mese', 'Taux de change du mois manquant'), L('Serve per le spese in ariary.', 'Nécessaire pour les dépenses en ariary.'), '/cambi');
  for (const g of grants.data ?? []) if (g.end_date && daysTo(g.end_date) <= 90 && daysTo(g.end_date) >= -30)
    auto(`a-g-${g.id}`, g.end_date, 'prj', L(`Fine del finanziamento: ${g.title}`, `Fin du financement : ${g.title}`),
      L('Verifica che tutte le spese siano registrate e giustificate; prepara il rendiconto.', 'Vérifiez que toutes les dépenses sont saisies et justifiées ; préparez le rapport.'), `/finanziamenti/${g.id}`);
  for (const a of (adv.data ?? []) as { account_id: string; holder: string; balance: string; open_since: string | null; aut_to_sign: number }[]) {
    if (Number(a.balance) > 0 && a.open_since && daysTo(a.open_since) < -30) auto(`a-adv-${a.account_id}`, td, 'doc', L(`Anticipo da giustificare: ${a.holder}`, `Avance à justifier : ${a.holder}`),
      L(`Aperto dal ${date(a.open_since)}.`, `Ouverte depuis le ${date(a.open_since)}.`), '/anticipi');
    if (a.aut_to_sign > 0) auto(`a-aut-${a.account_id}`, td, 'doc', L(`Autocertificazioni da firmare: ${a.holder} (${a.aut_to_sign})`, `Attestations à signer : ${a.holder} (${a.aut_to_sign})`), '', '/anticipi');
  }
  if (staff && Number(td.slice(5, 7)) >= 11 && !(bud.data ?? []).length) auto('a-budget', `${Y}-12-15`, 'int', L(`Preparare il preventivo ${Y + 1}`, `Préparer le budget ${Y + 1}`),
    L('Da approvare prima dell\'inizio dell\'esercizio.', 'À approuver avant le début de l\'exercice.'), `/preventivo?anno=${Y + 1}`);

  const inPeriod = (i: Item) => per === 'all' ? i.date >= `${Y - 1}-01-01`
    : per === 'late' ? i.status === 'open' && i.date < td
      : (i.status === 'open' && i.date < td) || (i.date >= td && i.date <= addDays(td, Number(per)));
  const list = items.filter((i) => (!tipo || i.cat === tipo) && i.applies && (view === 'cal' || inPeriod(i))).sort((a, b) => a.date.localeCompare(b.date) || (b.priority === 'high' ? 1 : -1));
  const late = items.filter((i) => i.applies && i.status === 'open' && i.date < td).length;
  const soon = items.filter((i) => i.applies && i.status === 'open' && i.date >= td && i.date <= addDays(td, 14)).length;
  const tag = (i: Item) => {
    if (i.status === 'done') return <span className="chip ok">{L('Fatta', 'Faite')}</span>;
    if (i.status === 'cancelled') return <span className="chip">{L('Annullata', 'Annulée')}</span>;
    const n = daysTo(i.date);
    return n < 0 ? <span className="chip bad">{L(`Scaduta da ${-n} gg`, `En retard de ${-n} j`)}</span> : n === 0 ? <span className="chip bad">{L('Oggi', 'Aujourd\'hui')}</span>
      : n <= 14 ? <span className="chip warn">{L(`Tra ${n} gg`, `Dans ${n} j`)}</span> : <span className="chip">{L(`Tra ${n} gg`, `Dans ${n} j`)}</span>;
  };
  const href = (q: Record<string, string>) => { const u = new URLSearchParams({ periodo: per, ...(tipo ? { tipo } : {}), ...(view === 'cal' ? { vista: 'calendario', mese: month } : {}), ...q });
    for (const [k, v] of [...u.entries()]) if (!v) u.delete(k); return `/scadenze?${u}`; };
  const edit = sv.find((d) => d.id === sp.edit && !d.rule_key);
  const showForm = writer && (Boolean(edit) || sp.nuovo === '1');
  const statusForm = (i: Item, st: 'done' | 'open') => (
    <form action={setDeadlineStatus} style={{ display: 'inline' }}>
      {i.id && <input type="hidden" name="id" value={i.id} />}
      {!i.id && i.rule_key && <><input type="hidden" name="rule_key" value={i.rule_key} /><input type="hidden" name="title" value={i.title} />
        <input type="hidden" name="category" value={i.cat} /><input type="hidden" name="due_date" value={i.date} /></>}
      <input type="hidden" name="status" value={st} />
      <button className="btn small" type="submit">{st === 'done' ? L('Fatta', 'Faite') : L('Riapri', 'Rouvrir')}</button>
    </form>
  );

  // calendario del mese: 6 settimane da lunedì
  const [cy, cm] = month.split('-').map(Number);
  const first = new Date(Date.UTC(cy, cm - 1, 1)), start = new Date(first); start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const daysGrid = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setUTCDate(start.getUTCDate() + i); return d.toISOString().slice(0, 10); });
  const prevM = new Date(Date.UTC(cy, cm - 2, 1)).toISOString().slice(0, 7), nextM = new Date(Date.UTC(cy, cm, 1)).toISOString().slice(0, 7);
  const monthName = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  const wd = lang === 'fr' ? ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'] : ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

  return (
    <div className="stack">
      <PageHead title={L('Scadenze', 'Échéances')}>
        <a className="btn" href="/api/v1/scadenze.ics"><Ico name="download" />{L('Calendario (.ics)', 'Agenda (.ics)')}</a>
        {writer && <Link className="btn primary" href={href({ nuovo: '1' })}><Ico name="plus" />{L('Nuova scadenza', 'Nouvelle échéance')}</Link>}
      </PageHead>
      {sp.ok && <div className="note ok" role="status">{L('Salvato.', 'Enregistré.')}</div>}
      {sp.err && <div className="note err">{sp.err === 'missing' ? L('Indica descrizione e data.', 'Indiquez description et date.') : sp.err}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />

      <div className="h-tiles s-tiles">
        <div className={`htile${late ? ' t-warn' : ''}`}>
          <span className="ht-l"><CIcon name="alert" size={14} />{L('Scadute', 'En retard')}</span>
          <b className={`num${late ? ' neg' : ''}`}>{late}</b><small>{late ? L('da chiudere subito', 'à traiter tout de suite') : L('nessuna in ritardo', 'aucune en retard')}</small>
        </div>
        <div className={`htile${soon ? ' t-do' : ''}`}>
          <span className="ht-l"><CIcon name="cal" size={14} />{L('Nei prossimi 14 giorni', 'Dans les 14 prochains jours')}</span>
          <b className="num">{soon}</b><small>{L('da preparare', 'à préparer')}</small>
        </div>
        {staff && <div className="htile">
          <span className="ht-l"><CIcon name="trend" size={14} />{L(`Entrate registrate ${Y}`, `Recettes enregistrées ${Y}`)}</span>
          <b className="num amt-in">{money(inc(Y), 'EUR', lang)}</b><small>{Y - 1}: {money(inc(Y - 1), 'EUR', lang)} · {L('servono per le soglie ETS', 'servent aux seuils ETS')}</small>
        </div>}
      </div>

      {showForm && (
        <Panel title={edit ? L('Modifica la scadenza', 'Modifier l\'échéance') : L('Nuova scadenza', 'Nouvelle échéance')} pad>
          <form action={saveDeadline} className="fgrid" key={edit?.id ?? 'new'}>
            {edit && <input type="hidden" name="id" value={edit.id} />}
            <div className="field span2"><label htmlFor="dl-t">{L('Descrizione', 'Description')}</label>
              <input className="input" id="dl-t" name="title" required minLength={2} maxLength={200} defaultValue={edit?.title ?? ''}
                     placeholder={L('Es. pagare l\'affitto della sede, incasso tranche finanziatore', 'Ex. payer le loyer, encaissement tranche bailleur')} /></div>
            <div className="field"><label htmlFor="dl-d">{L('Data', 'Date')}</label>
              <input className="input" id="dl-d" name="due_date" type="date" required defaultValue={edit?.due_date ?? ''} /></div>
            <div className="field"><label htmlFor="dl-c">{L('Tipo', 'Type')}</label>
              <select className="input" id="dl-c" name="category" defaultValue={edit?.category ?? 'pay'}>
                {(Object.keys(DL_CAT) as DlCat[]).map((k) => <option key={k} value={k}>{L(...DL_CAT[k])}</option>)}</select></div>
            <div className="field"><label htmlFor="dl-a">{L('Importo (facoltativo)', 'Montant (facultatif)')}</label>
              <input className="input num" id="dl-a" name="amount" inputMode="decimal" defaultValue={edit?.amount ? String(Number(edit.amount)).replace('.', ',') : ''} /></div>
            <div className="field"><label htmlFor="dl-cur">{L('Valuta', 'Devise')}</label>
              <select className="input" id="dl-cur" name="currency" defaultValue={edit?.currency ?? 'EUR'}><option>EUR</option><option>MGA</option></select></div>
            <div className="field"><label htmlFor="dl-p">{L('Progetto', 'Projet')}</label>
              <select className="input" id="dl-p" name="project_id" defaultValue={edit?.project_id ?? ''}><option value="">–</option>
                {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="field"><label htmlFor="dl-o">{L('Responsabile', 'Responsable')}</label>
              <select className="input" id="dl-o" name="owner_id" defaultValue={edit?.owner_id ?? me?.id ?? ''}><option value="">–</option>
                {((users ?? []) as { id: string; full_name: string | null; active: boolean }[]).filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></div>
            <div className="field"><label htmlFor="dl-pr">{L('Priorità', 'Priorité')}</label>
              <select className="input" id="dl-pr" name="priority" defaultValue={edit?.priority ?? 'normal'}>
                <option value="low">{L('Bassa', 'Basse')}</option><option value="normal">{L('Normale', 'Normale')}</option><option value="high">{L('Alta', 'Haute')}</option></select></div>
            <div className="field"><label htmlFor="dl-r">{L('Si ripete', 'Se répète')}</label>
              <select className="input" id="dl-r" name="repeat" defaultValue={edit?.repeat ?? 'none'}>
                <option value="none">{L('No', 'Non')}</option><option value="monthly">{L('Ogni mese', 'Chaque mois')}</option><option value="yearly">{L('Ogni anno', 'Chaque année')}</option></select></div>
            <div className="field span2"><label htmlFor="dl-n">{L('Note', 'Notes')}</label>
              <input className="input" id="dl-n" name="notes" maxLength={1000} defaultValue={edit?.notes ?? ''} /></div>
            <div className="span2 row-actions"><button className="btn primary" type="submit">{L('Salva', 'Enregistrer')}</button>
              <Link className="btn ghost" href={href({})}>{L('Annulla', 'Annuler')}</Link></div>
          </form>
        </Panel>
      )}

      <div className="segs" role="tablist" aria-label={L('Vista', 'Vue')}>
        <Link role="tab" aria-selected={view === 'list'} href={`/scadenze?periodo=${per}${tipo ? `&tipo=${tipo}` : ''}`}>{L('Elenco', 'Liste')}</Link>
        <Link role="tab" aria-selected={view === 'cal'} href={`/scadenze?vista=calendario&mese=${month}${tipo ? `&tipo=${tipo}` : ''}`}>{L('Calendario', 'Calendrier')}</Link>
      </div>
      <nav className="quick" aria-label={L('Filtri', 'Filtres')}>
        {view === 'list' && ([['late', L('Scadute', 'En retard')], ['14', L('14 giorni', '14 jours')], ['30', L('30 giorni', '30 jours')], ['90', L('90 giorni', '90 jours')], ['all', L('Tutte', 'Toutes')]] as const)
          .map(([k, l]) => <Link key={k} href={href({ periodo: k })} aria-current={per === k ? 'true' : undefined}>{l}</Link>)}
        <span className="qsep" aria-hidden="true" />
        <Link href={href({ tipo: '' })} aria-current={!tipo ? 'true' : undefined}>{L('Tutti i tipi', 'Tous les types')}</Link>
        {(Object.keys(DL_CAT) as DlCat[]).map((k) => <Link key={k} href={href({ tipo: k })} aria-current={tipo === k ? 'true' : undefined}>{L(...DL_CAT[k])}</Link>)}
      </nav>

      {view === 'list' ? (
        <Panel>
          {list.length === 0 ? <div className="panel-b muted">{L('Nessuna scadenza nel periodo.', 'Aucune échéance sur la période.')}</div> : (
            <ul className="dl">
              {list.map((i) => (
                <li key={i.key} className={`${i.status !== 'open' ? 'done' : ''} p-${i.priority}`}>
                  <div className="dl-date num"><b>{date(i.date)}</b>{tag(i)}</div>
                  <div className="dl-body">
                    <div className="dl-t">{i.href ? <Link href={i.href}>{i.title}</Link> : i.title}</div>
                    <div className="muted dl-s">{[L(...DL_CAT[i.cat]), i.project, i.owner ? userBy.get(i.owner) : null, i.sub].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="dl-amt num">{i.amount ? money(i.amount, i.currency ?? 'EUR', lang) : ''}</div>
                  <div className="dl-act">
                    {!i.auto && writer && (i.status === 'open' ? statusForm(i, 'done') : statusForm(i, 'open'))}
                    {!i.auto && !i.rule_key && writer && i.id && <Link className="btn small ghost" href={href({ edit: i.id })} aria-label={L('Modifica', 'Modifier')}>✎</Link>}
                    {i.auto && <span className="chip">{L('dai dati', 'des données')}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : (
        <section className="panel">
          <div className="panel-h cal-h">
            <Link className="btn small" href={href({ mese: prevM })} aria-label={L('Mese precedente', 'Mois précédent')}>←</Link>
            <h2 style={{ textTransform: 'capitalize' }}>{monthName}</h2>
            <Link className="btn small" href={href({ mese: nextM })} aria-label={L('Mese successivo', 'Mois suivant')}>→</Link>
          </div>
          <div className="cal" role="grid">
            {wd.map((w) => <div key={w} className="cal-wd" role="columnheader">{w}</div>)}
            {daysGrid.map((d) => {
              const its = list.filter((i) => i.date === d);
              return (
                <div key={d} className={`cal-d ${d.slice(0, 7) !== month ? 'out' : ''} ${d === td ? 'today' : ''}`} role="gridcell">
                  <span className="cal-n">{Number(d.slice(8))}</span>
                  {its.slice(0, 3).map((i) => <span key={i.key} className={`cal-i ${i.status !== 'open' ? 'done' : i.date < td ? 'late' : ''}`} title={i.title}>{i.title}</span>)}
                  {its.length > 3 && <span className="cal-more">+{its.length - 3}</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {staff && (
        <Panel title={L(`Soglie di entrata ${Y}`, `Seuils de recettes ${Y}`)} pad>
          <div className="thr">
            {THRESHOLDS.map((th) => { const v = inc(Y), p = Math.min(100, (v / th.v) * 100); return (
              <div key={th.v}><div className="thr-r"><span>{L(th.it, th.fr)}</span><span className="muted num">{v > th.v ? L('superata', 'dépassée') : `${Math.round(p)}%`}</span></div>
                <span className="meter" aria-hidden="true"><i style={{ width: `${p}%` }} /></span></div>
            ); })}
          </div>
        </Panel>
      )}
    </div>
  );
}
