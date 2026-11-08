'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { parseAmount } from '@/lib/amount';
import { money } from '@/lib/format';
import type { Lang } from '@/lib/i18n';
import { reconcile } from '@/app/(app)/riconciliazione/actions';

export type Leg = { movement_id: string; side: 'from' | 'to'; ref: string | null; op_date: string; description: string; amount: number };
type L = {
  stmt_date: string; stmt_bal: string; prev: string; ticked: string; calc: string; diff: string; ok: string; confirm: string;
  notes: string; after: string; none: string; tick_all: string; tick_none: string; neg: string; fill: string;
  date: string; desc: string; amount: string;
};

const day = (d: string) => d.split('-').reverse().join('/');
const key = (l: Leg) => `${l.movement_id}|${l.side}`;

// Spunta dell'estratto: data e saldo dell'estratto, movimenti spuntati, differenza in tempo reale.
// Si conferma solo a differenza zero; il database ricontrolla tutto.
export function ReconcileForm({ accountId, currency, legs, previous, lastDate, labels: t, lang }: {
  accountId: string; currency: string; legs: Leg[]; previous: number; lastDate: string | null; labels: L; lang: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [balTxt, setBalTxt] = useState('');
  const [sel, setSel] = useState<Set<string>>(() => new Set(legs.filter((l) => l.op_date <= today).map(key)));
  const [client] = useState(() => crypto.randomUUID());
  const fmt = (n: number) => money(n, currency, lang as Lang);

  // saldo dell'estratto: anche zero o negativo (scoperto)
  const balance = useMemo(() => {
    const s = balTxt.trim();
    if (!s) return null;
    const neg = /^[-−]/.test(s);
    const body = s.replace(/^[-−]\s*/, '');
    if (/^0+([.,]0+)?$/.test(body.replace(/[\s€]/g, ''))) return 0;
    const v = parseAmount(body);
    return v === null ? null : neg ? -v : v;
  }, [balTxt]);

  const usable = (l: Leg) => l.op_date <= date;
  const ticked = legs.filter((l) => sel.has(key(l)) && usable(l));
  const sum = Math.round(ticked.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const calc = Math.round((previous + sum) * 100) / 100;
  const diff = balance === null ? null : Math.round((balance - calc) * 100) / 100;
  const dateOk = Boolean(date) && date <= today && (!lastDate || date >= lastDate);
  const canSave = dateOk && diff === 0;
  const toggle = (k: string) => setSel((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <form action={reconcile} className="stack">
      <input type="hidden" name="account_id" value={accountId} />
      <input type="hidden" name="client_uuid" value={client} />
      <input type="hidden" name="statement_balance" value={balance ?? ''} />
      <input type="hidden" name="items" value={JSON.stringify(ticked.map((l) => ({ movement_id: l.movement_id, side: l.side })))} />
      <div className="panel-b rec-head">
        <label className="field"><span className="flabel">{t.stmt_date}</span>
          <input className="input" type="date" name="statement_date" required value={date} min={lastDate ?? undefined} max={today}
            onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span className="flabel">{t.stmt_bal} ({currency})</span>
          <input className="input num" inputMode="decimal" required value={balTxt} onChange={(e) => setBalTxt(e.target.value)}
            aria-invalid={balTxt.trim() !== '' && balance === null} />
          <span className="hint">{t.neg}</span></label>
      </div>
      <div className="rec-sum" aria-live="polite">
        <div><span>{t.prev}</span><b className="num">{fmt(previous)}</b></div>
        <div><span>{t.ticked} ({ticked.length})</span><b className="num">{sum >= 0 ? '+' : ''}{fmt(sum)}</b></div>
        <div><span>{t.calc}</span><b className="num">{fmt(calc)}</b></div>
        <div className={diff === 0 ? 'rec-ok' : diff === null ? '' : 'rec-bad'}><span>{t.diff}</span>
          <b className="num">{diff === null ? '–' : diff === 0 ? t.ok : fmt(diff)}</b></div>
      </div>
      {legs.length === 0 ? <p className="panel-b muted" style={{ margin: 0 }}>{t.none}</p> : (
        <>
          <div className="panel-b" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 0 }}>
            <button type="button" className="btn ghost" onClick={() => setSel(new Set(legs.filter(usable).map(key)))}>{t.tick_all}</button>
            <button type="button" className="btn ghost" onClick={() => setSel(new Set())}>{t.tick_none}</button>
          </div>
          <table className="t">
            <thead><tr><th style={{ width: 36 }} /><th>{t.date}</th><th>{t.desc}</th><th className="r">{t.amount}</th></tr></thead>
            <tbody>
              {legs.map((l) => {
                const k = key(l); const off = !usable(l);
                return (
                  <tr key={k} className={off ? 'muted' : undefined}>
                    <td><input type="checkbox" checked={sel.has(k) && !off} disabled={off} onChange={() => toggle(k)}
                      aria-label={`${l.ref ?? ''} ${l.description}`} /></td>
                    <td className="num">{day(l.op_date)}</td>
                    <td><Link className="rowlink" href={`/movimenti/${l.movement_id}`}>{l.description || '–'}</Link>
                      <div className="muted" style={{ fontSize: 13 }}>{l.ref}{off && <> · {t.after}</>}</div></td>
                    <td className="r num nw">{l.amount >= 0 ? '+' : ''}{fmt(l.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      <div className="panel-b rec-foot">
        <label className="field"><span className="flabel">{t.notes}</span>
          <input className="input" name="notes" maxLength={1000} /></label>
        <button className="btn primary" type="submit" disabled={!canSave}>{t.confirm}</button>
        {!canSave && <span className="hint">{balance === null ? t.fill : ''}</span>}
      </div>
    </form>
  );
}
