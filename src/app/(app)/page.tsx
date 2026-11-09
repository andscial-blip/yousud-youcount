import Link from 'next/link';
import { ruleItems } from '@/lib/deadline-rules';
import { STAFF, can, requireMe } from '@/lib/session';
import { date, money } from '@/lib/format';
import { MESI_L } from '@/lib/viz';
import { ErrorNote, H2 } from '@/components/Page';
import { type Balance } from '@/components/Balances';
import { MonthBars } from '@/components/Charts';
import { CIcon } from '@/components/CIcon';
import { DashNotes } from '@/components/DashNotes';
import { colorFor } from '@/lib/palette';

export const dynamic = 'force-dynamic';

type Led = { month: number; kind: string; amount_eur: string | null; project_id: string | null; project_name: string | null; category_id: string | null };
type Todo = { lvl: 'warn' | 'do' | 'ok'; ic: string; title: string; sub?: string; big?: string; chip?: { c: string; t: string }; href: string; act?: string };

// Dashboard nello schema di Cairn: a sinistra l'anno in sintesi (entrate, uscite, avanzo, liquidità, mesi, preventivo)
// e le schede su progetti, spese e cassa; a destra le cose da fare, il cambio e i saldi. Tutti i numeri vengono dal database.
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
    { data: cats }, { data: fxRows }, { data: dls }, { data: incPrev }, { data: cmp }, { data: spent3 }, { data: dueRows }, { data: notesRow }, { count: noDoc }] = await Promise.all([
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
  const advRows = (advs ?? []) as { balance: string; open_since: string | null; aut_to_sign: number }[];
  const advLate = advRows.filter((r) => Number(r.balance) > 0 && r.open_since && Date.now() - Date.parse(r.open_since) > 30 * 864e5).length;
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
  const todo: Todo[] = [];
  if (toVerify) todo.push({ lvl: 'do', ic: 'check', title: L(`${toVerify} movimenti da verificare`, `${toVerify} mouvements à vérifier`), sub: L('Registrati ma non ancora controllati', 'Enregistrés mais pas encore contrôlés'),
    href: '/movimenti?stato=recorded', act: L('Verifica', 'Vérifier') });
  if (dueCount) todo.push({ lvl: 'warn', ic: 'wallet', title: L(`${dueCount} ${dueCount === 1 ? 'spesa da rimborsare' : 'spese da rimborsare'}`, `${dueCount} dépense${dueCount === 1 ? '' : 's'} à rembourser`),
    big: due ? money(due, 'EUR', lang) : undefined, href: '/rimborsi', act: L('Rimborsa', 'Rembourser') });
  if (advLate) todo.push({ lvl: 'warn', ic: 'user', title: L(`Anticipi da giustificare da oltre 30 giorni: ${advLate}`, `Avances à justifier depuis plus de 30 jours : ${advLate}`), href: '/anticipi', act: L('Apri', 'Ouvrir') });
  if (autToSign) todo.push({ lvl: 'do', ic: 'receipt', title: L(`Autocertificazioni da firmare: ${autToSign}`, `Attestations à signer : ${autToSign}`), href: '/anticipi', act: L('Apri', 'Ouvrir') });
  if (over.size) todo.push({ lvl: 'warn', ic: 'chart', title: L(`Codici di spesa oltre il preventivo: ${over.size}`, `Codes de dépense au-delà du budget : ${over.size}`), href: `/preventivo?anno=${year}&vista=confronto`, act: L('Vedi', 'Voir') });
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

  return (
    <div className="stack">
      {pw === 'ok' && <div className="note ok" role="status">{t('pw_done')}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />
      <div className="home v2">
        <div className="h-left">
          <section className="panel hero h-hero">
            <div className="hero-h"><div><h2>{L(`Il ${year} in sintesi`, `${year} en synthèse`)}</h2><span className="eyebrow">{eye} · {L('movimenti registrati e verificati, in euro', 'mouvements enregistrés et vérifiés, en euros')}</span></div>
              {over.size > 0 && <Link className="cdp late nolink" href={`/preventivo?anno=${year}&vista=confronto`}>{L(`${over.size} codici oltre il preventivo`, `${over.size} codes au-delà du budget`)}</Link>}</div>
            <div className="hero-nums">
              <div className="hn-main"><span><CIcon name="trend" size={14} />{L('Entrate', 'Recettes')}</span><b className="num">{e0(inc)}</b><small>{bIn ? `${pct(inc, bIn)} ${L('del previsto', 'du prévu')}` : L('nessun preventivo', 'aucun budget')}</small></div>
              <div><span><CIcon name="chart" size={14} />{L('Uscite', 'Dépenses')}</span><b className="num">{e0(out)}</b><small>{curM ? `${e0(out / curM)} ${L('al mese', 'par mois')}` : ''}</small></div>
              <div><span><CIcon name="calc" size={14} />{net >= 0 ? L('Avanzo', 'Excédent') : L('Disavanzo', 'Déficit')}</span><b className={`num ${net < 0 ? 'neg' : 'pos'}`}>{net < 0 ? '−' : ''}{e0(Math.abs(net))}</b><small>{L('entrate meno uscite', 'recettes moins dépenses')}</small></div>
              {staff && <div><span><CIcon name="bank" size={14} />{L('Liquidità oggi', 'Liquidités aujourd\'hui')}</span><b className={`num ${liq < 0 ? 'neg' : ''}`}>{e0(liq)}</b><small>{runway != null ? L(`circa ${runway.toLocaleString('it-IT', { maximumFractionDigits: 1 })} mesi di spesa`, `environ ${runway.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} mois de dépenses`) : L('Italia + Madagascar', 'Italie + Madagascar')}</small></div>}
            </div>
            <div className="hero-chart">
              <MonthBars data={months} lang={lang} labels={{ in: L('Entrate', 'Recettes'), out: L('Uscite', 'Dépenses') }}
                hrefFor={(m) => `/movimenti?dal=${year}-${String(m).padStart(2, '0')}-01&al=${year}-${String(m).padStart(2, '0')}-${String(new Date(year, m, 0).getDate()).padStart(2, '0')}`} />
            </div>
            {staff && bOut > 0 && (
              <div className="hero-soglia">
                <div className="hs-top"><span>{L('Uscite rispetto al preventivo', 'Dépenses par rapport au budget')} <b className="num">{e0(aOut)}</b> {L('su', 'sur')} <b className="num">{e0(bOut)}</b></span>
                  <span className={aOut / bOut > elapsed + 0.1 ? 'neg' : ''}><b className="num">{pct(aOut, bOut)}</b> {L('usato', 'utilisé')} · {L('anno trascorso', 'année écoulée')} {Math.round(elapsed * 100)}{' '}%</span></div>
                <div className="meter" role="img" aria-label={`${pct(aOut, bOut)}`}><i style={{ width: `${outW}%` }} /><span className="mk" style={{ left: `${Math.min(99.5, elapsed * 100)}%` }} /></div>
                <div className="meter-legend"><span>{L('speso', 'dépensé')}</span><span>{L('tacca = tempo trascorso dell\'anno', 'repère = temps écoulé de l\'année')}</span></div>
                {bIn > 0 && <>
                  <div className="hs-top" style={{ marginTop: 12 }}><span>{L('Entrate rispetto al previsto', 'Recettes par rapport au prévu')} <b className="num">{e0(aIn)}</b> {L('su', 'sur')} <b className="num">{e0(bIn)}</b></span><span><b className="num">{pct(aIn, bIn)}</b></span></div>
                  <div className="meter m-in" role="img" aria-label={`${pct(aIn, bIn)}`}><i style={{ width: `${inW}%` }} /><span className="mk" style={{ left: `${Math.min(99.5, elapsed * 100)}%` }} /></div>
                </>}
              </div>
            )}
          </section>

          <section className="panel h-card">
            <div className="panel-h"><H2 text={L('Uscite per progetto', 'Dépenses par projet')} /><div className="spacer" /><span className="eyebrow">{year}</span></div>
            <div className="panel-b">{projects.length ? (
              <ul className="hcat pbars">{projects.slice(0, 7).map((p) => (
                <li key={p.href}><Link className="hc-n" href={p.href}>{p.label}</Link><b className="num">{e0(p.value)} <small>{pct(p.value, out)}</small></b>
                  <span className="hc-b"><i style={{ width: `${((p.value / projects[0]!.value) * 100).toFixed(1)}%`, background: colorFor(p.label) }} /></span></li>))}</ul>
            ) : <p className="muted" style={{ margin: 0 }}>{t('none')}</p>}
              {projects.length > 7 && <p style={{ margin: '10px 0 0' }}><Link href={`/progetti?anno=${year}`}>{L(`Tutti i ${projects.length} progetti`, `Les ${projects.length} projets`)} →</Link></p>}</div>
          </section>

          <section className="panel h-card">
            <div className="panel-h"><H2 text={L('Dove vanno le spese', 'Où vont les dépenses')} /><div className="spacer" /><span className="eyebrow">{L('per voce del piano dei conti', 'par poste du plan comptable')} · {year}</span></div>
            <div className="panel-b">
              {out <= 0 ? <p className="muted" style={{ margin: 0 }}>{t('none')}</p> : <>
                <div className="hstack" role="img" aria-label={L('Uscite per voce', 'Dépenses par poste')}>
                  {parts.map(([n, v], i) => <i key={n} style={{ width: `${((v / catTot) * 100).toFixed(2)}%`, background: `var(--dn${i + 1})` }} data-tip={`${n}: ${e0(v)} (${pct(v, catTot)})`} />)}</div>
                <ul className="hcat hq">{parts.map(([n, v], i) => <li key={n}><i style={{ background: `var(--dn${i + 1})` }} /><span className="hc-n">{n}</span><span className="hc-p">{pct(v, catTot)}</span><b className="num">{e0(v)}</b></li>)}</ul>
                {noDoc ? <div className="hcat-f"><span>{L('Uscite senza giustificativo fiscale', 'Dépenses sans justificatif fiscal')} <b className="num">{noDoc}</b></span><Link href={`/movimenti?doc=no&dal=${year}-01-01&al=${year}-12-31`}>{L('Vedi', 'Voir')} →</Link></div> : null}
              </>}
            </div>
          </section>

          {staff && (
            <section className="panel h-card span2">
              <div className="panel-h"><H2 text={L('Cassa e autonomia', 'Trésorerie et autonomie')} /><div className="spacer" /><span className="eyebrow">{L('oggi', 'aujourd\'hui')} {date(td)}</span></div>
              <div className="panel-b">
                <div className="h3n">
                  <div><span>{L('Italia', 'Italie')}</span><b className={`num ${eurIT < 0 ? 'neg' : ''}`}>{e0(eurIT)}</b><small>{L('banca, cassa, PayPal, Satispay', 'banque, caisse, PayPal, Satispay')}</small></div>
                  <div><span>Madagascar</span><b className={`num ${mgaMG < 0 ? 'neg' : ''}`}>{rate ? e0(mgaMG / rate) : money(mgaMG, 'MGA', lang)}</b><small>{rate ? money(mgaMG, 'MGA', lang) : L('manca il tasso', 'taux manquant')}</small></div>
                  <div><span>{L('Autonomia di cassa', 'Autonomie de trésorerie')}</span><b className={`num ${runway != null && runway < 3 ? 'neg' : ''}`}>{runway == null ? '–' : `${runway.toLocaleString(lang === 'fr' ? 'fr-FR' : 'it-IT', { maximumFractionDigits: 1 })}\u00a0${L('mesi', 'mois')}`}</b>
                    <div className="mbar thin"><i style={{ width: `${Math.max(0, Math.min(100, ((runway ?? 0) / 6) * 100)).toFixed(1)}%`, background: runway != null && runway >= 3 ? 'var(--green-soft)' : 'var(--amber-soft)' }} /></div></div>
                </div>
                <p className="muted small" style={{ margin: '10px 0 0' }}>{L(`Liquidità meno rimborsi dovuti (${e0(due)}), divisa per la spesa media mensile degli ultimi tre mesi chiusi (${e0(burn)}). Gli anticipi al personale sono esclusi.`,
                  `Liquidités moins remboursements dus (${e0(due)}), divisées par la dépense mensuelle moyenne des trois derniers mois clos (${e0(burn)}). Les avances au personnel sont exclues.`)}</p>
              </div>
            </section>
          )}
        </div>

        <div className="h-side">
          <section className="panel h-todo">
            <div className="panel-h"><H2 text={L('Da fare', 'À faire')} /><span className="eyebrow tday" style={{ marginLeft: 4 }}>{L('oggi', 'aujourd\'hui')} {date(td)}</span></div>
            <ul className="tlist">{todo.slice(0, TODO_MAX).map((x, i) => (
              <li key={i} className={x.lvl}><span className={`dot ${x.lvl}`}><CIcon name={x.ic} size={13} /></span>
                <div className="tm"><div className="tt"><Link href={x.href}>{x.title}</Link></div>{x.sub && <div className="ts">{x.sub}</div>}</div>
                <div className="tr">{x.big && <b className="num">{x.big}</b>}{x.chip && <span className={`cdp ${x.chip.c}`}>{x.chip.t}</span>}</div>
                <div className="ta">{x.act && <Link className="btn small ghost" href={x.href}>{x.act}</Link>}</div></li>))}</ul>
            {todo.length > TODO_MAX && <div className="more"><Link className="btn small ghost" href="/scadenze">{L(`Altre ${todo.length - TODO_MAX}`, `${todo.length - TODO_MAX} autres`)}</Link></div>}
          </section>

          {/* riquadri piccoli: cambio e le cifre da tenere d'occhio */}
          <div className="h-tiles">
            <Link className="htile" href="/cambi">
              <span className="ht-l"><CIcon name="euro" size={14} />{L('Cambio', 'Change')}</span>
              {fx ? <><b className="num">{money(rate, 'MGA', lang)}</b>
                <small>1{'\u00a0'}€ · {ML[fx.month - 1]}{fxPrev ? <span className={`cdp ${rate >= Number(fxPrev.rate) ? 'ok' : 'mid'}`}>{rate >= Number(fxPrev.rate) ? '+' : ''}{(((rate - Number(fxPrev.rate)) / Number(fxPrev.rate)) * 100).toLocaleString(lang === 'fr' ? 'fr-FR' : 'it-IT', { maximumFractionDigits: 1 })}{'\u00a0'}%</span> : null}</small></>
                : <small>{L('Inserisci il tasso', 'Saisir le taux')}</small>}
            </Link>
            <Link className={`htile${toVerify ? ' t-do' : ''}`} href="/movimenti?stato=recorded">
              <span className="ht-l"><CIcon name="check" size={14} />{L('Da verificare', 'À vérifier')}</span>
              <b className="num">{toVerify ?? 0}</b><small>{L('movimenti', 'mouvements')}</small>
            </Link>
            <Link className={`htile${dueCount ? ' t-warn' : ''}`} href="/rimborsi">
              <span className="ht-l"><CIcon name="wallet" size={14} />{L('Da rimborsare', 'À rembourser')}</span>
              <b className="num">{due ? e0(due) : '0'}</b><small>{dueCount ?? 0} {(dueCount ?? 0) === 1 ? L('spesa', 'dépense') : L('spese', 'dépenses')}</small>
            </Link>
            {(() => { const u = upcoming.find((u) => days(u.date) >= 0); return (
              <Link className="htile" href="/scadenze">
                <span className="ht-l"><CIcon name="cal" size={14} />{L('Prossima scadenza', 'Prochaine échéance')}</span>
                {u ? <><b className="num">{days(u.date) === 0 ? L('oggi', 'aujourd\'hui') : L(`tra ${days(u.date)} g`, `dans ${days(u.date)} j`)}</b><small className="ht-t">{u.title}</small></>
                  : <><b>–</b><small>{L('nessuna nei prossimi 30 giorni', 'aucune dans les 30 prochains jours')}</small></>}
              </Link>); })()}
          </div>

          <section className="panel h-card">
            <div className="panel-h"><H2 text={L('Saldo dei conti', 'Solde des comptes')} /><div className="spacer" /><Link className="eyebrow" href="/conti">{L('conti', 'comptes')} →</Link></div>
            <ul className="acclist">{rows.filter((r) => r.kind !== 'advance').map((r) => (
              <li key={r.account_id}><span className={`place ${r.location === 'IT' ? 'it' : 'mg'}`}>{r.location}</span><span className="an">{lang === 'fr' && r.name_fr ? r.name_fr : r.name_it}</span>
                <b className={`num ${Number(r.balance) < 0 ? 'neg' : ''}`}>{money(r.balance, r.currency, lang)}</b></li>))}</ul>
          </section>

          <section className="panel h-card">
            <div className="panel-h"><H2 icon="pen" text={L('Note', 'Notes')} /><div className="spacer" /><span className="eyebrow">{L('condivise', 'partagées')}</span></div>
            <div className="panel-b">
              <DashNotes text={notes?.text ?? ''} lang={lang} canWrite={me!.role !== 'read_only'}
                meta={notes?.at ? `${notes.by_name ?? ''} · ${new Date(notes.at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'it-IT', { dateStyle: 'short', timeStyle: 'short' })}` : ''} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
