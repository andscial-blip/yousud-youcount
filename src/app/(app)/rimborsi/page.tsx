import Link from 'next/link';
import { RESP, requireMe } from '@/lib/session';
import { money } from '@/lib/format';
import type { Key } from '@/lib/i18n';
import { ErrorNote, Panel } from '@/components/Page';
import { Viz } from '@/components/Charts';
import { CIcon } from '@/components/CIcon';
import { MESI } from '@/lib/viz';
import { ReimburseForm, type DueRow } from '@/components/ReimburseForm';

export const dynamic = 'force-dynamic';

type Row = DueRow & { created_by: string; amount_eur: string | null; fx_rate: string | null };
type Paid = { id: string; ref: string; op_date: string; amount: string; currency: string; paid_by: string | null; reimb_batch: string;
  account: { name_it: string; name_fr: string | null } | null };

// Rimborsi (richieste del 10 e 11/11): in alto 4 riquadri nel disegno di Cairn (quanto dobbiamo, da quanto aspettano,
// giustificativi mancanti, rimborsato nell'anno); poi una riga per persona con quanto le dobbiamo: aprendola si vedono
// le spese e un solo tasto «Rimborsa X» (cassa proposta, data di oggi). Sotto, gli ultimi rimborsi.
export default async function Reimbursements({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; p?: string; c?: string }> }) {
  const sp = await searchParams;
  const { ok, err } = sp;
  const { supabase, me, t, lang } = await requireMe();
  const resp = Boolean(me && RESP.includes(me.role));
  const LL = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const now = new Date(), Y = now.getFullYear();
  const td = `${Y}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [{ data, error }, { data: accounts }, { data: methods }, { data: paid }, { data: paidY }, { data: fxl }] = await Promise.all([
    supabase.from('movements').select(`id, description, amount, currency, fx_rate, amount_eur, doc_date, op_date, paid_by, created_by,
        project:projects(name), category:categories(code), docs:movement_documents(count), no_doc_reason`)
      .eq('reimb_status', 'due').order('paid_by').order('doc_date').limit(2000).returns<Row[]>(),
    supabase.from('accounts').select('id, name_it, name_fr, currency, kind').eq('active', true).neq('kind', 'advance').order('sort'),
    supabase.from('payment_methods').select('id, name_it, name_fr').eq('active', true).order('sort'),
    supabase.from('movements').select('id, ref, op_date, amount, currency, paid_by, reimb_batch, account:accounts!movements_account_id_fkey(name_it, name_fr)')
      .eq('reimb_status', 'paid').order('reimbursed_at', { ascending: false }).limit(60).returns<Paid[]>(),
    supabase.from('movements').select('amount, currency, amount_eur, fx_rate, op_date, reimb_batch').eq('reimb_status', 'paid')
      .gte('op_date', `${Y}-01-01`).lte('op_date', `${Y}-12-31`).limit(5000),
    supabase.from('fx_rates').select('rate').order('year', { ascending: false }).order('month', { ascending: false }).limit(1),
  ]);
  const fxNow = Number(fxl?.[0]?.rate ?? 0);
  // controvalore in euro (serve solo ai riquadri e ai confronti: il rimborso si fa sempre nella valuta della spesa)
  const eurOf = (r: { amount: string; currency: string; amount_eur: string | null; fx_rate: string | null }) =>
    r.currency === 'EUR' ? Number(r.amount) : r.amount_eur != null ? Math.abs(Number(r.amount_eur)) : Number(r.fx_rate) > 0 ? Number(r.amount) / Number(r.fx_rate) : fxNow > 0 ? Number(r.amount) / fxNow : 0;
  const e2 = (v: number) => money(v, 'EUR', lang);
  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const daysAgo = (d: string) => Math.max(0, Math.round((Date.parse(td) - Date.parse(d)) / 86400000));
  const L = (o: { name_it: string; name_fr: string | null } | null) => (!o ? '–' : lang === 'fr' && o.name_fr ? o.name_fr : o.name_it);
  // una riga per persona e valuta (si rimborsa una valuta per volta)
  const groups = new Map<string, { person: string; currency: string; rows: Row[] }>();
  for (const r of data ?? []) {
    const k = `${r.paid_by ?? '–'}|${r.currency}`;
    if (!groups.has(k)) groups.set(k, { person: r.paid_by ?? '–', currency: r.currency, rows: [] });
    groups.get(k)!.rows.push(r);
  }
  const hasDoc = (r: Row) => Boolean(r.docs?.[0]?.count || r.no_doc_reason);
  const totals = new Map<string, number>();
  for (const r of data ?? []) totals.set(r.currency, (totals.get(r.currency) ?? 0) + Number(r.amount));
  const sel = sp.p != null && sp.c ? groups.get(`${sp.p}|${sp.c}`) : undefined;
  const open = (g: { person: string; currency: string }) => `/rimborsi?p=${encodeURIComponent(g.person)}&c=${g.currency}`;
  // ultimi rimborsi, uno per pacchetto
  const batches = new Map<string, { date: string; person: string; currency: string; total: number; refs: { id: string; ref: string }[]; account: string }>();
  for (const p of paid ?? []) {
    const b = batches.get(p.reimb_batch) ?? { date: p.op_date, person: p.paid_by ?? '–', currency: p.currency, total: 0, refs: [], account: L(p.account) };
    b.total += Number(p.amount); b.refs.push({ id: p.id, ref: p.ref });
    if (b.person !== (p.paid_by ?? '–') && !b.person.includes('…')) b.person = `${b.person}…`;
    batches.set(p.reimb_batch, b);
  }
  // ---- riquadri ----
  const due = data ?? [];
  const sumOf = (rows: Row[]) => rows.reduce((a, r) => a + Number(r.amount), 0);
  const people = [...new Set(due.map((r) => r.paid_by ?? '–'))].map((n) => ({ n, eur: due.filter((r) => (r.paid_by ?? '–') === n).reduce((a, r) => a + eurOf(r), 0) })).sort((a, b) => b.eur - a.eur);
  const dueEur = people.reduce((a, x) => a + x.eur, 0);
  const curs = [...totals.keys()];
  const since = (r: Row) => r.doc_date ?? r.op_date;
  const oldest = due.length ? [...due].sort((a, b) => since(a).localeCompare(since(b)))[0]! : null;
  const maxDays = oldest ? daysAgo(since(oldest)) : 0;
  const AGE = [7, 30, 60];
  const ageBuckets = [0, 0, 0, 0];
  for (const r of due) { const d = daysAgo(since(r)); ageBuckets[d <= AGE[0]! ? 0 : d <= AGE[1]! ? 1 : d <= AGE[2]! ? 2 : 3]! += eurOf(r); }
  const AGE_C = ['var(--green-soft)', 'var(--vz-sp)', 'var(--amber-soft)', 'var(--tax)'];
  const AGE_L = [LL('fino a 7 giorni', 'jusqu’à 7 jours'), LL('da 8 a 30 giorni', 'de 8 à 30 jours'), LL('da 31 a 60 giorni', 'de 31 à 60 jours'), LL('oltre 60 giorni', 'plus de 60 jours')];
  const missing = due.filter((r) => !hasDoc(r)).length, ready = due.length - missing;
  const py = (paidY ?? []) as { amount: string; currency: string; amount_eur: string | null; fx_rate: string | null; op_date: string; reimb_batch: string | null }[];
  const paidM = Array.from({ length: 12 }, () => 0);
  for (const r of py) paidM[Number(r.op_date.slice(5, 7)) - 1]! += eurOf(r);
  const paidTot = paidM.reduce((a, v) => a + v, 0);
  const paidN = new Set(py.map((r) => r.reimb_batch ?? r.op_date)).size;
  const lastPaid = py.length ? py.map((r) => r.op_date).sort().pop()! : null;
  const ini = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '–';
  const errKey = err ? (`err_${err.split(':')[0]}` as Key) : null;
  const errBox = err ? (() => {
    const known = t(errKey!) !== errKey ? t(errKey!) : null;
    const detail = err.includes(':') ? err.slice(err.indexOf(':') + 1).trim() : err;
    return <div className="note err">{known ?? detail}{known && detail && <><br /><span className="muted">{detail}</span></>}</div>;
  })() : null;
  // cassa proposta: quella in contanti della valuta, se c'è, altrimenti il primo conto della valuta
  const accFor = (cur: string) => { const xs = (accounts ?? []).filter((a) => a.currency === cur); const cash = xs.filter((a) => a.kind === 'cash');
    return [...cash, ...xs.filter((a) => a.kind !== 'cash')].map((a) => ({ id: a.id, name: L(a) })); };

  return (
    <div className="stack">
      {ok && <div className="note ok" role="status">{t('reimb_done')} {ok}</div>}
      {!sel && errBox}
      <ErrorNote prefix={t('error_load')} error={error} />
      {/* 4 riquadri nel disegno di Cairn: cifra, mini grafico, una riga di contesto; nessun filo colorato */}
      <div className="kpis dk rbk">
        <div className="kpi">
          <div className="l">{LL('Da rimborsare', 'À rembourser')}</div>
          <div className="v num">{due.length === 0 ? money(0, 'EUR', lang) : curs.length === 1 ? money(totals.get(curs[0]!)!, curs[0]!, lang) : e2(dueEur)}</div>
          {dueEur > 0 && <><Viz.Stack segs={people.slice(0, 6).map((x, i) => ({ v: x.eur, c: `var(--dn${i + 1})` }))} max={dueEur} tip={people.map((x) => `${x.n}: ${e2(x.eur)}`).join('\n')} />
            <div className="vzl"><span>{people[0]!.n.split(' ')[0]}</span><span>{people.length === 1 ? LL('1 persona', '1 personne') : LL(`${people.length} persone`, `${people.length} personnes`)}</span></div></>}
          <div className="s">{due.length === 0 ? LL('non dobbiamo niente a nessuno', 'nous ne devons rien à personne')
            : curs.length === 1 ? (curs[0] === 'EUR' ? (due.length === 1 ? LL('1 spesa', '1 dépense') : LL(`${due.length} spese`, `${due.length} dépenses`)) : `≈ ${e2(dueEur)}`)
            : [...totals.entries()].map(([c, v]) => money(v, c, lang)).join(' + ')}</div>
        </div>
        <div className="kpi">
          <div className="l">{LL('In attesa da', 'En attente depuis')}</div>
          <div className={`v num${maxDays > 60 ? ' neg' : ''}`}>{!oldest ? '–' : maxDays === 0 ? LL('oggi', 'aujourd’hui') : maxDays === 1 ? LL('1 giorno', '1 jour') : LL(`${maxDays} giorni`, `${maxDays} jours`)}</div>
          {dueEur > 0 && <><Viz.Cols vals={ageBuckets} colors={ageBuckets.map((v, i) => (v ? AGE_C[i]! : 'var(--band)'))} tip={ageBuckets.map((v, i) => `${AGE_L[i]}: ${e2(v)}`).join('\n')} />
            <div className="vzl"><span>{LL('≤ 7 gg', '≤ 7 j')}</span><span>{LL('oltre 60 gg', 'plus de 60 j')}</span></div></>}
          <div className="s">{oldest ? LL(`la più vecchia: ${dm(since(oldest))}, ${oldest.paid_by ?? '–'}`, `la plus ancienne : ${dm(since(oldest))}, ${oldest.paid_by ?? '–'}`) : LL('nessuna spesa in attesa', 'aucune dépense en attente')}</div>
        </div>
        <div className="kpi">
          {due.length > 0 && <Viz.Ring p={ready / due.length} color={missing ? 'var(--gold-d)' : 'var(--green-soft)'} tip={LL(`Con giustificativo: ${ready} su ${due.length}`, `Avec pièce : ${ready} sur ${due.length}`)} />}
          <div className="l">{LL('Senza giustificativo', 'Sans pièce')}</div>
          <div className={`v num${missing ? ' amb' : ''}`}>{missing}</div>
          {due.length > 0 && <><Viz.Stack segs={[{ v: ready, c: 'var(--green-soft)' }, { v: missing, c: 'var(--amber-soft)' }]} max={due.length} tip={LL(`Con giustificativo: ${ready}\nDa completare: ${missing}`, `Avec pièce : ${ready}\nÀ compléter : ${missing}`)} />
            <div className="vzl"><span>{LL(`con ${ready}`, `avec ${ready}`)}</span><span>{LL(`senza ${missing}`, `sans ${missing}`)}</span></div></>}
          <div className="s">{missing ? LL('da completare prima del rimborso', 'à compléter avant le remboursement') : due.length ? LL('tutte le spese sono documentate', 'toutes les dépenses sont documentées') : LL('niente da completare', 'rien à compléter')}</div>
        </div>
        <div className="kpi">
          <div className="l">{LL(`Rimborsato nel ${Y}`, `Remboursé en ${Y}`)}</div>
          <div className="v num">{e2(paidTot)}</div>
          {paidTot > 0 && <><Viz.Cols vals={paidM} colors={paidM.map((v) => (v ? 'var(--vz-real)' : 'var(--band)'))} tip={`${LL('Rimborsato', 'Remboursé')} ${Y}\n${paidM.map((v, i) => (v ? `${MESI[lang][i]}: ${e2(v)}` : '')).filter(Boolean).join('\n')}`} />
            <div className="vzl"><span>{MESI[lang][0]!.toLowerCase()}</span><span>{MESI[lang][11]!.toLowerCase()}</span></div></>}
          <div className="s">{paidN === 0 ? LL('nessun rimborso quest’anno', 'aucun remboursement cette année') : `${paidN === 1 ? LL('1 rimborso', '1 remboursement') : LL(`${paidN} rimborsi`, `${paidN} remboursements`)} · ${LL('ultimo il', 'dernier le')} ${dm(lastPaid!)}`}</div>
        </div>
      </div>

      <Panel title={LL('Rimborsi da effettuare', 'Remboursements à effectuer')} icon="users" className="rb-panel"
        right={<Link className="btn primary" href="/nuovo?tipo=expense&tasca=1"><CIcon name="plus" size={15} />{LL('Spesa pagata di tasca mia', 'Dépense payée de ma poche')}</Link>}>
        {groups.size === 0 ? (
          <div className="rb-empty"><span className="rb-av ok"><CIcon name="check" size={16} /></span>
            <div><b>{t('reimb_none')}</b><small className="muted">{LL('Quando qualcuno paga una spesa di tasca propria, si registra con «Spesa pagata di tasca mia» e compare qui, pronta per essere rimborsata.',
              'Quand quelqu’un paie une dépense de sa poche, on l’enregistre avec « Dépense payée de ma poche » et elle apparaît ici, prête à être remboursée.')}</small></div></div>
        ) : (
          <ul className="aw-list rb-who">
            {[...groups.values()].sort((a, b) => b.rows.reduce((s, r) => s + eurOf(r), 0) - a.rows.reduce((s, r) => s + eurOf(r), 0)).map((g) => {
              const nd = g.rows.filter((r) => !hasDoc(r)).length, tot = sumOf(g.rows);
              const first = [...g.rows].sort((a, b) => since(a).localeCompare(since(b)))[0]!;
              return (
                <li key={`${g.person}|${g.currency}`}><Link href={open(g)} scroll={false} className={sel === g ? 'sel' : ''}>
                  <span className="rb-av" aria-hidden="true">{ini(g.person)}</span>
                  <span className="aw-n"><b>{g.person}</b><small className="muted">{g.rows.length === 1 ? LL(`1 spesa del ${dm(since(first))}`, `1 dépense du ${dm(since(first))}`) : LL(`${g.rows.length} spese, la più vecchia del ${dm(since(first))}`, `${g.rows.length} dépenses, la plus ancienne du ${dm(since(first))}`)}</small></span>
                  {nd > 0 && <span className="cdp soon rb-nd">{nd === 1 ? LL('1 senza giustificativo', '1 sans pièce') : LL(`${nd} senza giustificativo`, `${nd} sans pièce`)}</span>}
                  <span className="aw-b num">{money(tot, g.currency, lang)}{g.currency !== 'EUR' && <small>≈ {e2(g.rows.reduce((s, r) => s + eurOf(r), 0))}</small>}</span>
                  <span className="btn small rb-go">{resp ? LL('Rimborsa', 'Rembourser') : LL('Apri', 'Ouvrir')}</span>
                </Link></li>);
            })}
          </ul>
        )}
      </Panel>
      {batches.size > 0 && (
        <Panel title={t('reimb_recent')} icon="clock">
          <ul className="rb-recent">
            {[...batches.values()].slice(0, 10).map((b) => (
              <li key={b.refs.map((r) => r.id).join()}><span className="rb-d num">{b.date.split('-').reverse().join('/')}</span>
                <span className="rb-t"><b>{b.person}</b><small className="muted">{b.account} · {b.refs.map((r, i) => <span key={r.id}>{i > 0 && ', '}<Link href={`/movimenti/${r.id}`}>{r.ref}</Link></span>)}</small></span>
                <b className="num rb-a">{money(b.total, b.currency, lang)}</b></li>
            ))}
          </ul>
        </Panel>
      )}

      {sel && (
        <div className="sheet-bg dl-sheet-bg">
          <Link className="dl-sheet-x" href="/rimborsi" scroll={false} aria-label={LL('Chiudi', 'Fermer')} />
          <aside className="sheet sheet-help dl-sheet aw-sheet" role="dialog" aria-modal="true" aria-label={sel.person}>
            <div className="sheet-h"><h2>{sel.person}</h2><div className="spacer" /><Link className="btn ghost" href="/rimborsi" scroll={false}>{LL('Chiudi', 'Fermer')}</Link></div>
            <div className="sheet-b">
              {errBox}
              <div className="aw-top"><span className="muted">{LL('Gli dobbiamo', 'Nous lui devons')}</span>
                <b className="num">{money(sel.rows.reduce((s, r) => s + Number(r.amount), 0), sel.currency, lang)}</b>
                <small className="muted">{LL('spese pagate di tasca propria', 'dépenses payées de sa poche')}</small></div>
              <ReimburseForm rows={sel.rows} currency={sel.currency} canPay={resp} lang={lang} person={sel.person}
                accounts={accFor(sel.currency)} def={(accounts ?? []).find((a) => a.currency === sel.currency && a.kind === 'cash')?.id} methods={(methods ?? []).map((m) => ({ id: m.id, name: L(m) }))} />
              {!resp && <p className="muted small">{LL('Il rimborso lo registra un responsabile o un amministratore.', 'Le remboursement est enregistré par un responsable ou un administrateur.')}</p>}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
