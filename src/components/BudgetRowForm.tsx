'use client';
// Riga del preventivo, nuova o da modificare: tutto ciò che ha un elenco chiuso si sceglie da un menu (codice, progetto,
// donatore o fornitore, valuta); il totale si calcola mentre si scrive (quantità × costo unitario, in ariary diviso per il tasso).
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { parseAmount } from '@/lib/amount';
import { money } from '@/lib/format';

type Opt = { id: string; label: string };
export type RowFormProps = {
  action: (form: FormData) => void | Promise<void>;
  lang: 'it' | 'fr';
  year: number; budgetId: string; ret: string; cancelHref: string;
  item?: { id: string; line_no: number; category_id: string; project_id: string | null; counterparty_id: string | null; description: string | null;
    qty: string; unit: string | null; unit_cost: string; currency: string; fx_rate: string | null; notes: string | null };
  cats: { out: Opt[]; in: Opt[] };
  projects: Opt[];
  parties: { donor: Opt[]; supplier: Opt[]; other: Opt[] };
  units: string[];
  rate: number | null;
  needReason: boolean;
  defCat?: string; defPrj?: string;
};

// numeri nei campi come nel resto dell'app: punto delle migliaia, virgola dei decimali (parseAmount li rilegge)
const nf = (v: string | number | null | undefined) => {
  if (v == null || v === '') return '';
  const [int, dec] = String(Math.round(Number(v) * 100) / 100).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? `,${dec}` : '');
};

