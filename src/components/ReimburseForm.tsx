'use client';
import { useState } from 'react';
import Link from 'next/link';
import { reimburse } from '@/app/(app)/rimborsi/actions';
import { money } from '@/lib/format';
import type { Lang } from '@/lib/i18n';

export type DueRow = {
  id: string; description: string; amount: string; currency: string; doc_date: string | null; op_date: string; paid_by: string | null;
  project: { name: string } | null; category: { code: string } | null; docs: { count: number }[]; no_doc_reason: string | null;
};
type L = { date: string; when: string; desc: string; account: string; method: string; pay: string; choose: string; all: string; no_doc: string; one: string; many: string };

const fmt = (n: number, cur: string, lang: string) => money(n, cur, lang as Lang);
const day = (d: string | null) => (d ? d.split('-').reverse().join('/') : '–');

// Spese da rimborsare di una persona in una valuta: si scelgono le righe, il conto, la data e si registra il rimborso.
export function ReimburseForm({ rows, currency, canPay, accounts, methods, labels: t, lang }: {
  rows: DueRow[]; currency: string; canPay: boolean; lang: string;
  accounts: { id: string; name: string }[]; methods: { id: string; name: string }[]; labels: L;
}) {
  const [sel, setSel] = useState<Set<string>>(() => new Set(rows.map((r) => r.id)));
  const [batch] = useState(() => crypto.randomUUID());   // stesso pacchetto se il modulo parte due volte
  const total = rows.filter((r) => sel.has(r.id)).reduce((s, r) => s + Number(r.amount), 0);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <form action={reimburse}>
      <input type="hidden" name="client_batch" value={batch} />
      <table className="t">
        <thead><tr>
          {canPay && <th style={{ width: 36 }}><input type="checkbox" aria-label={t.all} checked={sel.size === rows.length}
            onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th>}
          <th>{t.when}</th><th>{t.desc}</th><th className="r">{currency}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {canPay && <td><input type="checkbox" name="id" value={r.id} checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={r.description} /></td>}
              <td className="num">{day(r.doc_date ?? r.op_date)}</td>
              <td><Link className="rowlink" href={`/movimenti/${r.id}`}>{r.description || '–'}</Link>
                <div className="muted" style={{ fontSize: 13 }}>{[r.category?.code, r.project?.name].filter(Boolean).join(' · ')}
                  {!r.docs?.[0]?.count && !r.no_doc_reason && <> · <span className="ferr">{t.no_doc}</span></>}</div></td>
              <td className="r num nw">{fmt(Number(r.amount), currency, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {canPay && (
        <div className="panel-b reimb-pay">
          <label className="field"><span className="flabel">{t.account}</span>
            <select className="input" name="account_id" required defaultValue={accounts.length === 1 ? accounts[0].id : ''}>
              <option value="">{t.choose}</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select></label>
          <label className="field"><span className="flabel">{t.date}</span>
            <input className="input" type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <label className="field"><span className="flabel">{t.method}</span>
            <select className="input" name="method_id" defaultValue=""><option value="">{t.choose}</option>
              {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <button className="btn primary" type="submit" disabled={sel.size === 0}
            title={`${fmt(total, currency, lang)} · ${sel.size} ${sel.size === 1 ? t.one : t.many}`}>{t.pay}</button>
        </div>
      )}
    </form>
  );
}
