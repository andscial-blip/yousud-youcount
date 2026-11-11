'use client';
import { useMemo, useState } from 'react';
import { money } from '@/lib/format';
import type { Lang } from '@/lib/i18n';
import { recordCashCount } from '@/app/(app)/conti/actions';

// Verifica di cassa per tagli (come il Gestionale): si contano banconote e monete, il totale si calcola da sé
// e si confronta con il saldo dell'app. Il database registra il saldo alla data e la differenza.
const DEN: Record<string, number[]> = { MGA: [20000, 10000, 5000, 2000, 1000, 500, 200, 100], EUR: [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02] };
// da quale taglio in giù sono monete
// In Madagascar si contano solo banconote (da 100 a 20.000 ariary): niente colonna delle monete, i tagli si dividono in due colonne
const COIN_BELOW: Record<string, number> = { MGA: 0, EUR: 5 };

export function CashCounter({ accounts, lang, L }: { accounts: { id: string; label: string; currency: string; balance: number }[]; lang: Lang;
  L: { account: string; date: string; den: string; qty: string; total: string; counted: string; expected: string; diff: string; notes: string; save: string; hint: string; pieces: string; notes_bank: string; coins: string; notes_small: string } }) {
  const [acc, setAcc] = useState(accounts[0]?.id ?? '');
  const [q, setQ] = useState<Record<string, string>>({});
  const a = accounts.find((x) => x.id === acc) ?? accounts[0];
  const den = DEN[a?.currency ?? 'EUR'] ?? DEN.EUR;
  const byDen = useMemo(() => den.reduce((s, v) => s + v * (Number(q[String(v)]) || 0), 0), [den, q]);
  const total = Math.round(byDen * 100) / 100;
  const counted = total;
  const diff = total > 0 ? Math.round((total - (a?.balance ?? 0)) * 100) / 100 : null;
  const fmt = (v: number) => money(v, a?.currency ?? 'EUR', lang);
  const nf = (v: number) => v.toLocaleString(lang === 'fr' ? 'fr-FR' : 'it-IT', { minimumFractionDigits: v < 1 ? 2 : 0, useGrouping: 'always' } as Intl.NumberFormatOptions);
  return (
    <form action={recordCashCount} className="stack" style={{ gap: 14 }}>
      <input type="hidden" name="denominations" value={total > 0 ? JSON.stringify(Object.fromEntries(Object.entries(q).filter(([, v]) => Number(v) > 0))) : ''} />
      <input type="hidden" name="counted" value={String(counted).replace('.', ',')} />
      <div className="fgrid">
        <div className="field"><label htmlFor="cc-account">{L.account}</label>
          <select className="input" id="cc-account" name="account" value={acc} onChange={(e) => { setAcc(e.target.value); setQ({}); }}>
            {accounts.map((c) => <option key={c.id} value={c.id}>{c.label} · {c.currency}</option>)}</select></div>
        <div className="field"><label htmlFor="cc-date">{L.date}</label>
          <input className="input" type="date" id="cc-date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
      </div>
      <div className="cc-groups">
      {(() => {
        const below = COIN_BELOW[a?.currency ?? 'EUR'] ?? 5, notes = den.filter((v) => v >= below), coins = den.filter((v) => v < below);
        const half = Math.ceil(notes.length / 2);
        return (coins.length ? [['notes', L.notes_bank, notes], ['coins', L.coins, coins]] : [['notes', L.notes_bank, notes.slice(0, half)], ['small', L.notes_small, notes.slice(half)]]) as [string, string, number[]][];
      })().map(([g, title, list]) => {
        if (!list.length) return null;
        return (
          <div key={g} className="cc-tab" role="group" aria-label={`${L.den}: ${title}`}>
            <div className="cc-row cc-head"><span>{title}</span><span>{L.pieces}</span><span>{L.total}</span></div>
            {list.map((v) => {
              const n = Number(q[String(v)]) || 0;
              return (
                <label key={v} className={`cc-row${n ? ' on' : ''}`}>
                  <span className="num cc-v">{nf(v)}</span>
                  <input className="input num" inputMode="numeric" value={q[String(v)] ?? ''} placeholder="0" aria-label={`${L.qty} ${nf(v)}`}
                         onChange={(e) => setQ((o) => ({ ...o, [String(v)]: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
                  <span className="num cc-t">{n ? fmt(v * n) : '–'}</span>
                </label>
              );
            })}
          </div>
        );
      })}
      </div>
      {(() => {
        // risultato: contato e saldo dell'app su barre della stessa scala, differenza in evidenza
        const exp = a?.balance ?? 0, max = Math.max(total, Math.abs(exp), 1);
        const st = diff === null ? 'none' : diff === 0 ? 'ok' : diff < 0 ? 'low' : 'high';
        const msg = st === 'none' ? L.diff : st === 'ok' ? (lang === 'fr' ? 'La caisse est juste' : 'La cassa quadra')
          : st === 'low' ? (lang === 'fr' ? 'Il manque' : 'Mancano') : (lang === 'fr' ? 'En trop' : 'In più');
        return (
          <div className={`cc-res st-${st}`} aria-live="polite">
            <div className="ccr-bars">
              <div className="ccr-row"><span>{L.counted}</span><div className="ccr-b"><i className="c" style={{ width: `${(total / max) * 100}%` }} /></div><b className="num">{total > 0 ? fmt(total) : '–'}</b></div>
              <div className="ccr-row"><span>{L.expected}</span><div className="ccr-b"><i className="e" style={{ width: `${(Math.max(exp, 0) / max) * 100}%` }} /></div><b className="num">{fmt(exp)}</b></div>
            </div>
            <div className="ccr-diff"><span>{msg}</span><b className="num">{diff === null ? '–' : st === 'ok' ? '✓' : fmt(Math.abs(diff))}</b></div>
          </div>
        );
      })()}
      <p className="hint" style={{ margin: 0 }}>{L.hint}</p>
      <div className="cc-foot">
        <div className="field"><label htmlFor="cc-notes">{L.notes}</label><input className="input" id="cc-notes" name="notes" maxLength={1000} /></div>
        <button className="btn primary" type="submit" disabled={!(total > 0 || Object.values(q).some((v) => v !== ''))}>{L.save}</button>
      </div>
    </form>
  );
}