export function BudgetRowForm({ action, lang, year, budgetId, ret, cancelHref, item, cats, projects, parties, units, rate, needReason, defCat, defPrj }: RowFormProps) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const [cat, setCat] = useState(item?.category_id ?? defCat ?? '');
  const [qty, setQty] = useState(item ? nf(item.qty) : '1');
  const [cost, setCost] = useState(item ? nf(item.unit_cost) : '');
  const [cur, setCur] = useState(item?.currency ?? 'EUR');
  const [fx, setFx] = useState(item?.fx_rate ? nf(item.fx_rate) : rate ? nf(rate.toFixed(2)) : '');
  const isIn = cats.in.some((c) => c.id === cat);
  const total = useMemo(() => {
    const q = parseAmount(qty || '1'), c = parseAmount(cost), r = parseAmount(fx);
    if (q == null || c == null) return null;
    const orig = Math.round(q * c * 100) / 100;
    if (cur === 'EUR') return { orig, eur: orig };
    return r ? { orig, eur: Math.round((orig / r) * 100) / 100 } : { orig, eur: null };
  }, [qty, cost, cur, fx]);
  const partyGroups: [string, Opt[]][] = isIn
    ? [[L('Donatori e finanziatori', 'Donateurs et bailleurs'), parties.donor], [L('Fornitori', 'Fournisseurs'), parties.supplier], [L('Altri', 'Autres'), parties.other]]
    : [[L('Fornitori', 'Fournisseurs'), parties.supplier], [L('Donatori e finanziatori', 'Donateurs et bailleurs'), parties.donor], [L('Altri', 'Autres'), parties.other]];
  return (
    <form action={action} className="fgrid bq-form">
      <input type="hidden" name="year" value={year} /><input type="hidden" name="budget_id" value={budgetId} />
      <input type="hidden" name="ret" value={ret} />{item && <input type="hidden" name="id" value={item.id} />}
      <div className="field span2"><label htmlFor="bq-cat">{L('Codice (voce di uscita o di entrata)', 'Code (poste de dépense ou de recette)')}</label>
        <select className="input" id="bq-cat" name="category_id" required value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="" disabled>{L('Scegli dal piano dei conti…', 'Choisir dans le plan comptable…')}</option>
          <optgroup label={L('Uscite', 'Dépenses')}>{cats.out.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>
          <optgroup label={L('Entrate', 'Recettes')}>{cats.in.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>
        </select></div>
      <div className="field span2"><label htmlFor="bq-desc">{L('Descrizione', 'Description')}</label>
        <input className="input" id="bq-desc" name="description" maxLength={300} defaultValue={item?.description ?? ''}
          placeholder={isIn ? L('Es. contributo per il progetto scuola', 'Ex. contribution pour le projet école') : L('Es. quaderni e penne per 3 classi', 'Ex. cahiers et stylos pour 3 classes')} /></div>
      <div className="field span2p"><label htmlFor="bq-prj">{L('Progetto', 'Projet')}</label>
        <select className="input" id="bq-prj" name="project_id" defaultValue={item ? item.project_id ?? '' : defPrj ?? ''}>
          <option value="">{L('Generale (struttura)', 'Général (structure)')}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select></div>
      <div className="field span2p"><label htmlFor="bq-cp">{isIn ? L('Donatore (facoltativo)', 'Donateur (facultatif)') : L('Fornitore (facoltativo)', 'Fournisseur (facultatif)')}</label>
        <select className="input" id="bq-cp" name="counterparty_id" defaultValue={item?.counterparty_id ?? ''}>
          <option value="">{L('Non indicato', 'Non indiqué')}</option>
          {partyGroups.filter(([, xs]) => xs.length > 0).map(([g, xs]) => <optgroup key={g} label={g}>{xs.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>)}
        </select></div>
      <div className="field"><label htmlFor="bq-qty">{L('Quantità', 'Quantité')}</label>
        <input className="input num" id="bq-qty" name="qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
      <div className="field"><label htmlFor="bq-unit">{L('Unità di misura', 'Unité de mesure')}</label>
        <input className="input" id="bq-unit" name="unit" maxLength={30} list="bq-units" defaultValue={item?.unit ?? ''} placeholder={L('es. mesi, pezzi, persone', 'ex. mois, pièces, personnes')} />
        <datalist id="bq-units">{units.map((u) => <option key={u} value={u} />)}</datalist></div>
      <div className="field"><label htmlFor="bq-cost">{L('Costo unitario', 'Coût unitaire')}</label>
        <input className="input num" id="bq-cost" name="unit_cost" inputMode="decimal" required value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" /></div>
      <div className="field"><label htmlFor="bq-cur">{L('Valuta', 'Devise')}</label>
        <select className="input" id="bq-cur" name="currency" value={cur} onChange={(e) => setCur(e.target.value)}>
          <option value="EUR">{L('Euro (EUR)', 'Euro (EUR)')}</option><option value="MGA">{L('Ariary (MGA)', 'Ariary (MGA)')}</option>
        </select></div>
      {cur === 'MGA' && <div className="field span2"><label htmlFor="bq-fx">{L('Tasso di cambio: ariary per 1 euro', 'Taux de change : ariary pour 1 euro')}</label>
        <input className="input num" id="bq-fx" name="fx_rate" inputMode="decimal" required value={fx} onChange={(e) => setFx(e.target.value)} placeholder={L('es. 5.000', 'ex. 5 000')} /></div>}
      <div className="span2 bq-total" aria-live="polite">
        <span>{L('Totale della riga', 'Total de la ligne')}</span>
        <b className="num">{total?.eur != null ? money(total.eur, 'EUR', lang) : '–'}</b>
        {total && cur === 'MGA' && <small className="num">{money(total.orig, 'MGA', lang)}</small>}
      </div>
      <div className="field span2"><label htmlFor="bq-notes">{L('Note (facoltative)', 'Notes (facultatives)')}</label>
        <input className="input" id="bq-notes" name="notes" maxLength={500} defaultValue={item?.notes ?? ''} /></div>
      {needReason && <div className="field span2"><label htmlFor="bi-reason">{item ? L('Motivo della modifica (resta nello storico)', 'Motif de la modification (reste dans l\'historique)') : L('Motivo dell\'aggiunta (resta nello storico)', 'Motif de l\'ajout (reste dans l\'historique)')}</label>
        <input className="input" id="bi-reason" name="reason" required minLength={5} maxLength={500}
          placeholder={item ? L('Es. importo corretto dopo il nuovo preventivo del fornitore', 'Ex. montant corrigé après le nouveau devis du fournisseur') : L('Es. spesa approvata dal Consiglio il…', 'Ex. dépense approuvée par le Conseil le…')} /></div>}
      <div className="span2 bq-sub">
        <button className="btn primary" type="submit">{L('Salva', 'Enregistrer')}</button>
        {!item && <button className="btn" type="submit" name="again" value="1">{L('Salva e continua', 'Enregistrer et continuer')}</button>}
        <Link className="btn ghost" href={cancelHref} scroll={false}>{L('Annulla', 'Annuler')}</Link>
      </div>
    </form>
  );
}
