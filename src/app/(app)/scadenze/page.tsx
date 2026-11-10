import Link from 'next/link';
import { STAFF, can, requireMe } from '@/lib/session';
import { date, money } from '@/lib/format';
import { DL_CAT, THRESHOLDS, ruleItems, type DlCat } from '@/lib/deadline-rules';
import { ErrorNote, PageHead, Panel } from '@/components/Page';
import { Ico } from '@/components/Ui';
import { CIcon } from '@/components/CIcon';
import { FilterBar } from '@/components/FilterBar';
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
  searchParams: Promise<{ periodo?: string; tipo?: string; vista?: string; mese?: string; edit?: string; nuovo?: string; ok?: string; err?: string; apri?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const staff = can(me, STAFF), writer = me?.role !== 'read_only';
  const td = today(), Y = Number(td.slice(0, 4));
  const per = ['late', '14', '30', '90', 'all'].includes(sp.periodo ?? '') ? sp.periodo! : '90';
  const tipo = (Object.keys(DL_CAT) as DlCat[]).includes(sp.tipo as DlCat) ? sp.tipo as DlCat : '';
  const view: string = 'list'; // calendario sempre in alto, elenco sotto (scelta 4A)
  const month = /^\d{4}-\d{2}$/.test(sp.mese ?? '') ? sp.mese! : td.slice(0, 7);

  const [{ data: saved, error }, { data: projects }, { data: users }, inc0, inc1, inc2, drafts, due, unver, periods, rate, grants, adv, bud, areq] = await Promise.all([
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
    supabase.from('advance_requests').select('id, status, report_by, use_date, accounts(holder)').in('status', ['requested', 'authorized', 'delivered']),
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
  // anticipi della procedura: da autorizzare, da consegnare, da giustificare (avviso dalla scadenza, 15 o 30 giorni dopo l'uso)
  for (const q of (areq.data ?? []) as unknown as { id: string; status: string; report_by: string; use_date: string; accounts: { holder: string | null } | null }[]) {
    const h = q.accounts?.holder ?? '';
    if (q.status === 'requested') auto(`a-areq-${q.id}`, q.use_date < td ? td : q.use_date, 'int', L(`Anticipo da autorizzare: ${h}`, `Avance à autoriser : ${h}`), L('Richiesta in attesa di un responsabile o amministratore.', 'Demande en attente d’un responsable ou administrateur.'), '/anticipi');
    else if (q.status === 'authorized') auto(`a-areq-${q.id}`, q.use_date < td ? td : q.use_date, 'int', L(`Anticipo da consegnare: ${h}`, `Avance à remettre : ${h}`), L('Autorizzato, manca la consegna dalla cassa.', 'Autorisée, remise depuis la caisse à faire.'), '/anticipi');
    else auto(`a-areq-${q.id}`, q.report_by, 'doc', L(`Giustificare l’anticipo: ${h}`, `Justifier l’avance : ${h}`), L('Spese e giustificativi entro questa data, poi la chiusura.', 'Dépenses et justificatifs avant cette date, puis la clôture.'), '/anticipi');
  }
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
  const sel = sp.apri ? items.find((x) => x.key === sp.apri) : undefined;
  const selDay = sp.apri?.startsWith('day:') ? sp.apri.slice(4) : null;
  const dayItems = selDay ? items.filter((i) => i.applies && i.date === selDay && (!tipo || i.cat === tipo)) : [];
  const late = items.filter((i) => i.applies && i.status === 'open' && i.date < td).length;
  const soonL = items.filter((i) => i.applies && i.status === 'open' && i.date >= td && i.date <= addDays(td, 14)).sort((a, b) => a.date.localeCompare(b.date));
  const soon = soonL.length;
  const lateL = items.filter((i) => i.applies && i.status === 'open' && i.date < td).sort((a, b) => b.date.localeCompare(a.date));
  // importanza (scelta 4A): critica = sanzioni (fiscali, RUNTS/ETS); alta = finanziatori o priorità alta; normale = pagamenti e incassi; promemoria = il resto
  const imp = (i: Item): 'c' | 'a' | 'n' | 'p' | 'f' => i.status !== 'open' ? 'f' : i.cat === 'fisc' || i.cat === 'ets' ? 'c' : i.cat === 'prj' || (i.priority === 'high' && !i.auto) ? 'a' : i.cat === 'pay' || i.cat === 'inc' ? 'n' : 'p';
  const IMP: [ReturnType<typeof imp>, string, string][] = [['c', 'critica (sanzioni)', 'critique (sanctions)'], ['a', 'alta (finanziatori)', 'haute (bailleurs)'],
    ['n', 'normale (pagamenti)', 'normale (paiements)'], ['p', 'promemoria', 'rappel'], ['f', 'fatta', 'faite']];
  const fxr = Number((rate.data as number | null) ?? 0);
  const toPay = items.filter((i) => i.applies && i.status === 'open' && i.cat === 'pay' && i.amount && i.date <= addDays(td, 30));
  const toPayEur = toPay.reduce((s, i) => s + (i.currency === 'MGA' ? (fxr ? i.amount! / fxr : 0) : i.amount!), 0);
  const calItems = items.filter((i) => i.applies && (!tipo || i.cat === tipo));
  const dm = (d: string) => d.slice(8) + '/' + d.slice(5, 7);
  const MS = lang === 'fr' ? ['JANV', 'FÉVR', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'] : ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
  // soglie ETS su un righello logaritmico, con la stima di fine anno al ritmo di oggi
  const dayOfYear = Math.max(1, Math.round((Date.parse(`${td}T00:00:00Z`) - Date.UTC(Y, 0, 1)) / 864e5) + 1);
  const est = inc(Y) * (365 / dayOfYear);
  const lmin = Math.log10(20000), lmax = Math.log10(1500000);
  const pos = (v: number) => Math.max(0, Math.min(100, ((Math.log10(Math.max(v, 20000)) - lmin) / (lmax - lmin)) * 100));
  const k = (v: number) => v >= 1e6 ? `${(v / 1e6).toLocaleString(lang === 'fr' ? 'fr-FR' : 'it-IT')}M` : `${Math.round(v / 1000)}k`;
  const tag = (i: Item) => {
    if (i.status === 'done') return <span className="chip ok">{L('Fatta', 'Faite')}</span>;
    if (i.status === 'cancelled') return <span className="chip">{L('Annullata', 'Annulée')}</span>;
    const n = daysTo(i.date);
    return n < 0 ? <span className="chip bad">{L(`Scaduta da ${-n} gg`, `En retard de ${-n} j`)}</span> : n === 0 ? <span className="chip bad">{L('Oggi', 'Aujourd\'hui')}</span>
      : n <= 14 ? <span className="chip warn">{L(`Tra ${n} gg`, `Dans ${n} j`)}</span> : <span className="chip">{L(`Tra ${n} gg`, `Dans ${n} j`)}</span>;
  };
  const href = (q: Record<string, string>) => { const u = new URLSearchParams({ periodo: per, ...(tipo ? { tipo } : {}), ...(month !== td.slice(0, 7) ? { mese: month } : {}), ...q });
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
          <b className={`num${late ? ' neg' : ''}`}>{late}</b><small className="ht-t">{lateL[0] ? `${lateL[0].title}, ${dm(lateL[0].date)}` : L('nessuna in ritardo', 'aucune en retard')}</small>
        </div>
        <div className={`htile${soon ? ' t-do' : ''}`}>
          <span className="ht-l"><CIcon name="cal" size={14} />{L('Prossimi 14 giorni', '14 prochains jours')}</span>
          <b className="num">{soon}</b><small className="ht-t">{soonL[0] ? L(`la prima il ${dm(soonL[0].date)}`, `la première le ${dm(soonL[0].date)}`) : L('niente in arrivo', 'rien à venir')}</small>
        </div>
        <div className="htile">
          <span className="ht-l"><CIcon name="wallet" size={14} />{L('Da pagare in 30 giorni', 'À payer sous 30 jours')}</span>
          <b className="num">{money(Math.round(toPayEur), 'EUR', lang).replace(/,00(?=\s?€)/, '')}</b><small>{toPay.length === 1 ? L('1 pagamento', '1 paiement') : L(`${toPay.length} pagamenti`, `${toPay.length} paiements`)}</small>
        </div>
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

      <section className="panel">
        <div className="panel-h cal-h">
          <Link className="btn small ghost" href={href({ mese: prevM })} aria-label={L('Mese precedente', 'Mois précédent')}>‹</Link>
          <h2 style={{ textTransform: 'capitalize' }}>{monthName}</h2>
          <Link className="btn small ghost" href={href({ mese: nextM })} aria-label={L('Mese successivo', 'Mois suivant')}>›</Link>
        </div>
        <div className="cal" role="grid">
          {wd.map((w) => <div key={w} className="cal-wd" role="columnheader">{w}</div>)}
          {daysGrid.map((d) => {
            const its = calItems.filter((i) => i.date === d);
            return (
              <div key={d} className={`cal-d ${d.slice(0, 7) !== month ? 'out' : ''} ${d === td ? 'today' : ''} ${its.length ? 'has' : ''}`} role="gridcell">
                <span className="cal-n">{Number(d.slice(8))}</span>
                {its.length > 0 && <Link className="cal-hit" href={href({ apri: `day:${d}` })} scroll={false} aria-label={`${Number(d.slice(8))} ${monthName}: ${its.length}`} />}
                {its.slice(0, 3).map((i) => <Link key={i.key} className={`cal-i i-${imp(i)}`} title={i.title} href={href({ apri: i.key })} scroll={false}>{i.title}</Link>)}
                {its.length > 3 && <span className="cal-more">+{its.length - 3}</span>}
              </div>
            );
          })}
        </div>
        <ul className="imp-leg">{IMP.map(([c, it, fr]) => <li key={c}><i className={`i-${c}`} />{L(it, fr)}</li>)}</ul>
      </section>

      <Panel>
        <FilterBar action="/scadenze" lang={lang} hidden={{ periodo: per, mese: month !== td.slice(0, 7) ? month : undefined }}
          inline={<nav className="quick fb-inline" aria-label={L('Periodo', 'Période')}>
            {([['late', L('Scadute', 'En retard')], ['14', L('14 giorni', '14 jours')], ['30', L('30 giorni', '30 jours')], ['90', L('90 giorni', '90 jours')], ['all', L('Tutte', 'Toutes')]] as const)
              .map(([k, l]) => <Link key={k} href={href({ periodo: k })} scroll={false} aria-current={per === k ? 'true' : undefined}>{l}</Link>)}</nav>}
          active={tipo ? 1 : 0} reset={tipo ? href({ tipo: '' }) : null}>
          <label className="field"><span className="flabel">{L('Tipo', 'Type')}</span>
            <select className="input" name="tipo" defaultValue={tipo}><option value="">{L('Tutti i tipi', 'Tous les types')}</option>
              {(Object.keys(DL_CAT) as DlCat[]).map((k) => <option key={k} value={k}>{L(...DL_CAT[k])}</option>)}</select></label>
        </FilterBar>
        {list.length === 0 ? <div className="panel-b muted">{L('Nessuna scadenza nel periodo.', 'Aucune échéance sur la période.')}</div> : (
          <ul className="dl dl2">
            {list.map((i) => (
              <li key={i.key} className={`${i.status !== 'open' ? 'done' : ''} i-${imp(i)}`}>
                <div className="dl-day"><b>{i.date.slice(8)}</b><span>{MS[Number(i.date.slice(5, 7)) - 1]}</span></div>
                <div className="dl-body">
                  <div className="dl-t"><Link href={href({ apri: i.key })} scroll={false}>{i.title}</Link></div>
                  <div className="muted dl-s">{[L(...DL_CAT[i.cat]), i.project, i.owner ? userBy.get(i.owner) : null, i.sub].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="dl-amt num">{i.amount ? money(i.amount, i.currency ?? 'EUR', lang) : ''}</div>
                <div className="dl-tag">{tag(i)}</div>
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

      {staff && (
        <Panel title={L(`Soglie ETS · entrate ${Y}`, `Seuils ETS · recettes ${Y}`)} pad>
          <p className="muted small" style={{ marginTop: 0 }}>{L('Entrate', 'Recettes')} {Y - 1}: <b className="num">{money(inc(Y - 1), 'EUR', lang)}</b> · {Y} {L('finora', 'à ce jour')}: <b className="num">{money(inc(Y), 'EUR', lang)}</b> · {L('fine anno stimata', 'fin d’année estimée')}: <b className="num">≈ {money(Math.round(est / 1000) * 1000, 'EUR', lang).replace(/,00(?=\s?€)/, '')}</b></p>
          <div className="ruler" role="img" aria-label={L('Righello delle soglie', 'Règle des seuils')}>
            <div className="ru-track"><i style={{ width: `${pos(inc(Y))}%` }} /></div>
            {THRESHOLDS.map((th) => <span key={th.v} className={`ru-th${inc(Y) > th.v ? ' past' : ''}`} style={{ left: `${pos(th.v)}%` }}><span>{k(th.v)}</span></span>)}
            <span className="ru-now" style={{ left: `${pos(inc(Y))}%` }}><b>{k(inc(Y))}</b> {L('oggi', 'auj.')}</span>
            {est > inc(Y) && <span className="ru-est" style={{ left: `${pos(est)}%` }} title={L('stima di fine anno', 'estimation de fin d’année')} />}
          </div>
          <ul className="thr2">
            {THRESHOLDS.map((th) => { const v = inc(Y), past = v > th.v; return (
              <li key={th.v} className={past ? 'past' : ''}><b className="num">{k(th.v)}</b><span>{L(th.it, th.fr)}</span>
                <span className={`cdp ${past ? 'mid' : 'ok'}`}>{past ? L('superata', 'dépassée') : `${Math.round((v / th.v) * 100)} %`}</span></li>); })}
          </ul>
          <p className="muted small" style={{ marginBottom: 0 }}>{L('Scala logaritmica: le soglie sono molto distanti fra loro. La tacca lilla è la stima di fine anno al ritmo di oggi. La lettura delle soglie la conferma il commercialista.',
            'Échelle logarithmique : les seuils sont très éloignés. Le repère lilas est l’estimation de fin d’année au rythme actuel. La lecture des seuils est confirmée par l’expert-comptable.')}</p>
        </Panel>
      )}
      {selDay && (
        <div className="sheet-bg dl-sheet-bg">
          <Link className="dl-sheet-x" href={href({})} scroll={false} aria-label={L('Chiudi', 'Fermer')} />
          <aside className="sheet sheet-help dl-sheet" role="dialog" aria-modal="true" aria-label={selDay}>
            <div className="sheet-h"><h2>{selDay.split('-').reverse().join('/')}</h2><div className="spacer" />
              <Link className="btn ghost" href={href({})} scroll={false}>{L('Chiudi', 'Fermer')}</Link></div>
            <ul className="dl dl2 dl-day-list">
              {dayItems.map((i) => (
                <li key={i.key} className={`${i.status !== 'open' ? 'done' : ''} i-${imp(i)}`}>
                  <div className="dl-body"><div className="dl-t"><Link href={href({ apri: i.key })} scroll={false}>{i.title}</Link></div>
                    <div className="muted dl-s">{L(...DL_CAT[i.cat])}{i.amount ? ` · ${money(i.amount, i.currency ?? 'EUR', lang)}` : ''}</div></div>
                  <div className="dl-tag">{tag(i)}</div>
                </li>))}
            </ul>
          </aside>
        </div>
      )}
      {sel && (
        <div className="sheet-bg dl-sheet-bg">
          <Link className="dl-sheet-x" href={href({})} scroll={false} aria-label={L('Chiudi', 'Fermer')} />
          <aside className="sheet sheet-help dl-sheet" role="dialog" aria-modal="true" aria-label={sel.title}>
            <div className="sheet-h"><h2>{sel.title}</h2><div className="spacer" />
              <Link className="btn ghost" href={href({})} scroll={false}>{L('Chiudi', 'Fermer')}</Link></div>
            <div className="sheet-b help-b">
              <div className="dl-d-top"><span className={`dl-d-day i-${imp(sel)}`}><b>{sel.date.slice(8)}</b><span>{MS[Number(sel.date.slice(5, 7)) - 1]} {sel.date.slice(0, 4)}</span></span>
                <div className="dl-d-tags">{tag(sel)}<span className={`chip st imp-${imp(sel)}`}>{L(...(IMP.find(([c]) => c === imp(sel))!.slice(1) as [string, string]))}</span></div></div>
              <dl className="adv-dl">
                <dt>{L('Tipo', 'Type')}</dt><dd>{L(...DL_CAT[sel.cat])}</dd>
                {sel.amount ? <><dt>{t('amount')}</dt><dd className="num">{money(sel.amount, sel.currency ?? 'EUR', lang)}</dd></> : null}
                {sel.project ? <><dt>{t('project')}</dt><dd>{sel.project}</dd></> : null}
                {sel.owner ? <><dt>{L('Responsabile', 'Responsable')}</dt><dd>{userBy.get(sel.owner)}</dd></> : null}
                <dt>{L('Stato', 'Statut')}</dt><dd>{sel.status === 'open' ? (sel.date < td ? L('scaduta', 'en retard') : L('da fare', 'à faire')) : sel.status === 'done' ? L('fatta', 'faite') : L('annullata', 'annulée')}</dd>
                {sel.auto ? <><dt>{L('Origine', 'Origine')}</dt><dd>{L('promemoria calcolato dai dati: sparisce quando il dato è a posto', 'rappel calculé depuis les données : il disparaît quand la donnée est en ordre')}</dd></> : null}
              </dl>
              {sel.sub && <p style={{ margin: 0 }}>{sel.sub}</p>}
              <div className="row-actions">
                {sel.href && <Link className="btn primary" href={sel.href}>{L('Vai alla pagina', 'Aller à la page')} →</Link>}
                {!sel.auto && writer && (sel.status === 'open' ? statusForm(sel, 'done') : statusForm(sel, 'open'))}
                {!sel.auto && !sel.rule_key && writer && sel.id && <Link className="btn ghost" href={href({ edit: sel.id })}>{L('Modifica', 'Modifier')}</Link>}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
