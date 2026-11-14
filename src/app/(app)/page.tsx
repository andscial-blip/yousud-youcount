import Link from 'next/link';
import { advanceLate } from '@/lib/advance-late';
import { ruleItems } from '@/lib/deadline-rules';
import { STAFF, can, requireMe } from '@/lib/session';
import { date, money, num } from '@/lib/format';
import { MESI, MESI_L } from '@/lib/viz';
import { ErrorNote, H2 } from '@/components/Page';
import { type Balance } from '@/components/Balances';
import { FlowMini, Viz } from '@/components/Charts';
import { CIcon } from '@/components/CIcon';
import { DashNotes } from '@/components/DashNotes';

export const dynamic = 'force-dynamic';

type Led = { month: number; kind: string; amount_eur: string | null; project_id: string | null; project_name: string | null; category_id: string | null };
type Todo = { lvl: 'warn' | 'do' | 'ok'; ic: string; title: string; sub?: string; big?: string; chip?: { c: string; t: string }; href: string; act?: string };

// Dashboard nello schema di Cairn: in alto 4 riquadri con mini grafico (entrate, uscite, avanzo, liquidità); sotto, a sinistra
// le schede a coppie (mesi, spese, preventivo, cassa, progetti, conti) e a destra le cose da fare e le note.
// Colori con il significato di Cairn: blu notte = entrate, giallo = uscite, verde = avanzo. Tutti i numeri vengono dal database.
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ anno?: string; pw?: string }> }) {
  const { anno, pw } = await searchParams;
  const now = new Date();
  const cy = now.getFullYear();
  const year = Number(anno) || cy;
  const { supabase, me, t, lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const staff = can(me, STAFF);
  const isAdmin = ['super_admin', 'admin'].includes(me!.role);
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const td = ymd(now), in30 = ymd(new Date(cy, now.getMonth(), now.getDate() + 30)), ago45 = ymd(new Date(cy, now.getMonth(), now.getDate() - 45));
  const cfFrom = new Date(cy, now.getMonth() - 3, 1), cfTo = new Date(cy, now.getMonth(), 0);

  const [{ data: bal, error }, { count: toVerify }, { count: drafts }, { data: ledger }, { data: lastBackup }, { count: dueCount }, { data: advs },
    { data: cats }, { data: fxRows }, { data: dls }, { data: incPrev }, { data: cmp }, { data: spent3 }, { data: dueRows }, { data: notesRow }, { count: noDoc }, { data: advReqs }] = await Promise.all([
    supabase.rpc('account_balances'),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('status', 'recorded'),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('status', 'draft').eq('created_by', me!.id).is('reimb_status', null),
    supabase.from('v_ledger').select('month, kind, amount_eur, project_id, project_name, category_id').eq('year', year).neq('kind', 'transfer').eq('out_of_report', false)
      .limit(50000).returns<Led[]>(),
    isAdmin ? supabase.from('settings').select('value').eq('key', 'last_backup').maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('reimb_status', 'due'),
    me!.role !== 'operator' ? supabase.rpc('advance_summary') : Promise.resolve({ data: null }),
    supabase.from('categories').select('id, group:category_groups(code, name_it, name_fr)'),
    supabase.from('fx_rates').select('year, month, rate, source').order('year', { ascending: false }).order('month', { ascending: false }).limit(14),
    supabase.from('deadlines').select('id, rule_key, title, due_date, status').gte('due_date', `${cy - 1}-01-01`).lte('due_date', in30),
    staff ? supabase.rpc('income_of_year', { p_year: cy - 1 }) : Promise.resolve({ data: 0 }),
    staff ? supabase.rpc('budget_compare', { p_year: year }) : Promise.resolve({ data: [] }),
    staff ? supabase.from('v_ledger').select('amount_eur').eq('kind', 'expense').gte('op_date', ymd(cfFrom)).lte('op_date', ymd(cfTo)).limit(50000) : Promise.resolve({ data: null }),
    staff ? supabase.from('movements').select('amount, currency, amount_eur').eq('reimb_status', 'due').limit(5000) : Promise.resolve({ data: null }),
    supabase.from('settings').select('value').eq('key', 'dashboard_notes').maybeSingle(),
    supabase.from('movements').select('id', { count: 'exact', head: true }).neq('status', 'draft').not('no_doc_reason', 'is', null).eq('kind', 'expense').gte('op_date', `${year}-01-01`).lte('op_date', `${year}-12-31`),
    supabase.from('advance_requests').select('account_id, status, report_by').in('status', ['requested', 'authorized', 'delivered', 'reported']),
  ]);

  // ---- anno in sintesi
  const months = Array.from({ length: 12 }, () => ({ inc: 0, out: 0 }));
  const byProject = new Map<string, { label: string; value: number; href: string }>();
  const byCat = new Map<string, number>();
  const grp = new Map(((cats ?? []) as unknown as { id: string; group: { code: string; name_it: string; name_fr: string | null } | null }[]).map((c) => [c.id, c.group]));
  for (const l of ledger ?? []) {
    const v = Number(l.amount_eur ?? 0);
    if (l.kind === 'income') { months[l.month - 1].inc += v; continue; }
    months[l.month - 1].out += v;
    if (l.project_id) {
      const p = byProject.get(l.project_id) ?? { label: l.project_name ?? '–', value: 0, href: `/progetti/${l.project_id}?anno=${year}` };
      p.value += v; byProject.set(l.project_id, p);
    }
    const g = l.category_id ? grp.get(l.category_id) : null;
    const gk = g ? `${g.code}|${lang === 'fr' && g.name_fr ? g.name_fr : g.name_it}` : `?|${L('Senza codice', 'Sans code')}`;
    byCat.set(gk, (byCat.get(gk) ?? 0) + v);
  }
  const inc = months.reduce((a, m) => a + m.inc, 0), out = months.reduce((a, m) => a + m.out, 0), net = inc - out;
  const curM = year === cy ? now.getMonth() + 1 : year < cy ? 12 : 0;
  const rows = (bal ?? []) as Balance[];
  const fx = (fxRows ?? []).find((r) => `${r.year}-${String(r.month).padStart(2, '0')}` <= td.slice(0, 7));
  const fxPrev = fx ? (fxRows ?? [])[(fxRows ?? []).indexOf(fx) + 1] : null;
  const rate = fx ? Number(fx.rate) : 0;
  const sum = (cur: string) => rows.filter((r) => r.currency === cur && r.kind !== 'advance').reduce((s, r) => s + Number(r.balance), 0);
  const eurIT = sum('EUR'), mgaMG = sum('MGA');
  const liq = eurIT + (rate ? mgaMG / rate : 0);
  const due = (dueRows ?? []).reduce((s, d) => s + (d.amount_eur !== null ? Number(d.amount_eur) : d.currency === 'EUR' ? Number(d.amount) : rate ? Number(d.amount) / rate : 0), 0);
  const burn = (spent3 ?? []).reduce((s, l) => s + Number(l.amount_eur ?? 0), 0) / 3;
  const runway = burn > 0 ? (liq - due) / burn : null;

  // ---- preventivo
  type Cm = { direction: string; category_id: string; budget_eur: string; actual_eur: string };
  const cm = (cmp ?? []) as Cm[];
  const tot = (dir: string, k: 'budget_eur' | 'actual_eur') => cm.filter((r) => r.direction === dir).reduce((x, r) => x + Number(r[k]), 0);
  const bOut = tot('out', 'budget_eur'), aOut = tot('out', 'actual_eur'), bIn = tot('in', 'budget_eur'), aIn = tot('in', 'actual_eur');
  const over = new Set<string>();
  { const agg = new Map<string, { b: number; a: number }>();
    for (const r of cm.filter((x) => x.direction === 'out')) { const g = agg.get(r.category_id) ?? { b: 0, a: 0 }; g.b += Number(r.budget_eur); g.a += Number(r.actual_eur); agg.set(r.category_id, g); }
    for (const [k, g] of agg) if (g.a > g.b + 0.005) over.add(k); }
  // tempo trascorso dell'anno: serve a leggere il preventivo (a ottobre è normale aver speso circa l'80%)
  const elapsed = year < cy ? 1 : year > cy ? 0 : (now.getTime() - new Date(cy, 0, 1).getTime()) / (new Date(cy + 1, 0, 1).getTime() - new Date(cy, 0, 1).getTime());

  // ---- da fare
  const advRows = (advs ?? []) as { account_id: string; balance: string; open_since: string | null; aut_to_sign: number }[];
  const advReqRows = (advReqs ?? []) as { account_id: string; status: string; report_by: string }[];
  // stessa regola di Conti › Anticipi e di Scadenze (lib/advance-late)
  const advLate = advRows.filter((r) => advanceLate(r, advReqRows, td)).length;
  const advToAuth = advReqRows.filter((r) => r.status === 'requested').length;
  const autToSign = advRows.reduce((n, r) => n + r.aut_to_sign, 0);
  const backupAt = (lastBackup?.value as { at?: string } | null)?.at;
  const backupDays = backupAt ? Math.floor((Date.now() - new Date(backupAt).getTime()) / 86400000) : null;
  const savedBy = new Map((dls ?? []).filter((d) => d.rule_key).map((d) => [d.rule_key as string, d]));
  const upcoming = [
    ...(dls ?? []).filter((d) => !d.rule_key && d.status === 'open' && d.due_date >= ago45).map((d) => ({ k: d.id as string, date: d.due_date as string, title: d.title as string })),
    ...(staff ? ruleItems([cy], () => Number(incPrev ?? 0)) : []).filter((r) => r.applies && r.date <= in30)
      .map((r) => ({ r, s: savedBy.get(r.rule_key) })).filter(({ r, s }) => (s ? s.status === 'open' : true) && (s?.due_date ?? r.date) >= ago45)
      .map(({ r, s }) => ({ k: r.rule_key, date: (s?.due_date ?? r.date) as string, title: lang === 'fr' ? r.fr : r.it })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const days = (d: string) => Math.round((Date.parse(d) - Date.parse(td)) / 864e5);
  const chipFor = (d: string) => { const n = days(d);
    return n < 0 ? { c: 'late', t: L(`scaduta da ${-n} g`, `en retard de ${-n} j`) } : n === 0 ? { c: 'late', t: L('oggi', 'aujourd\'hui') }
      : n <= 7 ? { c: 'soon', t: L(`tra ${n} g`, `dans ${n} j`) } : { c: 'mid', t: L(`tra ${n} g`, `dans ${n} j`) }; };
  // chi può verificare va alla pagina di verifica in blocco; gli altri vedono l'elenco nel registro
  const verHref = ['super_admin', 'admin', 'responsabile'].includes(me!.role) ? '/verifica' : '/movimenti?stato=recorded';
  const todo: Todo[] = [];
  if (toVerify) todo.push({ lvl: 'do', ic: 'check', title: L(`${toVerify} movimenti da verificare`, `${toVerify} mouvements à vérifier`), sub: L('Registrati ma non ancora controllati', 'Enregistrés mais pas encore contrôlés'),
    href: verHref, act: L('Verifica', 'Vérifier') });
  if (dueCount) todo.push({ lvl: 'warn', ic: 'wallet', title: L(`${dueCount} ${dueCount === 1 ? 'spesa da rimborsare' : 'spese da rimborsare'}`, `${dueCount} dépense${dueCount === 1 ? '' : 's'} à rembourser`),
    big: due ? money(due, 'EUR', lang) : undefined, href: '/rimborsi', act: L('Rimborsa', 'Rembourser') });
  if (advToAuth && me && ['super_admin', 'admin', 'responsabile'].includes(me.role)) todo.push({ lvl: 'warn', ic: 'user', title: L(`Richieste di anticipo da autorizzare: ${advToAuth}`, `Demandes d’avance à autoriser : ${advToAuth}`), href: '/anticipi', act: L('Apri', 'Ouvrir') });
  if (advLate) todo.push({ lvl: 'warn', ic: 'user', title: L(`Anticipi con ricevute in ritardo: ${advLate}`, `Avances avec reçus en retard : ${advLate}`), href: '/anticipi', act: L('Apri', 'Ouvrir') });
  if (autToSign) todo.push({ lvl: 'do', ic: 'receipt', title: L(`Autocertificazioni da firmare: ${autToSign}`, `Attestations à signer : ${autToSign}`), href: '/anticipi', act: L('Apri', 'Ouvrir') });
  if (over.size) todo.push({ lvl: 'warn', ic: 'chart', title: L(`Codici di spesa oltre il preventivo: ${over.size}`, `Codes de dépense au-delà du budget : ${over.size}`), href: `/analisi?anno=${year}&vista=budget`, act: L('Vedi', 'Voir') });
  if (!fx || `${fx.year}-${String(fx.month).padStart(2, '0')}` < td.slice(0, 7)) todo.push({ lvl: 'warn', ic: 'bank', title: L('Manca il tasso di cambio del mese', 'Taux de change du mois manquant'), sub: L('Serve per le spese in ariary', 'Nécessaire pour les dépenses en ariary'), href: '/cambi', act: L('Inserisci', 'Saisir') });
  if (drafts) todo.push({ lvl: 'do', ic: 'pen', title: L(`Le tue bozze: ${drafts}`, `Vos brouillons : ${drafts}`), sub: L('Da completare e registrare', 'À compléter et enregistrer'), href: '/movimenti?stato=draft', act: L('Apri', 'Ouvrir') });
  if (isAdmin && (backupDays === null || backupDays >= 7)) todo.push({ lvl: 'warn', ic: 'safe', title: backupDays === null ? L('Nessun backup scaricato', 'Aucune sauvegarde téléchargée') : L(`Ultimo backup ${backupDays} giorni fa`, `Dernière sauvegarde il y a ${backupDays} jours`),
    sub: L('Scaricalo e salvalo nel Drive condiviso di YouSud', 'Téléchargez-la et enregistrez-la dans le Drive partagé de YouSud'), href: '/admin/dati', act: L('Scarica', 'Télécharger') });
  for (const u of upcoming.slice(0, 5)) todo.push({ lvl: days(u.date) < 0 ? 'warn' : 'do', ic: 'cal', title: u.title, sub: date(u.date), chip: chipFor(u.date), href: '/scadenze' });
  if (!todo.length) todo.push({ lvl: 'ok', ic: 'check', title: L('Tutto in ordine', 'Tout est en ordre'), sub: L('Niente da verificare, rimborsare o firmare', 'Rien à vérifier, rembourser ou signer'), href: '/movimenti' });
  const TODO_MAX = 7;
  const notes = (notesRow?.value ?? null) as { text?: string; by_name?: string; at?: string } | null;

  const e0 = (v: number) => money(Math.round(v), 'EUR', lang).replace(/,00(?=\s?€)/, '');
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '–');
  const projects = [...byProject.values()].filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
  const catParts = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const top = catParts.slice(0, 5), rest = catParts.slice(5);
  const parts: [string, number][] = [...top.map(([k, v]) => [k.split('|')[1]!, v] as [string, number]), ...(rest.length ? [[L(`Altre ${rest.length} voci`, `${rest.length} autres postes`), rest.reduce((a, [, v]) => a + v, 0)] as [string, number]] : [])];
  const catTot = parts.reduce((a, [, v]) => a + v, 0) || 1;
  const ML = MESI_L[lang];
  const eye = year > cy ? L('anno futuro', 'année future') : year < cy ? L('anno chiuso', 'année close') : L(`fino a ${ML[now.getMonth()].toLowerCase()}`, `jusqu'à ${ML[now.getMonth()].toLowerCase()}`);
  const outW = bOut ? Math.min(100, (aOut / bOut) * 100) : 0, inW = bIn ? Math.min(100, (aIn / bIn) * 100) : 0;

  const loc = lang === 'fr' ? 'fr-FR' : 'it-IT';
  const n1 = (v: number) => v.toLocaleString(loc, { maximumFractionDigits: 1 });
  const MS = MESI[lang];
  const monthTip = (title: string, f: (m: { inc: number; out: number }) => number) => `${title}\n${months.map((m, k) => `${MS[k]}: ${e0(f(m))}`).join('\n')}`;
  const monthHref = (m: number) => `/movimenti?dal=${year}-${String(m).padStart(2, '0')}-01&al=${year}-${String(m).padStart(2, '0')}-${String(new Date(year, m, 0).getDate()).padStart(2, '0')}`;
  const itEur = Math.max(0, eurIT), mgEur = Math.max(0, rate ? mgaMG / rate : 0);
  const overPace = bOut > 0 && aOut / bOut > elapsed + 0.1;
  const fxChg = fx && fxPrev ? ((rate - Number(fxPrev.rate)) / Number(fxPrev.rate)) * 100 : null;

  return (
    <div className="stack">
      {pw === 'ok' && <div className="note ok" role="status">{t('pw_done')}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />
      {/* 4 cifre dell'anno nel disegno dei riquadri di Cairn: etichetta, cifra, mini grafico, una riga di contesto. Nessun filo colorato:
          il colore sta solo nel grafico (blu notte = entrate, giallo = uscite, verde = avanzo) */}
      <div className="kpis dk">
        <div className="kpi">
          <div className="l">{L('Entrate', 'Recettes')} {year}</div>
          <div className="v num">{e0(inc)}</div>
          <Viz.Cols vals={months.map((m) => m.inc)} colors={months.map((_, k) => (k < curM ? 'var(--vz-real)' : 'var(--band)'))} tip={monthTip(`${L('Entrate', 'Recettes')} ${year}`, (m) => m.inc)} />
          <div className="s">{bIn ? `${pct(inc, bIn)} ${L('del previsto', 'du prévu')} · ${eye}` : eye}</div>
        </div>
        <div className="kpi">
          <div className="l">{L('Uscite', 'Dépenses')} {year}</div>
          <div className="v num">{e0(out)}</div>
          <Viz.Cols vals={months.map((m) => m.out)} colors={months.map((_, k) => (k < curM ? 'var(--vz-sp)' : 'var(--band)'))} tip={monthTip(`${L('Uscite', 'Dépenses')} ${year}`, (m) => m.out)} />
          <div className="s">{bOut ? <><span className={overPace ? 'neg' : undefined}>{pct(aOut, bOut)} {L('del preventivo', 'du budget')}</span>{curM ? ` · ${e0(out / curM)} ${L('al mese', 'par mois')}` : ''}</> : curM ? `${e0(out / curM)} ${L('al mese', 'par mois')}` : ' '}</div>
        </div>
        <div className="kpi">
          <div className="l">{net >= 0 ? L('Avanzo', 'Excédent') : L('Disavanzo', 'Déficit')} {year}</div>
          <div className={`v num ${net < 0 ? 'neg' : 'pos'}`}>{net < 0 ? '−' : ''}{e0(Math.abs(net))}</div>
          {inc > 0 || out > 0 ? (net >= 0
            ? <><Viz.Stack segs={[{ v: out, c: 'var(--vz-sp)' }, { v: net, c: 'var(--green-soft)' }]} max={Math.max(1, inc)} tip={`${L('Entrate', 'Recettes')}: ${e0(inc)}\n${L('Uscite', 'Dépenses')}: ${e0(out)}\n${L('Avanzo', 'Excédent')}: ${e0(net)}`} />
              <div className="vzl"><span>{L('uscite', 'dépenses')}</span><span>{L('avanzo', 'excédent')}</span></div></>
            : <><Viz.Stack segs={[{ v: inc, c: 'var(--vz-real)' }, { v: -net, c: 'var(--tax)' }]} max={Math.max(1, out)} tip={`${L('Entrate', 'Recettes')}: ${e0(inc)}\n${L('Uscite', 'Dépenses')}: ${e0(out)}\n${L('Disavanzo', 'Déficit')}: ${e0(-net)}`} />
              <div className="vzl"><span>{L('entrate', 'recettes')}</span><span>{L('disavanzo', 'déficit')}</span></div></>) : null}
          <div className="s">{inc > 0 ? (net >= 0 ? L(`resta il ${pct(net, inc)} delle entrate`, `il reste ${pct(net, inc)} des recettes`) : L(`uscite oltre le entrate del ${pct(-net, inc)}`, `dépenses supérieures aux recettes de ${pct(-net, inc)}`)) : L('entrate meno uscite', 'recettes moins dépenses')}</div>
        </div>
        {staff ? (
          <Link className="kpi" href="/conti">
            <div className="l">{L('Liquidità oggi', 'Liquidités aujourd\'hui')}</div>
            <div className={`v num ${liq < 0 ? 'neg' : ''}`}>{e0(liq)}</div>
            <Viz.Stack segs={[{ v: itEur, c: 'var(--navy)' }, { v: mgEur, c: 'var(--green-soft)' }]} max={Math.max(1, itEur + mgEur)}
              tip={`${L('Italia', 'Italie')}: ${e0(eurIT)}\nMadagascar: ${rate ? `${e0(mgaMG / rate)} (${money(mgaMG, 'MGA', lang)})` : money(mgaMG, 'MGA', lang)}`} />
            <div className="vzl"><span>{L('Italia', 'Italie')}</span><span>Madagascar</span></div>
            <div className="s">{L('tutti i conti, in euro', 'tous les comptes, en euros')}</div>
          </Link>
        ) : (
          <Link className="kpi" href={verHref}>
            <div className="l">{L('Da verificare', 'À vérifier')}</div>
            <div className="v num">{toVerify ?? 0}</div>
            <div className="s">{L('movimenti registrati', 'mouvements enregistrés')}</div>
          </Link>
        )}
      </div>

      {/* come la Dashboard di Cairn: a sinistra le schede a coppie, a destra le cose da fare e le note */}
      <div className="home v2 yc">
        <div className="h-left">
          <section className="panel h-card h-flow" data-card="flow">
            <div className="panel-h"><H2 icon={null} text={L('Entrate e uscite', 'Recettes et dépenses')} /><div className="spacer" /><span className="eyebrow">{eye}</span></div>
            <div className="panel-b">
              <FlowMini data={months} curM={curM} lang={lang} names={[L('Entrate', 'Recettes'), L('Uscite', 'Dépenses'), L('Saldo del mese', 'Solde du mois')]} hrefFor={monthHref} />
              <div className="legend"><span><i style={{ background: 'var(--vz-real)' }} />{L('Entrate', 'Recettes')}</span><span><i style={{ background: 'var(--vz-sp)' }} />{L('Uscite', 'Dépenses')}</span>
                <span><i className="dotk" style={{ background: 'var(--green-soft)' }} />{L('Saldo del mese', 'Solde du mois')}</span></div>
            </div>
          </section>
          <section className="panel h-card" data-card="spese">
            <div className="panel-h"><H2 icon={null} text={L('Dove vanno le spese', 'Où vont les dépenses')} /><div className="spacer" /><span className="eyebrow">{L('per gruppo di spesa', 'par groupe de dépense')}</span></div>
            <div className="panel-b">
              {out <= 0 ? <p className="muted" style={{ margin: 0 }}>{t('none')}</p> : <>
                <div className="hstack" role="img" aria-label={L('Uscite per voce', 'Dépenses par poste')}>
                  {parts.map(([n, v], i) => <i key={n} style={{ width: `${((v / catTot) * 100).toFixed(2)}%`, background: `var(--dn${i + 1})` }} data-tip={`${n}: ${e0(v)} (${pct(v, catTot)})`} />)}</div>
                <ul className="hcat hq">{parts.map(([n, v], i) => <li key={n}><i style={{ background: `var(--dn${i + 1})` }} /><span className="hc-n">{n}</span><span className="hc-p">{pct(v, catTot)}</span><b className="num">{e0(v)}</b></li>)}</ul>
                {noDoc ? <div className="hcat-f"><span><b className="num">{num(noDoc, lang)}</b> {noDoc === 1 ? L('uscita senza giustificativo', 'dépense sans justificatif') : L('uscite senza giustificativo', 'dépenses sans justificatif')}</span><Link href={`/movimenti?doc=no&dal=${year}-01-01&al=${year}-12-31`}>{L('Vedi', 'Voir')} →</Link></div> : null}
              </>}
            </div>
          </section>
          {staff && (
            <section className="panel h-card" data-card="prev">
              <div className="panel-h"><H2 icon={null} text={L('Preventivo', 'Budget')} /><div className="spacer" /><span className="eyebrow">{L('anno trascorso', 'année écoulée')} {Math.round(elapsed * 100)}{' '}%</span></div>
              <div className="panel-b">
                {bOut > 0 ? <>
                  <div className="big-row"><div><span>{L('Uscite sul preventivo', 'Dépenses sur le budget')}</span><b className={`num ${overPace ? 'neg' : ''}`}>{pct(aOut, bOut)}</b><small>{e0(aOut)} {L('su', 'sur')} {e0(bOut)}</small></div>
                    {over.size > 0 ? <Link className="cdp late nolink" href={`/analisi?anno=${year}&vista=budget`}>{over.size === 1 ? L('1 codice oltre', '1 code dépassé') : L(`${over.size} codici oltre`, `${over.size} codes dépassés`)}</Link>
                      : <span className={`cdp ${overPace ? 'late' : 'ok'}`}>{overPace ? L('oltre il ritmo', 'au-delà du rythme') : L('in linea', 'dans le rythme')}</span>}</div>
                  <div className="cov">
                    <div className="meter m-out" role="img" aria-label={`${L('Uscite', 'Dépenses')} ${pct(aOut, bOut)}`}><i style={{ width: `${outW}%` }} /><span className="mk" style={{ left: `${Math.min(99.5, elapsed * 100)}%` }} /></div></div>
                  {bIn > 0 && <div className="cov"><div className="cov-l"><span>{L('Entrate', 'Recettes')}</span><span><b className="num">{e0(aIn)}</b> {L('su', 'sur')} {e0(bIn)} · {pct(aIn, bIn)}</span></div>
                    <div className="meter m-in" role="img" aria-label={`${L('Entrate', 'Recettes')} ${pct(aIn, bIn)}`}><i style={{ width: `${inW}%` }} /><span className="mk" style={{ left: `${Math.min(99.5, elapsed * 100)}%` }} /></div></div>}
                  <div className="hcat-f"><span>{L('tacca = anno trascorso', 'repère = année écoulée')}</span><Link href={`/analisi?anno=${year}&vista=budget`}>{L('Confronto', 'Comparaison')} →</Link></div>
                </> : <>
                  <p className="muted" style={{ margin: 0 }}>{L(`Nessun preventivo approvato per il ${year}: qui vedrai quanto è stato speso e incassato rispetto al previsto.`, `Aucun budget approuvé pour ${year} : vous verrez ici les dépenses et recettes par rapport au prévu.`)}</p>
                  <div className="hcat-f"><span /><Link href={`/preventivo?anno=${year}`}>{L('Apri il preventivo', 'Ouvrir le budget')} →</Link></div>
                </>}
              </div>
            </section>
          )}
          {staff && (
            <section className="panel h-card" data-card="cassa">
              <div className="panel-h"><H2 icon={null} text={L('Cassa e autonomia', 'Trésorerie et autonomie')} /><div className="spacer" /><span className="eyebrow">{L('oggi', 'aujourd\'hui')}</span></div>
              <div className="panel-b">
                <div className="big-row"><div><span>{L('Autonomia di cassa', 'Autonomie de trésorerie')}</span><b className={`num ${runway != null && runway < 3 ? 'neg' : ''}`}>{runway == null ? '–' : `${n1(runway)} ${L('mesi', 'mois')}`}</b></div>
                  {runway != null && <span className={`cdp ${runway < 3 ? 'late' : 'ok'}`}>{runway < 3 ? L('sotto 3 mesi', 'moins de 3 mois') : L('oltre 3 mesi', 'plus de 3 mois')}</span>}</div>
                <div className="cov"><div className="mbar"><i style={{ width: `${Math.max(0, Math.min(100, ((runway ?? 0) / 6) * 100)).toFixed(1)}%`, background: runway != null && runway >= 3 ? 'var(--green-soft)' : 'var(--amber-soft)' }} /></div>
                  <div className="meter-legend"><span>0</span><span>3</span><span>6 {L('mesi', 'mois')}</span></div></div>
                <div className="mini2">
                  <Link href="/rimborsi"><span>{L('Da rimborsare', 'À rembourser')}</span><b className="num">{e0(due)}</b><small>{dueCount ?? 0} {(dueCount ?? 0) === 1 ? L('spesa', 'dépense') : L('spese', 'dépenses')}</small></Link>
                  <Link href="/cambi"><span>{L('Tasso di cambio', 'Taux de change')}</span><b className="num">{fx ? money(rate, 'MGA', lang) : '–'}</b>
                    <small>{fx ? <>1 € · {MS[fx.month - 1]!.toLowerCase()} {fx.year}{fxChg != null ? ` · ${fxChg >= 0 ? '+' : ''}${n1(fxChg)} %` : ''}</> : L('da inserire', 'à saisir')}</small></Link>
                </div>
                <p className="muted small h-foot">{L(`Mesi di spesa coperti dalla liquidità di oggi, al ritmo medio degli ultimi tre mesi (${e0(burn)} al mese)${due > 0 ? `, già tolti i rimborsi dovuti (${e0(due)})` : ''}.`,
                  `Mois de dépenses couverts par la trésorerie actuelle, au rythme moyen des trois derniers mois (${e0(burn)} par mois)${due > 0 ? `, remboursements dus déjà déduits (${e0(due)})` : ''}.`)}</p>
              </div>
            </section>
          )}
          <section className="panel h-card" data-card="prj">
            <div className="panel-h"><H2 icon={null} text={L('Uscite per progetto', 'Dépenses par projet')} /><div className="spacer" /><Link className="eyebrow" href={`/progetti?anno=${year}`}>{L('progetti', 'projets')} →</Link></div>
            <div className="panel-b">{projects.length ? (
              <ul className="hcat pbars">{projects.slice(0, 7).map((p) => (
                <li key={p.href}><Link className="hc-n" href={p.href}>{p.label}</Link><b className="num">{e0(p.value)} <small>{pct(p.value, out)}</small></b>
                  <span className="hc-b"><i style={{ width: `${((p.value / projects[0]!.value) * 100).toFixed(1)}%` }} /></span></li>))}</ul>
            ) : <p className="muted" style={{ margin: 0 }}>{t('none')}</p>}
              {projects.length > 7 && <div className="hcat-f"><span>{L(`e altri ${projects.length - 7}`, `et ${projects.length - 7} autres`)}</span><Link href={`/progetti?anno=${year}`}>{L('Tutti', 'Tous')} →</Link></div>}</div>
          </section>
          <section className="panel h-card" data-card="conti">
            <div className="panel-h"><H2 icon={null} text={L('Saldo dei conti', 'Solde des comptes')} /><div className="spacer" /><Link className="eyebrow" href="/conti">{L('conti', 'comptes')} →</Link></div>
            <ul className="acclist">{rows.filter((r) => r.kind !== 'advance').map((r) => (
              <li key={r.account_id}><span className={`place ${r.location === 'IT' ? 'it' : 'mg'}`}>{r.location}</span><span className="an">{lang === 'fr' && r.name_fr ? r.name_fr : r.name_it}</span>
                <b className={`num ${Number(r.balance) < 0 ? 'neg' : ''}`}>{money(r.balance, r.currency, lang)}</b></li>))}</ul>
          </section>
        </div>
        <div className="h-side">
          <section className="panel h-todo" data-card="todo">
            <div className="panel-h"><H2 icon={null} text={L('Da fare', 'À faire')} /><span className="eyebrow tday" style={{ marginLeft: 4 }}>{L('oggi', 'aujourd\'hui')} {date(td)}</span></div>
            <ul className="tlist">{todo.slice(0, TODO_MAX).map((x, i) => (
              <li key={i} className={x.lvl}><span className={`dot ${x.lvl}`}><CIcon name={x.ic} size={13} /></span>
                <div className="tm"><div className="tt"><Link href={x.href}>{x.title}</Link></div>{x.sub && <div className="ts">{x.sub}</div>}</div>
                <div className="tr">{x.big && <b className="num">{x.big}</b>}{x.chip && <span className={`cdp ${x.chip.c}`}>{x.chip.t}</span>}</div>
                <div className="ta">{x.act && <Link className="btn small ghost" href={x.href}>{x.act}</Link>}</div></li>))}</ul>
            {todo.length > TODO_MAX && <div className="more"><Link className="btn small ghost" href="/scadenze">{L(`Altre ${todo.length - TODO_MAX}`, `${todo.length - TODO_MAX} autres`)}</Link></div>}
          </section>
          <section className="panel h-note" data-card="note">
            <div className="panel-h"><H2 icon={null} text={L('Note', 'Notes')} /><div className="spacer" /><span className="eyebrow">{L('condivise', 'partagées')}</span></div>
            <div className="panel-b">
              <DashNotes text={notes?.text ?? ''} lang={lang} canWrite={me!.role !== 'read_only'}
                meta={notes?.at ? `${notes.by_name ?? ''} · ${new Date(notes.at).toLocaleString(loc, { dateStyle: 'short', timeStyle: 'short' })}` : ''} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
