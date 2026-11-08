'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { parseAmount } from '@/lib/amount';
import { money } from '@/lib/format';
import type { Lang } from '@/lib/i18n';
import { reconcile } from '@/app/(app)/riconciliazione/actions';
import { detect, match, readCsv, toLines, type StmtLine } from '@/lib/bank-csv';

export type Leg = { movement_id: string; side: 'from' | 'to'; ref: string | null; op_date: string; description: string; amount: number };
type L = {
  stmt_date: string; stmt_bal: string; prev: string; ticked: string; calc: string; diff: string; ok: string; confirm: string;
  notes: string; after: string; none: string; tick_all: string; tick_none: string; neg: string; fill: string;
  date: string; desc: string; amount: string;
  imp: string; imp_hint: string; imp_res: string; imp_unm: string; imp_none: string; imp_bad: string; imp_extra: string;
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
  // estratto conto CSV: abbina le righe ai movimenti aperti e spunta quelli trovati (nulla viene inviato o salvato)
  const [imp, setImp] = useState<{ n: number; matched: number; unmatched: StmtLine[]; extra: number } | null>(null);
  const [impErr, setImpErr] = useState('');
  const onFile = async (f: File | undefined) => {
    setImpErr(''); setImp(null);
    if (!f) return;
    const { rows, header, hi } = readCsv(await f.text());
    const lines = hi >= 0 ? toLines(rows, hi, detect(header)) : [];
    if (!lines.length) { setImpErr(t.imp_bad); return; }
    const res = match(lines, legs.map((l) => ({ ...l, key: key(l) })), currency === 'MGA' ? 1 : 0.005);
    const keys = new Set(res.filter((r) => r.leg).map((r) => r.leg!.key));
    setSel(keys);
    const last = [...lines].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!;
    if (last.date <= today && (!lastDate || last.date >= lastDate)) setDate(last.date);
    if (last.balance !== null) setBalTxt(String(last.balance).replace('.', ','));
    const lo = lines.reduce((m, l) => (l.date < m ? l.date : m), last.date);
    setImp({ n: lines.length, matched: keys.size, unmatched: res.filter((r) => !r.leg).map((r) => r.line),
      extra: legs.filter((l) => !keys.has(key(l)) && l.op_date >= lo && l.op_date <= last.date).length });
  };
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
      <div className="panel-b rec-import">
        <label className="field"><span className="flabel">{t.imp}</span>
          <input className="input" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => onFile(e.target.files?.[0])} />
          <span className="hint">{t.imp_hint}</span></label>
        {impErr && <div className="note err">{impErr}</div>}
        {imp && (
          <div className="note info" role="status">
            {t.imp_res.replace('{n}', String(imp.n)).replace('{m}', String(imp.matched))}
            {imp.extra > 0 && <> {t.imp_extra.replace('{n}', String(imp.extra))}</>}
            {imp.unmatched.length > 0 ? (
              <details style={{ marginTop: 6 }}><summary>{t.imp_unm.replace('{n}', String(imp.unmatched.length))}</summary>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{imp.unmatched.map((u, i) => (
                  <li key={i}><span className="num">{day(u.date)} · {u.amount >= 0 ? '+' : ''}{fmt(u.amount)}</span> · {u.text}</li>))}</ul></details>
            ) : <> {t.imp_none}</>}
          </div>
        )}
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
          <div className="panel-b rec-tools">
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
