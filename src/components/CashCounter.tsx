'use client';
import { useMemo, useState } from 'react';
import { money } from '@/lib/format';
import type { Lang } from '@/lib/i18n';
import { recordCashCount } from '@/app/(app)/conti/actions';

// Verifica di cassa per tagli (come il Gestionale): si contano banconote e monete, il totale si calcola da sé
// e si confronta con il saldo dell'app. Il database registra il saldo alla data e la differenza.
const DEN: Record<string, number[]> = { MGA: [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50], EUR: [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01] };

export function CashCounter({ accounts, lang, L }: { accounts: { id: string; label: string; currency: string; balance: number }[]; lang: Lang;
  L: { account: string; date: string; den: string; qty: string; total: string; counted: string; expected: string; diff: string; notes: string; save: string; manual: string; hint: string } }) {
  const [acc, setAcc] = useState(accounts[0]?.id ?? '');
  const [q, setQ] = useState<Record<string, string>>({});
  const [manual, setManual] = useState('');
  const a = accounts.find((x) => x.id === acc) ?? accounts[0];
  const den = DEN[a?.currency ?? 'EUR'] ?? DEN.EUR;
  const byDen = useMemo(() => den.reduce((s, v) => s + v * (Number(q[String(v)]) || 0), 0), [den, q]);
  const total = Math.round(byDen * 100) / 100;
  const counted = total > 0 ? total : manual;
  const diff = total > 0 ? Math.round((total - (a?.balance ?? 0)) * 100) / 100 : null;
  const fmt = (v: number) => money(v, a?.currency ?? 'EUR', lang);
  const nf = (v: number) => v.toLocaleString(lang === 'fr' ? 'fr-FR' : 'it-IT', { minimumFractionDigits: v < 1 ? 2 : 0 });
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
      <div className="cc-grid" role="group" aria-label={L.den}>
        {den.map((v) => (
          <label key={v} className="cc-den"><span className="num">{nf(v)}</span>
            <input className="input num" inputMode="numeric" value={q[String(v)] ?? ''} aria-label={`${L.qty} ${nf(v)}`}
                   onChange={(e) => setQ((o) => ({ ...o, [String(v)]: e.target.value.replace(/\D/g, '') }))} />
            <small className="num muted">{Number(q[String(v)]) ? fmt(v * Number(q[String(v)])) : ''}</small></label>
        ))}
      </div>
      {total === 0 && <div className="field"><label htmlFor="cc-manual">{L.manual}</label>
        <input className="input num" id="cc-manual" inputMode="decimal" value={manual} onChange={(e) => setManual(e.target.value)} /></div>}
      <div className="rec-sum" aria-live="polite">
        <div><span>{L.counted}</span><b className="num">{total > 0 ? fmt(total) : manual || '–'}</b></div>
        <div><span>{L.expected}</span><b className="num">{fmt(a?.balance ?? 0)}</b></div>
        <div className={diff === null ? '' : diff === 0 ? 'rec-ok' : 'rec-bad'}><span>{L.diff}</span><b className="num">{diff === null ? '–' : fmt(diff)}</b></div>
      </div>
      <p className="hint" style={{ margin: 0 }}>{L.hint}</p>
      <div className="fgrid" style={{ alignItems: 'end' }}>
        <div className="field"><label htmlFor="cc-notes">{L.notes}</label><input className="input" id="cc-notes" name="notes" maxLength={1000} /></div>
        <div><button className="btn primary" type="submit" disabled={!(total > 0 || manual.trim())}>{L.save}</button></div>
      </div>
    </form>
  );
}
