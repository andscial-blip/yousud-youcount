import AmountField from '@/components/AmountField';
import Link from 'next/link';

export type Mv = { grant_id: string | null; kind: string; amount_eur: string | null; sign: number; op_date: string; status: string; no_doc_reason: string | null; docs: { count: number }[] };
export type GrantRow = { id: string; title: string; code: string | null; currency: string; amount: string | null; start_date: string | null; end_date: string | null;
  status: string; notes?: string | null; donor: { id: string; name: string } | null; project: { id: string; name: string } | null };

// Movimenti che contano: registrati o verificati (come nei rendiconti); gli storni hanno segno −1 e si sottraggono da soli.
export const COUNTED = ['recorded', 'verified'];
export const eurOf = (m: { amount_eur: string | null; sign: number }) => Number(m.amount_eur ?? 0) * m.sign;
// spesa senza giustificativo: nessun documento allegato e nessun motivo indicato
export const missingDoc = (m: Mv) => m.kind === 'expense' && m.sign > 0 && !(m.docs?.[0]?.count) && !m.no_doc_reason;

export function totals(ms: Mv[]) {
  let rec = 0, sp = 0, miss = 0, unver = 0, nExp = 0;
  for (const m of ms) {
    if (m.kind === 'income') rec += eurOf(m);
    else if (m.kind === 'expense') { sp += eurOf(m); if (m.sign > 0) { nExp += 1; if (missingDoc(m)) miss += 1; if (m.status !== 'verified') unver += 1; } }
  }
  return { rec, sp, miss, unver, nExp };
}
// parte del periodo già trascorsa (0–1) e giorni alla fine; null se mancano le date
export function timeOf(g: { start_date: string | null; end_date: string | null }, today: string) {
  if (!g.start_date || !g.end_date) return null;
  const a = Date.parse(g.start_date), b = Date.parse(g.end_date), t = Date.parse(today);
  const days = Math.round((b - t) / 86400000);
  return { p: b > a ? Math.min(1, Math.max(0, (t - a) / (b - a))) : t >= b ? 1 : 0, days };
}

type Opt = { id: string; name: string };
// Campi del finanziamento, uguali per «Nuovo» e «Modifica»: finanziatore e progetto si scelgono dagli elenchi.
export function GrantFields({ L, g, donors, projects }: { L: (it: string, fr: string) => string; g?: GrantRow; donors: Opt[]; projects: Opt[] }) {
  return (<>
    <div className="field span2"><label htmlFor="g-title">{L('Titolo', 'Titre')}</label><input className="input" id="g-title" name="title" required minLength={2} maxLength={200} defaultValue={g?.title ?? ''} /></div>
    <div className="field span2"><label htmlFor="g-donor">{L('Finanziatore', 'Bailleur')}</label>
      <select className="input" id="g-donor" name="donor_id" defaultValue={g?.donor?.id ?? ''}><option value="">{L('Da indicare', 'À préciser')}</option>
        {donors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
      <small className="muted">{L('Manca dall\'elenco? Si aggiunge in ', 'Absent de la liste ? Il s\'ajoute dans ')}<Link href="/controparti">{L('Movimenti › Controparti', 'Mouvements › Contreparties')}</Link>.</small></div>
    <div className="field"><label htmlFor="g-prj">{L('Progetto', 'Projet')}</label>
      <select className="input" id="g-prj" name="project_id" defaultValue={g?.project?.id ?? ''}><option value="">{L('Nessun progetto', 'Aucun projet')}</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
    <div className="field"><label htmlFor="g-code">{L('Codice o riferimento', 'Code ou référence')}</label><input className="input" id="g-code" name="code" maxLength={60} defaultValue={g?.code ?? ''} /></div>
    <div className="field"><label htmlFor="g-amount">{L('Importo concesso', 'Montant accordé')}</label>
      <AmountField id="g-amount" name="amount" lang={L('it', 'fr') as 'it' | 'fr'} defaultValue={g?.amount ? String(Number(g.amount)).replace('.', ',') : ''} /></div>
    <div className="field"><label htmlFor="g-cur">{L('Valuta', 'Devise')}</label>
      <select className="input" id="g-cur" name="currency" defaultValue={g?.currency ?? 'EUR'}><option value="EUR">Euro (EUR)</option><option value="MGA">Ariary (MGA)</option></select></div>
    <div className="field"><label htmlFor="g-start">{L('Inizio', 'Début')}</label><input className="input" type="date" id="g-start" name="start_date" defaultValue={g?.start_date ?? ''} /></div>
    <div className="field"><label htmlFor="g-end">{L('Fine', 'Fin')}</label><input className="input" type="date" id="g-end" name="end_date" defaultValue={g?.end_date ?? ''} /></div>
    <div className="field span2"><label htmlFor="g-notes">{L('Note', 'Notes')}</label><textarea className="input" id="g-notes" name="notes" rows={3} maxLength={2000} defaultValue={g?.notes ?? ''} /></div>
  </>);
}
