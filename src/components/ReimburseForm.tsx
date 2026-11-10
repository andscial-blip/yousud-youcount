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

const day = (d: string | null) => (d ? d.split('-').reverse().join('/') : '–');

// Rimborso di una persona in una valuta (scheda della persona): le spese con giustificativo sono già scelte,
// quelle senza si possono solo completare; un solo tasto «Rimborsa X» con la cassa già proposta e la data di oggi.
export function ReimburseForm({ rows, currency, canPay, accounts, methods, lang, person, def }: {
  rows: DueRow[]; currency: string; canPay: boolean; lang: Lang; person: string; def?: string;
  accounts: { id: string; name: string }[]; methods: { id: string; name: string }[];
}) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const ok = (r: DueRow) => Boolean(r.docs?.[0]?.count || r.no_doc_reason);
  const [sel, setSel] = useState<Set<string>>(() => new Set(rows.filter(ok).map((r) => r.id)));
  const [batch] = useState(() => crypto.randomUUID());   // stesso pacchetto se il modulo parte due volte
  const [more, setMore] = useState(false);
  const total = rows.filter((r) => sel.has(r.id)).reduce((s, r) => s + Number(r.amount), 0);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const missing = rows.filter((r) => !ok(r));
  return (
    <form action={reimburse} className="rb-form">
      <input type="hidden" name="client_batch" value={batch} /><input type="hidden" name="person" value={person} /><input type="hidden" name="currency" value={currency} />
      {missing.length > 0 && <p className="note warn" style={{ margin: '0 0 10px' }}>{missing.length === 1
        ? L('1 spesa senza giustificativo: allegalo (o scrivi perché manca) dalla spesa, poi si può rimborsare.', '1 dépense sans pièce : joignez-la (ou indiquez pourquoi elle manque) depuis la dépense, puis on peut la rembourser.')
        : L(`${missing.length} spese senza giustificativo: allegalo (o scrivi perché manca) dalla spesa, poi si possono rimborsare.`, `${missing.length} dépenses sans pièce : joignez-la (ou indiquez pourquoi elle manque) depuis la dépense, puis on peut les rembourser.`)}</p>}
      <ul className="rb-list">
        {rows.map((r) => (
          <li key={r.id} className={ok(r) ? '' : 'nodoc'}>
            {canPay && <input type="checkbox" name="id" value={r.id} checked={sel.has(r.id)} disabled={!ok(r)} onChange={() => toggle(r.id)} aria-label={r.description || L('spesa', 'dépense')} />}
            <span className="rb-d">{day(r.doc_date ?? r.op_date)}</span>
            <span className="rb-t"><Link href={`/movimenti/${r.id}`}>{r.description || '–'}</Link>
              <small className="muted">{[r.category?.code, r.project?.name].filter(Boolean).join(' · ')}
                {!ok(r) && <> · <Link className="neg" href={`/movimenti/${r.id}`}>{L('allega il giustificativo', 'joindre la pièce')}</Link></>}</small></span>
            <b className="num">{money(Number(r.amount), currency, lang)}</b>
          </li>
        ))}
      </ul>
      {canPay && (
        <div className="rb-pay">
          <div className="rb-f">
            <label className="field"><span className="flabel">{L('Esce da', 'Sort de')}</span>
              <select className="input" name="account_id" required defaultValue={def ?? (accounts.length === 1 ? accounts[0].id : '')}>
                <option value="">{L('Scegli la cassa o il conto…', 'Choisir la caisse ou le compte…')}</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select></label>
            <label className="field"><span className="flabel">{L('Data', 'Date')}</span>
              <input className="input" type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            {more ? <label className="field"><span className="flabel">{L('Metodo di pagamento', 'Moyen de paiement')}</span>
              <select className="input" name="method_id" defaultValue=""><option value="">–</option>
                {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
              : <button type="button" className="btn small ghost rb-more" onClick={() => setMore(true)}>{L('+ metodo di pagamento', '+ moyen de paiement')}</button>}
          </div>
          <button className="btn primary rb-go" type="submit" disabled={sel.size === 0}>
            {L('Rimborsa', 'Rembourser')} {money(total, currency, lang)}{sel.size > 0 && <small> · {sel.size} {sel.size === 1 ? L('spesa', 'dépense') : L('spese', 'dépenses')}</small>}</button>
        </div>
      )}
    </form>
  );
}
