import Link from 'next/link';
import { STAFF, can, requireMe } from '@/lib/session';
import { date, money, nm } from '@/lib/format';
import { Empty, ErrorNote } from '@/components/Page';
import { BalancesTable, type Balance } from '@/components/Balances';
import { CountryMark } from '@/components/CountryMark';
import { CashCounter } from '@/components/CashCounter';
import { Viz } from '@/components/Charts';
import { CIcon } from '@/components/CIcon';

export const dynamic = 'force-dynamic';

type CC = { id: string; count_date: string; counted: string; system_balance: string; difference: string; notes: string | null;
            counted_by: string; account: { name_it: string; name_fr: string; currency: string } | null };
type Leg = { movement_id: string; side: string; ref: string; op_date: string; description: string; kind: string; status: string; amount: string };

// Conti (richiesta dell'11/11): in alto 4 riquadri nel disegno di Cairn (liquidità totale, Italia, Madagascar, anticipi aperti);
// sotto i conti veri (banca, cassa, mobile) per paese: il nome apre il dettaglio del conto, «da verificare» apre i movimenti da verificare.
// I conti di anticipo non sono conti dell'ente ma soldi in mano alle persone: stanno nella pagina Anticipi, qui solo il totale.
export default async function Accounts({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; conto?: string }> }) {
  const { ok, err, conto } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const staff = can(me, STAFF);
  const [{ data, error }, { data: counts }, { data: users }, { data: fxl }] = await Promise.all([
    supabase.rpc('account_balances'),
    supabase.from('cash_counts').select('id, count_date, counted, system_balance, difference, notes, counted_by, account:accounts(name_it, name_fr, currency)')
      .order('count_date', { ascending: false }).order('created_at', { ascending: false }).limit(20).returns<CC[]>(),
    supabase.rpc('user_directory'),
    supabase.rpc('fx_rate_for', { p_date: new Date().toISOString().slice(0, 10) }).then((r) => ({ data: r.data ? [{ rate: r.data as number }] : [] })),
  ]);
  const all = (data ?? []) as Balance[];
  const rows = all.filter((r) => r.kind !== 'advance');
  const adv = all.filter((r) => r.kind === 'advance' && Number(r.balance) > 0);
  const cash = rows.filter((r) => r.kind === 'cash');
  const name = new Map(((users ?? []) as { id: string; full_name: string }[]).map((u) => [u.id, u.full_name]));
  const fx = Number(fxl?.[0]?.rate ?? 0);
  const eur = (r: Balance) => (r.currency === 'EUR' ? Number(r.balance) : fx > 0 ? Number(r.balance) / fx : 0);
  const e0 = (v: number) => money(Math.round(v), 'EUR', lang).replace(/,00(?=\s?€)/, '');
  const pc = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '–');
  const lg = (txt: string) => (txt.length > 11 ? ' long' : '');   // cifre lunghe (ariary): più piccole su telefono
  const byLoc = (loc: string) => rows.filter((r) => r.location === loc);
  const sumEur = (xs: Balance[]) => xs.reduce((a, r) => a + eur(r), 0);
  // totale di un paese: nella sua valuta se i conti ne hanno una sola, altrimenti in euro
  const native = (xs: Balance[]) => { const cs = [...new Set(xs.map((r) => r.currency))]; return cs.length === 1 ? { v: xs.reduce((a, r) => a + Number(r.balance), 0), c: cs[0]! } : { v: sumEur(xs), c: 'EUR' as const }; };
  const it = byLoc('IT'), mg = byLoc('MG'), itEur = sumEur(it), mgEur = sumEur(mg), tot = itEur + mgEur;
  const seg = (xs: Balance[]) => [...xs].filter((r) => eur(r) > 0).sort((a, b) => eur(b) - eur(a)).slice(0, 6).map((r, i) => ({ v: eur(r), c: `var(--dn${i + 1})`, n: nm(lang, r), r }));
  const tipOf = (xs: Balance[]) => xs.map((r) => `${nm(lang, r)}: ${money(r.balance, r.currency, lang)}`).join('\n');
  const advEur = sumEur(adv), advN = native(adv);
  const holder = (r: Balance) => nm(lang, r).replace(/^(Anticipi|Avances)\s*[–-]\s*/i, '');
  const unver = rows.reduce((a, r) => a + r.unverified, 0);
  const locTile = (loc: 'IT' | 'MG', xs: Balance[], totEur: number) => {
    const n = native(xs), sg = seg(xs), top = sg[0];
    return (
      <a className="kpi" href={`#conti-${loc.toLowerCase()}`}>
        <div className="l">{loc === 'IT' ? t('italy') : t('madagascar')}</div>
        <div className={`v num${n.v < 0 ? ' neg' : ''}${lg(money(n.v, n.c, lang))}`}>{money(n.v, n.c, lang)}</div>
        {sg.length > 0 && <><Viz.Stack segs={sg} max={sg.reduce((a, x) => a + x.v, 0)} tip={tipOf(xs)} />
          <div className="vzl"><span>{top!.n}</span><span>{xs.length === 1 ? L('1 conto', '1 compte') : L(`${xs.length} conti`, `${xs.length} comptes`)}</span></div></>}
        <div className="s">{n.c !== 'EUR' ? `≈ ${e0(totEur)} · ${L('cambio', 'taux')} ${money(fx, 'MGA', lang)}` : top ? `${top.n}: ${pc(top.v, sg.reduce((a, x) => a + x.v, 0))}` : L('nessun conto', 'aucun compte')}</div>
      </a>);
  };

  // ── dettaglio di un conto (scheda laterale) ──
  const sel = conto ? rows.find((r) => r.account_id === conto) : undefined;
  let legs: Leg[] = [];
  if (sel && staff) legs = ((await supabase.rpc('account_legs', { p_account: sel.account_id })).data ?? []) as Leg[];
  let run = sel ? Number(sel.opening_balance) : 0;
  const hist = legs.map((l) => { run = Math.round((run + Number(l.amount)) * 100) / 100; return { ...l, run }; }).reverse().slice(0, 40);
  const KIND: Record<string, [string, string]> = { bank: ['Conto bancario', 'Compte bancaire'], cash: ['Cassa contanti', 'Caisse espèces'], mobile: ['Portafoglio elettronico', 'Portefeuille électronique'] };

  return (
    <div className="stack">
      <ErrorNote prefix={t('error_load')} error={error} />
      {ok === 'cash' && <div className="note ok" role="status">{t('cc_ok')}</div>}
      {err && <div className="note err">{err}</div>}
      <div className="kpis dk">
        <div className="kpi">
          <div className="l">{L('Liquidità totale', 'Liquidités totales')}</div>
          <div className={`v num${tot < 0 ? ' neg' : ''}`}>{e0(tot)}</div>
          {tot > 0 && <><Viz.Stack segs={[{ v: itEur, c: 'var(--navy)' }, { v: mgEur, c: 'var(--green-soft)' }]} max={Math.max(1, Math.max(0, itEur) + Math.max(0, mgEur))}
            tip={`${t('italy')}: ${e0(itEur)}\n${t('madagascar')}: ${e0(mgEur)}`} />
            <div className="vzl"><span>IT {pc(Math.max(0, itEur), Math.max(0, itEur) + Math.max(0, mgEur))}</span><span>MG {pc(Math.max(0, mgEur), Math.max(0, itEur) + Math.max(0, mgEur))}</span></div></>}
          <div className="s">{unver > 0 ? <Link href="/movimenti?stato=recorded">{unver === 1 ? L('1 movimento da verificare', '1 mouvement à vérifier') : L(`${unver} movimenti da verificare`, `${unver} mouvements à vérifier`)}</Link>
            : (rows.length === 1 ? L('1 conto, tutto verificato', '1 compte, tout vérifié') : L(`${rows.length} conti, tutto verificato`, `${rows.length} comptes, tout vérifié`))}</div>
        </div>
        {locTile('IT', it, itEur)}
        {locTile('MG', mg, mgEur)}
        <Link className="kpi" href="/anticipi">
          <div className="l">{L('Anticipi aperti', 'Avances en cours')}</div>
          <div className={`v num${adv.length ? lg(money(advN.v, advN.c, lang)) : ''}`}>{adv.length ? money(advN.v, advN.c, lang) : e0(0)}</div>
          {advEur > 0 && <><Viz.Stack segs={seg(adv)} max={advEur} tip={adv.map((r) => `${holder(r)}: ${money(r.balance, r.currency, lang)}`).join('\n')} />
            <div className="vzl"><span>{holder(seg(adv)[0]!.r)}</span><span>{adv.length === 1 ? L('1 persona', '1 personne') : L(`${adv.length} persone`, `${adv.length} personnes`)}</span></div></>}
          <div className="s">{adv.length ? (advN.c !== 'EUR' ? `≈ ${e0(advEur)} · ` : '') + L('contanti in mano alle persone', 'espèces confiées aux personnes') : L('nessun anticipo da giustificare', 'aucune avance à justifier')}</div>
        </Link>
      </div>

      {(['IT', 'MG'] as const).map((loc) => {
        const xs = byLoc(loc), n = native(xs);
        return (
          <section key={loc} className="panel country" id={`conti-${loc.toLowerCase()}`}>
            <div className="panel-h"><CountryMark loc={loc} label={loc === 'IT' ? t('italy') : t('madagascar')} />
              <h2>{loc === 'IT' ? t('italy') : t('madagascar')}</h2><div className="spacer" />
              {xs.length > 0 && <span className="eyebrow">{L('totale', 'total')} <b className={`num${n.v < 0 ? ' neg' : n.v > 0 ? ' pos' : ''}`}>{money(n.v, n.c, lang)}</b></span>}</div>
            {xs.length === 0 ? <Empty text={t('none')} /> :
              <BalancesTable rows={xs} t={t} lang={lang} detail noPlace hrefFor={(r) => `/conti?conto=${r.account_id}`} verHref={(r) => `/movimenti?conto=${r.account_id}&stato=recorded`} />}
          </section>);
      })}

      <section className="panel" id="conta">
        <div className="panel-h"><h2 className="h-ic"><span className="hic"><CIcon name="wallet" size={15} /></span>{t('cc_title')}</h2></div>
        <div className="panel-b">
        <div className="stack" style={{ gap: 14 }}>
          {me?.role !== 'read_only' && cash.length > 0 && (
            <CashCounter lang={lang} accounts={cash.map((c) => ({ id: c.account_id, label: nm(lang, c), currency: c.currency, balance: Number(c.balance) }))}
              L={{ account: t('account'), date: t('date'), den: t('cc_den'), qty: t('cc_qty'), total: t('cc_total'), counted: t('cc_counted'),
                expected: t('cc_expected'), diff: t('cc_diff'), notes: t('f_notes'), save: t('cc_save'), hint: t('cc_hint'), pieces: L('Pezzi', 'Nombre'), notes_bank: L('Banconote', 'Billets'), coins: L('Monete', 'Pièces de monnaie'), notes_small: L('Banconote, tagli piccoli', 'Billets, petites coupures') }} />
          )}
          {(counts ?? []).length > 0 && (
            <table className="t">
              <thead><tr><th>{t('date')}</th><th>{t('account')}</th><th className="r">{t('cc_counted')}</th>
                <th className="r hm">{t('cc_system')}</th><th className="r">{t('cc_diff')}</th><th className="hm">{t('cc_by')}</th></tr></thead>
              <tbody>
                {counts!.map((c) => {
                  const cur = c.account?.currency ?? 'EUR';
                  const d = Number(c.difference);
                  return (
                    <tr key={c.id}>
                      <td className="num nw">{date(c.count_date)}</td><td>{nm(lang, c.account)}</td>
                      <td className="r num">{money(c.counted, cur, lang)}</td>
                      <td className="r num hm">{money(c.system_balance, cur, lang)}</td>
                      <td className="r num" style={{ color: d === 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{d > 0 ? '+' : ''}{money(d, cur, lang)}</td>
                      <td className="hm">{name.get(c.counted_by) ?? '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        </div>
      </section>

      {sel && (
        <div className="sheet-bg dl-sheet-bg">
          <Link className="dl-sheet-x" href="/conti" scroll={false} aria-label={L('Chiudi', 'Fermer')} />
          <aside className="sheet sheet-help dl-sheet aw-sheet acc-sheet" role="dialog" aria-modal="true" aria-label={nm(lang, sel)}>
            <div className="sheet-h"><CountryMark loc={sel.location} label={sel.location === 'IT' ? t('italy') : t('madagascar')} size={30} /><h2>{nm(lang, sel)}</h2><div className="spacer" /><Link className="btn ghost" href="/conti" scroll={false}>{L('Chiudi', 'Fermer')}</Link></div>
            <div className="sheet-b">
              <div className="aw-top"><span className="muted">{L('Saldo di oggi', 'Solde du jour')}</span>
                <b className={`num${Number(sel.balance) < 0 ? ' neg' : Number(sel.balance) > 0 ? ' pos' : ''}`}>{money(sel.balance, sel.currency, lang)}</b>
                <small className="muted">{L(...(KIND[sel.kind] ?? ['Conto', 'Compte']))} · {sel.currency}{sel.currency !== 'EUR' && fx > 0 ? ` · ≈ ${e0(eur(sel))}` : ''}</small></div>
              <dl className="acc-3">
                <div><dt title={t('acc_opening')}>{L('Iniziale', 'Initial')}</dt><dd className="num">{money(sel.opening_balance, sel.currency, lang)}</dd></div>
                <div><dt>{t('acc_in')}</dt><dd className="num">{money(sel.movements_in, sel.currency, lang)}</dd></div>
                <div><dt title={t('acc_out')}>{L('Uscite', 'Sorties')}</dt><dd className="num">{money(sel.movements_out, sel.currency, lang)}</dd></div>
              </dl>
              <div className="aw-btns acc-btns">
                <Link className="btn primary" href={`/movimenti?conto=${sel.account_id}`}>{L('Tutti i movimenti', 'Tous les mouvements')}</Link>
                {sel.unverified > 0 && <Link className="btn" href={`/movimenti?conto=${sel.account_id}&stato=recorded`}>{L(`Da verificare · ${sel.unverified}`, `À vérifier · ${sel.unverified}`)}</Link>}
                {staff && sel.kind !== 'cash' && <Link className="btn" href={`/riconciliazione?conto=${sel.account_id}`}>{L('Riconcilia', 'Rapprocher')}</Link>}
                {sel.kind === 'cash' && me?.role !== 'read_only' && <a className="btn" href="/conti#conta">{t('cc_title')}</a>}
              </div>
              {staff && <>
                <h3 className="acc-h3">{L('Ultimi movimenti', 'Derniers mouvements')}</h3>
                {hist.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t('none')}</p> : (
                  <ul className="aw-st acc-st">
                    {hist.map((l) => (
                      <li key={`${l.movement_id}-${l.side}`}><span className="aw-d">{date(l.op_date)}</span>
                        <span><Link href={`/movimenti/${l.movement_id}`}>{l.description}</Link><small className="muted acc-ref">{l.ref}{l.kind === 'transfer' ? ` · ${L('giroconto', 'virement interne')}` : ''}{l.status === 'recorded' ? ` · ${t('nav_verify').toLowerCase()}` : ''}</small></span>
                        <span className="two"><b className={`num${Number(l.amount) > 0 ? ' pos' : ''}`}>{Number(l.amount) > 0 ? '+' : ''}{money(l.amount, sel.currency, lang)}</b><small className="num">{money(l.run, sel.currency, lang)}</small></span></li>
                    ))}
                  </ul>)}
                {legs.length > hist.length && <p className="muted small" style={{ margin: '10px 0 0' }}>{L(`Gli ultimi ${hist.length} di ${legs.length}: l’elenco completo è nel Registro.`, `Les ${hist.length} derniers sur ${legs.length} : la liste complète est dans le Journal.`)}</p>}
              </>}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
