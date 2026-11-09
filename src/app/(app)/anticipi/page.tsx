import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { RESP, STAFF, can, requireMe } from '@/lib/session';
import { date, money } from '@/lib/format';
import type { Key } from '@/lib/i18n';
import { Denied, Empty, ErrorNote, PageHead, Panel, H2 } from '@/components/Page';
import { createAdvanceAccount, moveAdvance } from './actions';

export const dynamic = 'force-dynamic';

type S = { account_id: string; code: string; name_it: string; name_fr: string; holder: string; currency: string; active: boolean;
  given: string; spent: string; returned: string; balance: string; open_since: string | null; last_move: string | null;
  spent_count: number; spent_no_doc: number; aut_to_sign: number; unverified: number };

const LATE_DAYS = 30;   // come il Gestionale: avviso dopo 30 giorni con saldo da giustificare

// Anticipi al personale: per persona consegnato, speso, restituito e saldo da giustificare.
export default async function Advances({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, STAFF)) return <Denied text={t('only_staff')} />;
  const resp = can(me, RESP);
  const [{ data, error }, { data: cash }] = await Promise.all([
    supabase.rpc('advance_summary'),
    supabase.from('accounts').select('id, name_it, name_fr, currency').eq('active', true).neq('kind', 'advance').order('sort'),
  ]);
  const rows = (data ?? []) as S[];
  const today = new Date().toISOString().slice(0, 10);
  const days = (d: string | null) => (d ? Math.floor((Date.parse(today) - Date.parse(d)) / 864e5) : 0);
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + Number(r.balance));
  const L = (o: { name_it: string; name_fr: string | null }) => (lang === 'fr' && o.name_fr ? o.name_fr : o.name_it);
  const errText = err ? (() => { const k = `err_${err.split(':')[0]}` as Key; const v = t(k); return v && v !== k ? v : err; })() : null;
  const active = rows.filter((r) => r.active);

  return (
    <div className="stack">
      <PageHead title={t('nav_advances')} />
      <div className="note">{t('adv_intro')}</div>
      {ok && <div className="note ok" role="status">{t('adv_saved')}</div>}
      {errText && <div className="note err">{err === 'no_rate' ? t('adv_no_rate') : errText}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />

      {rows.length > 0 && (
        <section className="panel">
          <div className="figs">
            {[...totals.entries()].map(([cur, v]) => (
              <div key={cur}><span>{t('adv_total')} · {cur}</span><b className="num">{money(v, cur, lang)}</b></div>
            ))}
            <div className={rows.some((r) => Number(r.balance) > 0 && days(r.open_since) > LATE_DAYS) ? 'bad' : ''}>
              <span>{t('adv_late')}</span><b className="num">{rows.filter((r) => Number(r.balance) > 0 && days(r.open_since) > LATE_DAYS).length}</b></div>
            <div><span>{t('adv_no_doc')}</span><b className="num">{rows.reduce((s, r) => s + r.spent_no_doc, 0)}</b></div>
          </div>
        </section>
      )}

      <Panel>
        {rows.length === 0 ? <Empty text={t('adv_none')} /> : (
          <div className="tscroll">
            <table className="t">
              <thead><tr>
                <th>{t('adv_person')}</th><th className="r">{t('adv_given')}</th><th className="r">{t('adv_spent')}</th>
                <th className="r">{t('adv_returned')}</th><th className="r">{t('adv_balance')}</th><th>{t('adv_open_since')}</th><th />
              </tr></thead>
              <tbody>
                {rows.map((r) => {
                  const bal = Number(r.balance), d = days(r.open_since), late = bal > 0 && d > LATE_DAYS;
                  return (
                    <tr key={r.account_id} className={r.active ? '' : 'muted'}>
                      <td><Link href={`/movimenti?conto=${r.account_id}`}><b>{r.holder}</b></Link> <span className="muted">· {r.currency}</span></td>
                      <td className="r num">{money(r.given, r.currency, lang)}</td>
                      <td className="r num">{money(r.spent, r.currency, lang)}</td>
                      <td className="r num">{money(r.returned, r.currency, lang)}</td>
                      <td className={`r num ${bal < 0 ? 'neg' : ''}`}><b>{money(bal, r.currency, lang)}</b></td>
                      <td className="nw">{bal > 0 && r.open_since
                        ? <>{date(r.open_since)} <span className={`chip ${late ? 'warn' : ''}`}>{t('adv_days').replace('{n}', String(d))}</span></> : '–'}</td>
                      <td>
                        <span className="chips">
                          {r.spent_no_doc > 0 && <Link className="chip warn" href={`/movimenti?conto=${r.account_id}`}>{t('adv_no_doc')}: {r.spent_no_doc}</Link>}
                          {r.aut_to_sign > 0 && <span className="chip warn">{t('adv_aut_to_sign')}: {r.aut_to_sign}</span>}
                          {r.unverified > 0 && <span className="chip">{r.unverified} {t('adv_unverified')}</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {resp && active.length > 0 && (
        <Panel title={`${t('adv_give')} / ${t('adv_return')}`} pad>
          <p className="muted" style={{ marginTop: 0 }}>{t('adv_move_text')}</p>
          <form action={moveAdvance} className="fgrid">
            <input type="hidden" name="client_uuid" value={randomUUID()} />
            <div className="field">
              <label htmlFor="adv">{t('adv_person')}</label>
              <select className="input" id="adv" name="advance" required>
                {active.map((r) => <option key={r.account_id} value={r.account_id}>{r.holder} · {r.currency}</option>)}
              </select>
            </div>
            <div className="field">
              <span className="flabel" id="advop">{t('adv_op')}</span>
              <div className="seg" role="radiogroup" aria-labelledby="advop">
                <label className="seg-opt"><input type="radio" name="op" value="give" defaultChecked /> {t('adv_give')}</label>
                <label className="seg-opt"><input type="radio" name="op" value="return" /> {t('adv_return')}</label>
              </div>
            </div>
            <div className="field">
              <label htmlFor="advcash">{t('adv_cash_acc')}</label>
              <select className="input" id="advcash" name="cash" required>
                {(cash ?? []).map((a) => <option key={a.id} value={a.id}>{L(a)} · {a.currency}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="advamt">{t('amount')}</label>
              <input className="input num" id="advamt" name="amount" inputMode="decimal" required placeholder="0" />
            </div>
            <div className="field">
              <label htmlFor="advdate">{t('f_op_date')}</label>
              <input className="input" id="advdate" name="date" type="date" defaultValue={today} required />
            </div>
            <div className="field">
              <label htmlFor="advnotes">{t('f_notes')}</label>
              <input className="input" id="advnotes" name="notes" maxLength={300} />
            </div>
            <div className="span2"><button className="btn primary" type="submit">{t('adv_save')}</button></div>
          </form>
        </Panel>
      )}

      {resp && (
        <details className="panel">
          <summary className="panel-h" style={{ cursor: 'pointer' }}><H2 text={t('adv_new_person')} /></summary>
          <div className="panel-b">
            <p className="muted" style={{ marginTop: 0 }}>{t('adv_new_text')}</p>
            <form action={createAdvanceAccount} className="fgrid">
              <div className="field">
                <label htmlFor="holder">{t('adv_holder')}</label>
                <input className="input" id="holder" name="holder" required maxLength={120} />
              </div>
              <div className="field">
                <label htmlFor="advcur">{t('currency')}</label>
                <select className="input" id="advcur" name="currency" defaultValue="MGA"><option>MGA</option><option>EUR</option></select>
              </div>
              <div className="field">
                <label htmlFor="advloc">{t('place')}</label>
                <select className="input" id="advloc" name="location" defaultValue="MG">
                  <option value="MG">{t('madagascar')}</option><option value="IT">{t('italy')}</option>
                </select>
              </div>
              <div className="span2"><button className="btn" type="submit">{t('adv_create')}</button></div>
            </form>
          </div>
        </details>
      )}
    </div>
  );
}
