import Link from 'next/link';
import { ADMIN, RESP, STAFF, can, requireMe } from '@/lib/session';
import { money } from '@/lib/format';
import type { Key } from '@/lib/i18n';
import { Denied, ErrorNote, PageHead, Panel } from '@/components/Page';
import { ReconcileForm, type Leg } from '@/components/ReconcileForm';
import { cancelReconciliation } from './actions';

export const dynamic = 'force-dynamic';

type Acc = { id: string; code: string; name_it: string; name_fr: string | null; currency: string; kind: string; opening_balance: string };
type LegRow = { movement_id: string; side: 'from' | 'to'; ref: string | null; op_date: string; description: string;
  amount: string; reconciliation_id: string | null; statement_date: string | null };
type Rec = { id: string; statement_date: string; statement_balance: string; previous_balance: string; items_count: number;
  notes: string | null; reconciled_by: string; created_at: string; cancelled_at: string | null; cancel_reason: string | null };

const day = (d: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '–');

// Riconciliazione bancaria: elenco dei conti (banca, mobile money, altro) e spunta dell'estratto per un conto.
export default async function Reconciliation({ searchParams }: {
  searchParams: Promise<{ conto?: string; ok?: string; err?: string; cancelled?: string }>;
}) {
  const { conto, ok, err, cancelled } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, STAFF)) return <Denied text={t('only_staff')} />;
  const L = (o: { name_it: string; name_fr: string | null }) => (lang === 'fr' && o.name_fr ? o.name_fr : o.name_it);
  const { data: accData, error } = await supabase.from('accounts')
    .select('id, code, name_it, name_fr, currency, kind, opening_balance').eq('active', true)
    .not('kind', 'in', '(cash,advance)').order('sort').returns<Acc[]>();
  const accounts = accData ?? [];
  const legsOf = async (id: string) => ((await supabase.rpc('account_legs', { p_account: id })).data ?? []) as LegRow[];
  const status = (a: Acc, legs: LegRow[]) => {
    const done = legs.filter((l) => l.reconciliation_id);
    return {
      balance: Math.round((Number(a.opening_balance) + done.reduce((s, l) => s + Number(l.amount), 0)) * 100) / 100,
      last: done.reduce<string | null>((m, l) => (!m || (l.statement_date ?? '') > m ? l.statement_date : m), null),
      open: legs.filter((l) => !l.reconciliation_id),
    };
  };
  const errKey = err ? (`err_${err.split(':')[0]}` as Key) : null;
  const errNote = err && (() => {
    const known = t(errKey!) !== errKey ? t(errKey!) : null;
    const detail = err.includes(':') ? err.slice(err.indexOf(':') + 1).trim() : err;
    return <div className="note err">{known ?? detail}{known && detail && <><br /><span className="muted">{detail}</span></>}</div>;
  })();

  const acc = conto ? accounts.find((a) => a.id === conto) : undefined;
  if (!acc) {
    const rows = await Promise.all(accounts.map(async (a) => ({ a, s: status(a, await legsOf(a.id)) })));
    return (
      <div className="stack">
        <PageHead title={t('nav_rec')} />
        <div className="note">{t('rec_text')} {t('rec_cash_hint')}</div>
        <ErrorNote prefix={t('error_load')} error={error} />
        <Panel>
          {rows.length === 0 ? <p className="panel-b muted" style={{ margin: 0 }}>{t('rec_no_accounts')}</p> : (
            <table className="t">
              <thead><tr><th>{t('account')}</th><th>{t('rec_last')}</th><th className="r">{t('rec_balance')}</th>
                <th className="r">{t('rec_open')}</th><th /></tr></thead>
              <tbody>
                {rows.map(({ a, s }) => (
                  <tr key={a.id}>
                    <td><Link className="rowlink" href={`/riconciliazione?conto=${a.id}`}>{L(a)}</Link></td>
                    <td className="num">{s.last ? day(s.last) : <span className="muted">{t('rec_never')}</span>}</td>
                    <td className="r num nw">{money(s.balance, a.currency, lang)}</td>
                    <td className="r num">{s.open.length}</td>
                    <td className="r"><Link className="btn" href={`/riconciliazione?conto=${a.id}`}>{t('rec_go')}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    );
  }

  const [legs, { data: recs }, { data: users }] = await Promise.all([
    legsOf(acc.id),
    supabase.from('bank_reconciliations').select('id, statement_date, statement_balance, previous_balance, items_count, notes, reconciled_by, created_at, cancelled_at, cancel_reason')
      .eq('account_id', acc.id).order('statement_date', { ascending: false }).order('created_at', { ascending: false }).limit(50).returns<Rec[]>(),
    supabase.rpc('user_directory'),
  ]);
  const name = new Map(((users ?? []) as { id: string; full_name: string }[]).map((u) => [u.id, u.full_name]));
  const s = status(acc, legs);
  const open: Leg[] = s.open.map((l) => ({ movement_id: l.movement_id, side: l.side, ref: l.ref, op_date: l.op_date,
    description: l.description, amount: Number(l.amount) }));
  const lastActive = (recs ?? []).find((r) => !r.cancelled_at)?.id;
  return (
    <div className="stack">
      <PageHead title={`${t('nav_rec')} · ${L(acc)}`}>
        <Link className="btn ghost" href="/riconciliazione">{t('rec_back')}</Link>
      </PageHead>
      {ok && <div className="note ok" role="status">{t('rec_done')}</div>}
      {cancelled && <div className="note ok" role="status">{t('rec_cancel_done')}</div>}
      {errNote}
      {can(me, RESP) ? (
        <Panel>
          <ReconcileForm key={`${legs.length}-${s.last}`} accountId={acc.id} currency={acc.currency} legs={open} previous={s.balance}
            lastDate={s.last} lang={lang}
            labels={{ stmt_date: t('rec_stmt_date'), stmt_bal: t('rec_stmt_bal'), prev: t('rec_prev'), ticked: t('rec_ticked'),
              calc: t('rec_calc'), diff: t('rec_diff'), ok: t('rec_ok'), confirm: t('rec_confirm'), notes: t('rec_notes'),
              after: t('rec_after'), none: t('rec_none'), tick_all: t('rec_tick_all'), tick_none: t('rec_tick_none'), neg: t('rec_neg'),
              fill: t('rec_fill'), date: t('date'), desc: t('description'), amount: t('amount') }} />
        </Panel>
      ) : (
        <Panel pad><p style={{ margin: 0 }}>{t('rec_balance')}: <b className="num">{money(s.balance, acc.currency, lang)}</b>
          {' · '}{t('rec_open')}: {open.length}</p></Panel>
      )}
      {(recs ?? []).length > 0 && (
        <Panel title={t('rec_history')}>
          <table className="t">
            <thead><tr><th>{t('rec_stmt_date')}</th><th className="r">{t('rec_stmt_bal')}</th><th className="r">{t('rec_items')}</th>
              <th>{t('rec_by')}</th><th>{t('rec_notes')}</th>{can(me, ADMIN) && <th />}</tr></thead>
            <tbody>
              {(recs ?? []).map((r) => (
                <tr key={r.id} className={r.cancelled_at ? 'muted' : undefined}>
                  <td className="num">{day(r.statement_date)}{r.cancelled_at && <> · <span className="chip">{t('rec_cancelled')}</span></>}</td>
                  <td className="r num nw">{money(r.statement_balance, acc.currency, lang)}</td>
                  <td className="r num">{r.items_count}</td>
                  <td>{name.get(r.reconciled_by) ?? '–'}<div className="muted" style={{ fontSize: 13 }}>{day(r.created_at)}</div></td>
                  <td>{r.cancelled_at ? r.cancel_reason : r.notes ?? ''}</td>
                  {can(me, ADMIN) && (
                    <td>{r.id === lastActive && (
                      <details><summary className="btn ghost">{t('rec_cancel')}</summary>
                        <form action={cancelReconciliation} className="stack" style={{ gap: 8, marginTop: 8 }}>
                          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="account_id" value={acc.id} />
                          <label className="field"><span className="flabel">{t('rec_cancel_reason')}</span>
                            <input className="input" name="reason" required minLength={5} maxLength={500} /></label>
                          <button className="btn" type="submit">{t('rec_cancel')}</button>
                        </form>
                      </details>)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
