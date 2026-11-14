import Link from 'next/link';
import { can, requireMe } from '@/lib/session';
import { AutoTranslate } from '@/components/AutoTranslate';
import { date, money, nm, num } from '@/lib/format';
import { ErrorNote, Panel } from '@/components/Page';
import { Viz } from '@/components/Charts';
import { MESI } from '@/lib/viz';
import { DocIndicator, EmptyState, Ico, KindIcon, StatusChip } from '@/components/Ui';
import { SavedFilters } from '@/components/SavedFilters';
import { FilterBar } from '@/components/FilterBar';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; ref: string | null; op_date: string; kind: 'income' | 'expense' | 'transfer'; demo: boolean;
  status: 'draft' | 'recorded' | 'verified'; description: string; amount: string; currency: string; sign: number; amount_eur: string | null;
  reverses_id: string | null; no_doc_reason: string | null; docs: { count: number }[]; reimb_status: 'due' | 'paid' | null; paid_by: string | null;
  account: { name_it: string; name_fr: string } | null; category: { code: string } | null; project: { name: string } | null;
  counterparty: { name: string } | null; method: { name_it: string; name_fr: string | null } | null;
};

const PAGE = 40;   // pagine corte: su telefono 100 schede erano 15.000 px (revisione 14/11)
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isId = (v: string) => /^[0-9a-f-]{36}$/.test(v);
const KEYS = ['stato', 'q', 'progetto', 'conto', 'dal', 'al', 'codice', 'tipo', 'cp', 'metodo', 'valuta', 'doc', 'demo', 'p'] as const;
type SP = Partial<Record<(typeof KEYS)[number] | 'ok' | 'err', string>>;

