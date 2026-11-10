import Link from 'next/link';
import { RESP, requireMe } from '@/lib/session';
import { money } from '@/lib/format';
import type { Key } from '@/lib/i18n';
import { ErrorNote, PageHead, Panel } from '@/components/Page';
import { ReimburseForm, type DueRow } from '@/components/ReimburseForm';

export const dynamic = 'force-dynamic';

type Row = DueRow & { created_by: string };
type Paid = { id: string; ref: string; op_date: string; amount: string; currency: string; paid_by: string | null; reimb_batch: string;
  account: { name_it: string; name_fr: string | null } | null };

// Rimborsi (richiesta del 10/11, stesso schema degli anticipi): una riga per persona con quanto le dobbiamo;
// aprendola si vedono le spese e un solo tasto «Rimborsa X» (cassa proposta, data di oggi). Sotto, gli ultimi rimborsi.
export default async function Reimbursements({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; p?: string; c?: string }> }) {
  const sp = await searchParams;
  const { ok, err } = sp;
  const { supabase, me, t, lang } = await requireMe();
  const resp = Boolean(me && RESP.includes(me.role));
  const LL = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const [{ data, error }, { data: accounts }, { data: methods }, { data: paid }] = await Promise.all([
    supabase.from('movements').select(`id, description, amount, currency, fx_rate, doc_date, op_date, paid_by, created_by,
        project:projects(name), category:categories(code), docs:movement_documents(count), no_doc_reason`)
      .eq('reimb_status', 'due').order('paid_by').order('doc_date').limit(2000).returns<Row[]>(),
    supabase.from('accounts').select('id, name_it, name_fr, currency, kind').eq('active', true).neq('kind', 'advance').order('sort'),
    supabase.from('payment_methods').select('id, name_it, name_fr').eq('active', true).order('sort'),
    supabase.from('movements').select('id, ref, op_date, amount, currency, paid_by, reimb_batch, account:accounts!movements_account_id_fkey(name_it, name_fr)')
      .eq('reimb_status', 'paid').order('reimbursed_at', { ascending: false }).limit(60).returns<Paid[]>(),
  ]);
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
      <PageHead title={t('nav_reimb')}>
        <Link className="btn primary" href="/nuovo?tipo=expense&tasca=1">+ {LL('Spesa pagata di tasca mia', 'Dépense payée de ma poche')}</Link>
      </PageHead>
      {ok && <div className="note ok" role="status">{t('reimb_done')} {ok}</div>}
      {!sel && errBox}
      <ErrorNote prefix={t('error_load')} error={error} />
      <div className="kpi4 rb-k">
        <div className="k4 k-out"><span className="k4-t">{LL('Da rimborsare', 'À rembourser')}</span>
          <b className="num">{[...totals.entries()].map(([c, v]) => money(v, c, lang)).join(' · ') || '–'}</b>
          <small>{groups.size === 1 ? LL('1 persona', '1 personne') : LL(`${groups.size} persone`, `${groups.size} personnes`)}</small></div>
        <div className={`k4 ${(data ?? []).some((r) => !hasDoc(r)) ? 'k-warn' : 'k-net'}`}><span className="k4-t">{LL('Senza giustificativo', 'Sans pièce')}</span>
          <b className="num">{(data ?? []).filter((r) => !hasDoc(r)).length}</b><small>{LL('da completare prima del rimborso', 'à compléter avant le remboursement')}</small></div>
      </div>
      <Panel title={LL('A chi dobbiamo dei soldi', 'À qui nous devons de l’argent')}>
        {groups.size === 0 ? <p className="panel-b muted" style={{ margin: 0 }}>{t('reimb_none')}</p> : (
          <ul className="aw-list">
            {[...groups.values()].sort((a, b) => b.rows.reduce((s, r) => s + Number(r.amount), 0) - a.rows.reduce((s, r) => s + Number(r.amount), 0)).map((g) => {
              const nd = g.rows.filter((r) => !hasDoc(r)).length;
              return (
                <li key={`${g.person}|${g.currency}`}><Link href={open(g)} scroll={false} className={sel === g ? 'sel' : ''}>
                  <span className="aw-n"><b>{g.person}</b><small className="muted">{g.rows.length === 1 ? LL('1 spesa', '1 dépense') : LL(`${g.rows.length} spese`, `${g.rows.length} dépenses`)}
                    {nd ? <span className="neg"> · {nd} {LL('senza giustificativo', 'sans pièce')}</span> : ''}</small></span>
                  <span className="aw-b num">{money(g.rows.reduce((s, r) => s + Number(r.amount), 0), g.currency, lang)}<small>{LL('da rimborsare', 'à rembourser')}</small></span>
                </Link></li>);
            })}
          </ul>
        )}
      </Panel>
      {batches.size > 0 && (
        <Panel title={t('reimb_recent')}>
          <ul className="aw-st rb-recent">
            {[...batches.values()].map((b) => (
              <li key={b.refs.map((r) => r.id).join()}><span className="aw-d">{b.date.split('-').reverse().join('/')}</span>
                <span><b>{b.person}</b> · {b.account}<small className="muted bl-note">{b.refs.map((r, i) => <span key={r.id}>{i > 0 && ', '}<Link href={`/movimenti/${r.id}`}>{r.ref}</Link></span>)}</small></span>
                <b className="num">{money(b.total, b.currency, lang)}</b></li>
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
