'use client';
import { useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { parseAmount } from '@/lib/amount';
import { money } from '@/lib/format';
import type { Lang } from '@/lib/i18n';
import { reconcile } from '@/app/(app)/riconciliazione/actions';
import { detect, fileRows, fromRows, match, toLines, type StmtLine } from '@/lib/bank-csv';


export type Leg = { movement_id: string; side: 'from' | 'to'; ref: string | null; op_date: string; description: string; amount: number };
type L = {
  stmt_date: string; stmt_bal: string; prev: string; ticked: string; calc: string; diff: string; ok: string; confirm: string;
  notes: string; after: string; none: string; tick_all: string; tick_none: string; neg: string; fill: string;
  date: string; desc: string; amount: string;
  imp: string; imp_hint: string; imp_res: string; imp_unm: string; imp_none: string; imp_bad: string; imp_extra: string; imp_add: string; imp_add_t: string; imp_xls: string;
};

const day = (d: string) => d.split('-').reverse().join('/');
const key = (l: Leg) => `${l.movement_id}|${l.side}`;

// Spunta dell'estratto: data e saldo dell'estratto, movimenti spuntati, differenza in tempo reale.
// Si conferma solo a differenza zero; il database ricontrolla tutto.
// pulsante di conferma: mostra che il salvataggio è in corso (con rete lenta non si capiva se era partito)
function Confirm({ label, busy, disabled }: { label: string; busy: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn primary" type="submit" disabled={disabled || pending}>{pending ? busy : label}</button>;
}

export function ReconcileForm({ accountId, accountName, currency, legs, previous, lastDate, labels: t, lang }: {
  accountId: string; accountName: string; currency: string; legs: Leg[]; previous: number; lastDate: string | null; labels: L; lang: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [balTxt, setBalTxt] = useState('');
  // prima riconciliazione di un conto: si parte senza spunte, perché spuntare è il controllo; dalle successive si parte da tutto spuntato
  const [sel, setSel] = useState<Set<string>>(() => new Set(lastDate ? legs.filter((l) => l.op_date <= today).map(key) : []));
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
    let got: string[][] | 'xls';
    try { got = await fileRows(f); } catch { setImpErr(t.imp_bad); return; }
    if (got === 'xls') { setImpErr(t.imp_xls); return; }
    const { rows, header, hi } = fromRows(got);
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
  // riga senza movimento: nuovo movimento precompilato (in un'altra scheda, per non perdere l'import)
  const addHref = (u: StmtLine) => '/nuovo?' + new URLSearchParams({
    tipo: u.amount > 0 ? 'income' : 'expense', data: u.date, importo: String(Math.abs(u.amount)), conto: accountId,
    desc: u.text.slice(0, 300) }).toString();
  const FR = lang === 'fr';
  const inPeriod = legs.filter(usable), later = legs.filter((l) => !usable(l));
  const [shown, setShown] = useState(100);
  const toggle = (k: string) => setSel((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <form action={reconcile} className="stack rec-form">
      <h2 className="rec-title">{FR ? 'Rapprochement' : 'Riconciliazione'} · {accountName} · {currency}</h2>
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
        <div className="field"><span className="flabel">{t.imp}</span>
          <label className="btn rec-file"><input className="vh-file" type="file" accept=".csv,.txt,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(e) => onFile(e.target.files?.[0])} />{FR ? 'Charger le relevé' : 'Carica l’estratto'}</label>
          <span className="hint">{t.imp_hint}</span></div>
        {impErr && <div className="note err">{impErr}</div>}
        {imp && (
          <div className="note info" role="status">
            {t.imp_res.replace('{n}', String(imp.n)).replace('{m}', String(imp.matched))}
            {imp.extra > 0 && <> {t.imp_extra.replace('{n}', String(imp.extra))}</>}
            {imp.unmatched.length > 0 ? (
              <details style={{ marginTop: 6 }}><summary>{t.imp_unm.replace('{n}', String(imp.unmatched.length))}</summary>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{imp.unmatched.map((u, i) => (
                  <li key={i}><span className="num">{day(u.date)} · {u.amount >= 0 ? '+' : ''}{fmt(u.amount)}</span> · {u.text}
                    {u.amount !== 0 && <> · <a href={addHref(u)} target="_blank" rel="noopener" title={t.imp_add_t}>{t.imp_add}</a></>}</li>))}</ul></details>
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
            <button type="button" className="btn small" onClick={() => setSel(new Set(legs.filter(usable).map(key)))}>{t.tick_all}</button>
            <button type="button" className="btn small" onClick={() => setSel(new Set())}>{t.tick_none}</button>
            <span className="muted small">{FR ? `${inPeriod.length} mouvements jusqu’à la date du relevé` : `${inPeriod.length} movimenti fino alla data dell’estratto`}</span>
          </div>
          {/* riga compatta, tutta toccabile: casella, data, descrizione, importo */}
          <ul className="rec-list">
            {inPeriod.slice(0, shown).map((l) => { const k = key(l); return (
              <li key={k}><label className={sel.has(k) ? 'on' : undefined}>
                <input type="checkbox" checked={sel.has(k)} onChange={() => toggle(k)} />
                <span className="rl-d num">{day(l.op_date).slice(0, 5)}</span>
                <span className="rl-t">{l.description || '–'}<small>{l.ref}</small></span>
                <b className="rl-a num">{l.amount >= 0 ? '+' : ''}{fmt(l.amount)}</b>
              </label><Link className="rl-o" href={`/movimenti/${l.movement_id}`} aria-label={`${FR ? 'Ouvrir' : 'Apri'} ${l.ref ?? ''}`}>›</Link></li>); })}
          </ul>
          {inPeriod.length > shown && <div className="panel-b rec-more"><button type="button" className="btn" onClick={() => setShown((n) => n + 100)}>{FR ? `Afficher 100 autres (${inPeriod.length - shown} restants)` : `Mostra altri 100 (${inPeriod.length - shown} rimasti)`}</button></div>}
          {later.length > 0 && <p className="panel-b muted small" style={{ margin: 0 }}>{FR ? `${later.length} mouvements après la date du relevé : ils restent pour le prochain rapprochement.` : `${later.length} movimenti dopo la data dell’estratto: restano per la prossima riconciliazione.`}</p>}
        </>
      )}
      <div className="panel-b rec-foot">
        <label className="field"><span className="flabel">{t.notes}</span>
          <input className="input" name="notes" maxLength={1000} /></label>
        {!canSave && <span className="hint">{balance === null ? t.fill : ''}</span>}
      </div>
      {/* barra fissa: la differenza resta in vista mentre si spunta, con la conferma accanto */}
      <div className="rec-bar" aria-live="polite">
        <div className={diff === 0 ? 'rec-ok' : diff === null ? '' : 'rec-bad'}><span>{t.diff}</span><b className="num">{diff === null ? '–' : diff === 0 ? t.ok : fmt(diff)}</b></div>
        <span className="muted small">{ticked.length} {FR ? 'cochés' : 'spuntati'}</span>
        <Confirm label={t.confirm} busy={FR ? 'Enregistrement…' : 'Salvataggio…'} disabled={!canSave} />
      </div>
    </form>
  );
}