// Registro dei movimenti: ricerca e filtri combinabili (tutti nell'indirizzo, quindi salvabili e condivisibili),
// totali del filtro in euro, tabella su PC e schede su telefono. «Da verificare» è il filtro stato=recorded.
export default async function Movements({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, t, lang, me } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const stato = ['draft', 'recorded', 'verified', 'storni'].includes(sp.stato ?? '') ? sp.stato! : '';
  const term = (sp.q ?? '').replace(/[%,()*\\]/g, ' ').trim().slice(0, 60);
  const f = {
    prj: isId(sp.progetto ?? '') ? sp.progetto! : '', acc: isId(sp.conto ?? '') ? sp.conto! : '', cat: isId(sp.codice ?? '') ? sp.codice! : '',
    cp: isId(sp.cp ?? '') ? sp.cp! : '', pm: isId(sp.metodo ?? '') ? sp.metodo! : '',
    from: isDate(sp.dal ?? '') ? sp.dal! : '', to: isDate(sp.al ?? '') ? sp.al! : '',
    tipo: ['income', 'expense', 'transfer'].includes(sp.tipo ?? '') ? sp.tipo! : '',
    cur: ['EUR', 'MGA'].includes(sp.valuta ?? '') ? sp.valuta! : '', doc: ['si', 'no'].includes(sp.doc ?? '') ? sp.doc! : '',
    demo: ['si', 'no'].includes(sp.demo ?? '') ? sp.demo! : '',
  };
  const page = Math.max(1, Math.min(1000, Number(sp.p) || 1));
  // gli stessi filtri valgono per l'elenco e per i totali
  const apply = <Q,>(q0: Q): Q => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = q0 as any;
    if (stato === 'storni') q = q.not('reverses_id', 'is', null);
    else if (stato) q = q.eq('status', stato);
    if (term) q = q.or(`description.ilike.%${term}%,ref.ilike.%${term}%`);
    if (f.prj) q = q.eq('project_id', f.prj);
    if (f.acc) q = q.or(`account_id.eq.${f.acc},to_account_id.eq.${f.acc}`);
    if (f.from) q = q.gte('op_date', f.from);
    if (f.to) q = q.lte('op_date', f.to);
    if (f.cat) q = q.eq('category_id', f.cat);
    if (f.cp) q = q.eq('counterparty_id', f.cp);
    if (f.pm) q = q.eq('payment_method_id', f.pm);
    if (f.tipo) q = q.eq('kind', f.tipo);
    if (f.cur) q = q.eq('currency', f.cur);
    if (f.doc === 'no') q = q.not('no_doc_reason', 'is', null);
    if (f.doc === 'si') q = q.is('no_doc_reason', null).neq('kind', 'transfer');
    if (f.demo) q = q.eq('demo', f.demo === 'si');
    return q as Q;
  };
  const admin = can(me, ['super_admin', 'admin']);
  const [{ data, error, count }, { data: sums }, { data: projects }, { data: accounts }, { data: cats }, { data: cps }, { data: pms }, { count: allCount }, { data: bk }] = await Promise.all([
    apply(supabase.from('movements')
      .select(`id, ref, op_date, kind, status, demo, description, amount, currency, sign, amount_eur, reverses_id, no_doc_reason, reimb_status, paid_by, docs:movement_documents(count),
             account:accounts!movements_account_id_fkey(name_it, name_fr), category:categories(code), project:projects(name), counterparty:counterparties(name),
             method:payment_methods(name_it, name_fr), tr:movement_translations(source, it, fr)`, { count: 'exact' }))
      .order('op_date', { ascending: false }).order('created_at', { ascending: false })
      .range((page - 1) * PAGE, page * PAGE - 1).returns<Row[]>(),
    apply(supabase.from('movements').select('kind, sign, amount_eur, status, op_date')).neq('status', 'draft').neq('kind', 'transfer').limit(20000),
    supabase.from('projects').select('id, name').order('name'),
    supabase.from('accounts').select('id, name_it, name_fr').order('sort'),
    supabase.from('categories').select('id, code, name_it, name_fr, direction').eq('active', true).order('code'),
    supabase.from('counterparties').select('id, name').order('name').limit(1000),
    supabase.from('payment_methods').select('id, name_it, name_fr').order('sort'),
    admin ? supabase.from('movements').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
    admin ? supabase.from('settings').select('value').eq('key', 'last_backup').maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const inc = (sums ?? []).filter((r: { kind: string }) => r.kind === 'income').reduce((a: number, r: { amount_eur: string | null; sign: number }) => a + Number(r.amount_eur ?? 0) * r.sign, 0);
  const out = (sums ?? []).filter((r: { kind: string }) => r.kind === 'expense').reduce((a: number, r: { amount_eur: string | null; sign: number }) => a + Number(r.amount_eur ?? 0) * r.sign, 0);
  // mini grafici dei riquadri: una barra per mese del periodo filtrato (per giorno se il periodo sta in un mese, per anno oltre i 3 anni)
  type SR = { kind: string; sign: number; amount_eur: string | null; status: string; op_date: string };
  const sr = (sums ?? []) as SR[];
  const ds = sr.map((r) => r.op_date).sort();
  const d0 = f.from || ds[0] || '', d1 = f.to || ds[ds.length - 1] || '';
  const span = d0 && d1 ? (Number(d1.slice(0, 4)) - Number(d0.slice(0, 4))) * 12 + Number(d1.slice(5, 7)) - Number(d0.slice(5, 7)) + 1 : 0;
  const mode: 'd' | 'm' | 'y' = span <= 1 ? 'd' : span > 36 ? 'y' : 'm';
  const keys: string[] = [];
  if (d0 && d1 && d0 <= d1) {
    if (mode === 'd') { const n = new Date(Number(d0.slice(0, 4)), Number(d0.slice(5, 7)), 0).getDate(); for (let k = 1; k <= n; k++) keys.push(`${d0.slice(0, 8)}${String(k).padStart(2, '0')}`); }
    else if (mode === 'y') for (let k = Number(d0.slice(0, 4)); k <= Number(d1.slice(0, 4)); k++) keys.push(String(k));
    else for (let k = 0; k < span; k++) { const m0 = Number(d0.slice(0, 4)) * 12 + Number(d0.slice(5, 7)) - 1 + k; keys.push(`${Math.floor(m0 / 12)}-${String((m0 % 12) + 1).padStart(2, '0')}`); }
  }
  const keyOf = (d: string) => (mode === 'd' ? d : mode === 'y' ? d.slice(0, 4) : d.slice(0, 7));
  const kLabel = (k: string) => (mode === 'd' ? `${k.slice(8)}/${k.slice(5, 7)}` : mode === 'y' ? k : `${MESI[lang][Number(k.slice(5, 7)) - 1]!.toLowerCase()} ${k.slice(0, 4)}`);
  const idx = new Map(keys.map((k, i) => [k, i] as const));
  const bIn = keys.map(() => 0), bOut = keys.map(() => 0), bN = keys.map(() => 0);
  let nIn = 0, nOut = 0, nRec = 0;
  for (const r of sr) {
    const i = idx.get(keyOf(r.op_date)), v = Number(r.amount_eur ?? 0) * r.sign;
    if (r.kind === 'income') nIn++; else if (r.kind === 'expense') nOut++;
    if (r.status === 'recorded') nRec++;
    if (i == null) continue;
    bN[i]!++; if (r.kind === 'income') bIn[i]! += v; else if (r.kind === 'expense') bOut[i]! += v;
  }
  const cur: SP = { stato, q: term, progetto: f.prj, conto: f.acc, dal: f.from, al: f.to, codice: f.cat, tipo: f.tipo, cp: f.cp, metodo: f.pm, valuta: f.cur, doc: f.doc, demo: f.demo };
  const qs = (over: SP) => { const u = new URLSearchParams(); for (const [k, x] of Object.entries({ ...cur, p: '', ...over })) if (x) u.set(k, String(x)); return u.toString(); };
  const href = (over: SP) => { const s = qs(over); return s ? `/movimenti?${s}` : '/movimenti'; };
  const active = [f.prj, f.acc, f.from, f.to, f.cat, f.tipo, f.cp, f.pm, f.cur, f.doc, f.demo].filter(Boolean).length;
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const periods: [string, string, string][] = [
    [L('Questo mese', 'Ce mois'), iso(new Date(y, mo, 1)), iso(new Date(y, mo + 1, 0))],
    [L('Mese scorso', 'Mois dernier'), iso(new Date(y, mo - 1, 1)), iso(new Date(y, mo, 0))],
    [L('Ultimi 3 mesi', '3 derniers mois'), iso(new Date(y, mo - 2, 1)), iso(new Date(y, mo + 1, 0))],
    [L(`Anno ${y}`, `Année ${y}`), `${y}-01-01`, `${y}-12-31`],
  ];
  const e0 = (v: number) => money(v, 'EUR', lang);
  const net = inc - out;
  const bTip = (title: string, vals: number[], fmt: (v: number) => string) => keys.length > 31 ? title : `${title}\n${keys.map((k, i) => (vals[i] ? `${kLabel(k)}: ${fmt(vals[i]!)}` : '')).filter(Boolean).join('\n')}`;
  const axis = keys.length > 1 ? <div className="vzl"><span>{kLabel(keys[0]!)}</span><span>{kLabel(keys[keys.length - 1]!)}</span></div> : null;
  const expHref = `/api/v1/export/movimenti?anno=${(f.from || f.to || String(y)).slice(0, 4)}${stato && stato !== 'storni' ? `&stato=${stato}` : ''}`;
  // l'esportazione riguarda sempre l'anno intero (scelta del 14/11): il nome del pulsante lo dice
  const expYear = (f.from || f.to || String(y)).slice(0, 4);
  const expLabel = L(`Esporta tutto il ${expYear}`, `Exporter tout ${expYear}`);
  const stati: [string, string][] = [['', L('Tutti', 'Tous')], ['draft', L('Bozze', 'Brouillons')], ['recorded', L('Da verificare', 'À vérifier')], ['verified', L('Verificati', 'Vérifiés')], ['storni', L('Storni', 'Extournes')]];
  const demoCount = can(me, ['super_admin', 'admin']) && f.demo === 'si' ? total : 0;

  // descrizione nella lingua di chi legge (traduzione AI); le mancanti si chiedono in sottofondo
  type Tr = { source: string; it: string; fr: string };
  const trOf = (m: Row) => { const x = (m as unknown as { tr?: Tr | Tr[] | null }).tr; return Array.isArray(x) ? x[0] : x ?? undefined; };
  const trBy = new Map((data ?? []).map((m) => [m.id, trOf(m)] as const));
  const desc = (m: { id: string; description: string }) => { const x = trBy.get(m.id); return x && x.source === m.description ? (lang === 'fr' ? x.fr : x.it) : m.description; };
  const missing = (data ?? []).filter((m) => m.description && trBy.get(m.id)?.source !== m.description).map((m) => m.id);
  const bkAt = (bk?.value as { at?: string } | null)?.at ?? null;
  const bkFresh = Boolean(bkAt && Date.now() - Date.parse(bkAt) < 24 * 3600e3);
  return (
    <div className="stack">
      {missing.length > 0 && <AutoTranslate ids={missing} />}
      {sp.ok === 'purged' && <div className="note ok" role="status">{L('Movimento eliminato definitivamente. I suoi dati restano nel registro modifiche.', 'Mouvement supprimé définitivement. Ses données restent dans le journal des modifications.')}</div>}
      {sp.ok === 'purged_all' && <div className="note ok" role="status">{L('Tutti i movimenti sono stati eliminati. I loro dati restano nel registro modifiche e nel backup.', 'Tous les mouvements ont été supprimés. Leurs données restent dans le journal et la sauvegarde.')}</div>}
      {sp.err && <div className="note err" role="alert">{sp.err}</div>}
      {/* riquadri nel disegno di Cairn: riguardano i movimenti filtrati (bozze e giroconti esclusi dai totali), con una barra per mese del periodo */}
      <div className="kpis dk mvk">
        <div className="kpi">
          <div className="l">{L('Movimenti', 'Mouvements')}</div>
          <div className="v num">{num(total, lang)}</div>
          <Viz.Cols vals={bN} colors={bN.map((v) => (v ? 'var(--vz-plan)' : 'var(--band)'))} tip={bTip(L('Movimenti', 'Mouvements'), bN, (v) => num(v, lang))} />
          {bN.some(Boolean) && axis}
          <div className="s">{nRec > 0 ? <Link href={href({ stato: 'recorded' })} scroll={false}>{nRec === 1 ? L('1 da verificare', '1 à vérifier') : L(`${num(nRec, lang)} da verificare`, `${num(nRec, lang)} à vérifier`)}</Link> : L('niente da verificare', 'rien à vérifier')}</div>
        </div>
        <div className="kpi">
          <div className="l">{L('Entrate', 'Recettes')}</div>
          <div className="v num">{e0(inc)}</div>
          <Viz.Cols vals={bIn} colors={bIn.map((v) => (v ? 'var(--vz-real)' : 'var(--band)'))} tip={bTip(L('Entrate', 'Recettes'), bIn, e0)} />
          {bIn.some(Boolean) && axis}
          <div className="s">{nIn === 1 ? L('1 movimento', '1 mouvement') : L(`${num(nIn, lang)} movimenti`, `${num(nIn, lang)} mouvements`)}</div>
        </div>
        <div className="kpi">
          <div className="l">{L('Uscite', 'Dépenses')}</div>
          <div className="v num">{e0(out)}</div>
          <Viz.Cols vals={bOut} colors={bOut.map((v) => (v ? 'var(--vz-sp)' : 'var(--band)'))} tip={bTip(L('Uscite', 'Dépenses'), bOut, e0)} />
          {bOut.some(Boolean) && axis}
          <div className="s">{nOut === 1 ? L('1 movimento', '1 mouvement') : L(`${num(nOut, lang)} movimenti`, `${num(nOut, lang)} mouvements`)}</div>
        </div>
        <div className="kpi">
          <div className="l">{L('Saldo', 'Solde')}</div>
          <div className={`v num ${net < 0 ? 'neg' : 'pos'}`}>{e0(net)}</div>
          {inc > 0 || out > 0 ? (net >= 0
            ? <><Viz.Stack segs={[{ v: out, c: 'var(--vz-sp)' }, { v: net, c: 'var(--green-soft)' }]} max={Math.max(1, inc)} tip={`${L('Entrate', 'Recettes')}: ${e0(inc)}\n${L('Uscite', 'Dépenses')}: ${e0(out)}\n${L('Saldo', 'Solde')}: ${e0(net)}`} />
              <div className="vzl"><span>{L('uscite', 'dépenses')}</span><span>{L('avanzo', 'excédent')}</span></div></>
            : <><Viz.Stack segs={[{ v: inc, c: 'var(--vz-real)' }, { v: -net, c: 'var(--tax)' }]} max={Math.max(1, out)} tip={`${L('Entrate', 'Recettes')}: ${e0(inc)}\n${L('Uscite', 'Dépenses')}: ${e0(out)}\n${L('Saldo', 'Solde')}: ${e0(net)}`} />
              <div className="vzl"><span>{L('entrate', 'recettes')}</span><span>{L('disavanzo', 'déficit')}</span></div></>) : null}
          <div className="s">{L('entrate meno uscite', 'recettes moins dépenses')}</div>
        </div>
      </div>
      <ErrorNote prefix={t('error_load')} error={error} />

      <Panel>
        <FilterBar action="/movimenti" lang={lang} search={{ value: term, placeholder: t('search_mov') }}
          after={<a className="btn fb-exp" href={expHref} aria-label={expLabel} title={L('Scarica tutti i movimenti dell’anno: non segue i filtri', 'Télécharge tous les mouvements de l’année : ne suit pas les filtres')}><Ico name="download" /><span>{expLabel}</span></a>}
          active={active + (stato ? 1 : 0)} reset={term || stato || active > 0 ? '/movimenti' : null}
          result={L(`Mostra ${num(total, lang)} movimenti`, `Afficher ${num(total, lang)} mouvements`)}
          quick={<>
            {periods.map(([l, a, b]) => <Link key={l} href={href({ dal: a, al: b })} scroll={false} aria-current={f.from === a && f.to === b ? 'true' : undefined}>{l}</Link>)}
            <Link href={href({ stato: 'recorded' })} scroll={false} aria-current={stato === 'recorded' ? 'true' : undefined}>{L('Da verificare', 'À vérifier')}</Link>
            <Link href={href({ doc: 'no' })} scroll={false} aria-current={f.doc === 'no' ? 'true' : undefined}>{L('Motivo dichiarato', 'Motif déclaré')}</Link>
          </>}>
              <label className="field"><span className="flabel">{L('Stato', 'Statut')}</span>
                <select className="input" name="stato" defaultValue={stato}>{stati.map(([v, l]) => <option key={v} value={v}>{v ? l : t('all')}</option>)}</select></label>
              <label className="field"><span className="flabel">{t('type')}</span>
                <select className="input" name="tipo" defaultValue={f.tipo}><option value="">{t('all')}</option>
                  {(['expense', 'income', 'transfer'] as const).map((k) => <option key={k} value={k}>{t(`k_${k}`)}</option>)}</select></label>
              <label className="field"><span className="flabel">{L('Dal', 'Du')}</span><input className="input" type="date" name="dal" defaultValue={f.from} /></label>
              <label className="field"><span className="flabel">{L('Al', 'Au')}</span><input className="input" type="date" name="al" defaultValue={f.to} /></label>
              <label className="field"><span className="flabel">{L('Codice contabile', 'Code comptable')}</span>
                <select className="input" name="codice" defaultValue={f.cat}><option value="">{t('all')}</option>
                  {(cats ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} · {nm(lang, c)}</option>)}</select></label>
              <label className="field"><span className="flabel">{t('project')}</span>
                <select className="input" name="progetto" defaultValue={f.prj}><option value="">{t('all')}</option>
                  {(projects ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label className="field"><span className="flabel">{L('Fornitore o donatore', 'Fournisseur ou donateur')}</span>
                <select className="input" name="cp" defaultValue={f.cp}><option value="">{t('all')}</option>
                  {(cps ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label className="field"><span className="flabel">{L('Modalità di pagamento', 'Mode de paiement')}</span>
                <select className="input" name="metodo" defaultValue={f.pm}><option value="">{t('all')}</option>
                  {(pms ?? []).map((x) => <option key={x.id} value={x.id}>{nm(lang, x)}</option>)}</select></label>
              <label className="field"><span className="flabel">{L('Conto o cassa', 'Compte ou caisse')}</span>
                <select className="input" name="conto" defaultValue={f.acc}><option value="">{t('all')}</option>
                  {(accounts ?? []).map((x) => <option key={x.id} value={x.id}>{nm(lang, x)}</option>)}</select></label>
              <label className="field"><span className="flabel">{L('Valuta', 'Devise')}</span>
                <select className="input" name="valuta" defaultValue={f.cur}><option value="">{t('all')}</option><option>EUR</option><option>MGA</option></select></label>
              <label className="field"><span className="flabel">{t('f_doc')}</span>
                <select className="input" name="doc" defaultValue={f.doc}><option value="">{t('all')}</option>
                  <option value="si">{L('Con giustificativo', 'Avec justificatif')}</option><option value="no">{L('Senza giustificativo (motivo indicato)', 'Sans justificatif (motif indiqué)')}</option></select></label>
              <label className="field"><span className="flabel">{L('Dati', 'Données')}</span>
                <select className="input" name="demo" defaultValue={f.demo}><option value="">{L('Reali e dimostrativi', 'Réelles et de démonstration')}</option>
                  <option value="no">{L('Solo reali', 'Seulement réelles')}</option><option value="si">{L('Solo dimostrativi (DEMO)', 'Seulement DEMO')}</option></select></label>
        </FilterBar>
        <SavedFilters current={qs({})} lang={lang} />
        {demoCount > 0 && <div className="note" style={{ margin: '0 18px 14px' }}>{L(`Stai vedendo ${demoCount} movimenti dimostrativi. Per eliminarli tutti, con conferma del numero, vai a `, `Vous voyez ${demoCount} mouvements de démonstration. Pour tous les supprimer, avec confirmation du nombre, allez à `)}
          <Link href="/admin/dati#demo">{L('Impostazioni › Dati e sicurezza', 'Paramètres › Données et sécurité')}</Link>.</div>}
        {(data ?? []).length === 0 && (term || stato || active > 0 || page > 1) ? <p className="panel-b muted" style={{ margin: 0 }}>{t('empty_search')}</p>
          : (data ?? []).length === 0 ? <EmptyState title={t('empty_mov')} text={t('empty_mov_t')} badge="plus"
            action={<Link className="btn primary" href="/nuovo"><Ico name="plus" />{t('nav_new_long').replace('+ ', '')}</Link>} /> : <>
          <div className="mv-tw"><table className="t keep mv-table">
            <thead>
              <tr><th style={{ width: 36 }}><span className="sr-only">{t('type')}</span></th><th>{t('date')}</th><th>{t('description')}</th><th>{t('code')}</th>
                <th>{t('project')} · {t('account')}</th><th className="r">{t('amount')}</th><th style={{ width: 32 }}><span className="sr-only">{t('f_doc')}</span></th><th>{t('status')}</th></tr>
            </thead>
            <tbody>
              {data!.map((m) => {
                const signed = Number(m.amount) * m.sign * (m.kind === 'income' ? 1 : -1);
                return (
                  <tr key={m.id}>
                    <td><KindIcon kind={m.kind} label={t(`k_${m.kind}`)} faded={Boolean(m.reverses_id)} /></td>
                    <td className="num nw">{date(m.op_date)}<div className="muted small">{m.ref ?? L('bozza', 'brouillon')}</div></td>
                    <td className="mv-d"><Link className="rowlink" href={`/movimenti/${m.id}`}>{desc(m) || t(`k_${m.kind}`)}</Link>
                      {m.demo && <span className="chip warn tiny">DEMO</span>}{m.reverses_id && <span className="chip tiny">{t('reversal')}</span>}
                      {m.reimb_status === 'due' && <span className="chip warn tiny">{t('reimb_due_chip')}{m.paid_by ? ` · ${m.paid_by}` : ''}</span>}
                      {(m.counterparty || m.method) && <div className="muted small">{[m.counterparty?.name, m.method ? nm(lang, m.method) : null].filter(Boolean).join(' · ')}</div>}</td>
                    <td className="muted nw">{m.category?.code ?? '–'}</td>
                    <td>{m.project?.name ?? '–'}<div className="muted small">{nm(lang, m.account)}</div></td>
                    <td className={`r num nw ${m.kind === 'income' ? 'amt-in' : m.kind === 'transfer' ? 'amt-tr' : ''}`}>
                      {/* regola unica a ogni larghezza: euro in evidenza con il segno, valuta originale sotto in piccolo */}
                      {(() => { const eur = m.currency !== 'EUR' && m.amount_eur ? Number(m.amount_eur) * m.sign * (m.kind === 'income' ? 1 : -1) : null;
                        const orig = m.kind === 'transfer' ? money(m.amount, m.currency, lang) : `${signed > 0 ? '+' : ''}${money(signed, m.currency, lang)}`;
                        return <span className="two"><b>{eur != null ? `${eur > 0 ? '+' : ''}${money(m.kind === 'transfer' ? Math.abs(eur) : eur, 'EUR', lang)}` : orig}</b>{eur != null && <small>{orig}</small>}</span>; })()}</td>
                    <td>{m.kind !== 'transfer' && <DocIndicator count={m.docs?.[0]?.count ?? 0} noDocReason={m.no_doc_reason}
                      labels={{ has: t('doc_has'), missing: t('doc_missing'), none: t('doc_none') }} />}</td>
                    <td><StatusChip s={m.status} label={t(`st_${m.status}`)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
          {/* telefono: schede leggibili, non una tabella compressa */}
          <ul className="mv-cards">
            {data!.map((m) => {
              const signed = Number(m.amount) * m.sign * (m.kind === 'income' ? 1 : -1);
              const eur = m.currency !== 'EUR' && m.amount_eur ? Number(m.amount_eur) * m.sign * (m.kind === 'income' ? 1 : -1) : null;
              return (
                <li key={m.id}><Link href={`/movimenti/${m.id}`}>
                  <KindIcon kind={m.kind} label={t(`k_${m.kind}`)} faded={Boolean(m.reverses_id)} />
                  <div className="mc-m"><b className="mc-t">{desc(m) || t(`k_${m.kind}`)}</b>
                    <span className="mc-s">{[date(m.op_date), m.category?.code, m.project?.name].filter(Boolean).map((x, i) => <span key={i}>{x}</span>)}</span>
                    <span className="mc-c"><StatusChip s={m.status} label={t(`st_${m.status}`)} />{m.demo && <span className="chip warn tiny">DEMO</span>}
                      {m.kind !== 'transfer' && !m.docs?.[0]?.count && m.no_doc_reason && <span className="chip tiny">{L('motivo dichiarato', 'motif déclaré')}</span>}</span></div>
                  <span className={`mc-a two num ${m.kind === 'income' ? 'amt-in' : m.kind === 'transfer' ? 'amt-tr' : ''}`}>
                    <b>{eur != null ? `${eur > 0 ? '+' : ''}${money(eur, 'EUR', lang)}` : m.kind === 'transfer' ? money(m.amount, m.currency, lang) : `${signed > 0 ? '+' : ''}${money(signed, m.currency, lang)}`}</b>
                    {eur != null && <small>{money(m.kind === 'transfer' ? Number(m.amount) : signed, m.currency, lang)}</small>}</span>
                </Link></li>
              );
            })}
          </ul>
        </>}
        {pages > 1 && (
          <nav className="pager panel-f" aria-label={t('f_pages')}>
            {page > 1 ? <Link className="btn" href={href({ p: String(page - 1) })} rel="prev">← {t('f_prev')}</Link> : <span />}
            <span className="muted num">{page} / {pages}</span>
            {page < pages ? <Link className="btn" href={href({ p: String(page + 1) })} rel="next">{t('f_next')} →</Link> : <span />}
          </nav>
        )}
      </Panel>
    </div>
  );
}
