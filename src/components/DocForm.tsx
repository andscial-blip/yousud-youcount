import Link from 'next/link';
import { DOC_TYPES, type DocType, type NotLine, type NrsLine } from '@/lib/doc-model';
import { saveDoc } from '@/app/(app)/documenti-emessi/actions';

export type DocInit = { id?: string; type: Exclude<DocType, 'AUT'>; lang: string; doc_date: string; movement_id?: string | null; project_id?: string | null;
  counterparty_id?: string | null; party_name?: string | null; party_tax_id?: string | null; party_address?: string | null; amount?: number | string | null;
  currency: string; data: Record<string, unknown> };

// Modulo di un documento emesso (bozza). Senza JavaScript: righe fisse, quelle vuote si ignorano.
export function DocForm({ init, lang, projects, methods, back }: { init: DocInit; lang: 'it' | 'fr'; projects: { id: string; name: string }[];
  methods: string[]; back: string }) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const x = init.data;
  const s = (k: string) => (x[k] == null ? '' : String(x[k]));
  const F = ({ k, label, type = 'text', def, span, req, list }: { k: string; label: string; type?: string; def?: string; span?: boolean; req?: boolean; list?: string }) => (
    <div className={`field${span ? ' span2' : ''}`}><label htmlFor={`df-${k}`}>{label}</label>
      <input className={`input${type === 'num' ? ' num' : ''}`} id={`df-${k}`} name={k} type={type === 'num' ? 'text' : type} inputMode={type === 'num' ? 'decimal' : undefined}
             defaultValue={def ?? s(k)} required={req} list={list} /></div>);
  const C = ({ k, label }: { k: string; label: string }) => (
    <label className="check span2"><input type="checkbox" name={k} defaultChecked={Boolean(x[k])} /> {label}</label>);
  const t = init.type;
  const partyLabel = { RIC: L('Ricevuto da', 'Reçu de'), QUI: L('Percipiente (chi riceve il pagamento)', 'Bénéficiaire (qui reçoit le paiement)'),
    NOT: L('Prestatore', 'Prestataire'), NRS: L('Richiedente (volontario o collaboratore)', 'Demandeur (bénévole ou collaborateur)'),
    ASP: L('Richiedente (chi farà la spesa)', 'Demandeur (qui fera la dépense)'), NDD: L('Destinatario (chi deve pagare)', 'Destinataire (qui doit payer)') }[t];
  const notL = (x.lines as NotLine[] | undefined) ?? [];
  const nrsL = (x.lines as NrsLine[] | undefined) ?? [];
  const num = (v: number | string | null | undefined) => (v == null || v === '' ? '' : String(Number(v)).replace('.', ','));
  return (
    <form action={saveDoc} className="fgrid">
      {init.id && <input type="hidden" name="id" value={init.id} />}
      <input type="hidden" name="type" value={t} />
      {init.movement_id && <input type="hidden" name="movement_id" value={init.movement_id} />}
      {init.counterparty_id && <input type="hidden" name="counterparty_id" value={init.counterparty_id} />}
      <datalist id="df-methods">{methods.map((m) => <option key={m} value={m} />)}</datalist>
      <div className="field"><label htmlFor="df-lang">{L('Lingua del documento', 'Langue du document')}</label>
        <select className="input" id="df-lang" name="lang" defaultValue={init.lang}>
          <option value="it">Italiano</option><option value="fr">Français</option><option value="both">Italiano + Français</option></select></div>
      <F k="doc_date" label={L('Data del documento', 'Date du document')} type="date" def={init.doc_date} req />
      <F k="party_name" label={partyLabel} def={init.party_name ?? ''} req span />
      <F k="party_tax_id" label={L('Codice fiscale / NIF / documento', 'Code fiscal / NIF / pièce')} def={init.party_tax_id ?? ''} />
      <F k="party_address" label={L('Indirizzo', 'Adresse')} def={init.party_address ?? ''} />
      <div className="field"><label htmlFor="df-prj">{L('Progetto', 'Projet')}</label>
        <select className="input" id="df-prj" name="project_id" defaultValue={init.project_id ?? ''}><option value="">–</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="field"><label htmlFor="df-cur">{L('Valuta', 'Devise')}</label>
        <select className="input" id="df-cur" name="currency" defaultValue={init.currency}><option>EUR</option><option>MGA</option></select></div>

      {t !== 'NOT' && t !== 'NRS' && <F k="amount" label={t === 'ASP' ? L('Importo massimo autorizzato', 'Montant maximum autorisé') : L('Importo', 'Montant')} type="num" def={num(init.amount)} req />}
      {(t === 'RIC' || t === 'QUI' || t === 'NOT' || t === 'ASP') && <F k="method" label={L('Modalità di pagamento', 'Mode de paiement')} list="df-methods" />}

      {t === 'RIC' && <>
        <div className="field"><label htmlFor="df-causale">{L('Causale', 'Motif')}</label>
          <select className="input" id="df-causale" name="causale" defaultValue={s('causale') || 'don'}>
            <option value="don">{L('Erogazione liberale', 'Libéralité (don)')}</option><option value="quota">{L('Quota associativa', 'Cotisation')}</option>
            <option value="contr">{L('Contributo ai progetti', 'Contribution aux projets')}</option><option value="altro">{L('Altro', 'Autre')}</option></select></div>
        <F k="received_on" label={L('Ricevuto il', 'Reçu le')} type="date" />
        <F k="causale_txt" label={L('Dettaglio della causale', 'Détail du motif')} span />
        <C k="deduc" label={L('Aggiungi la nota sulle agevolazioni fiscali per il donatore (art. 83 CTS, solo versamenti tracciabili)', 'Ajouter la note sur les avantages fiscaux du donateur (art. 83 CTS, versements traçables)')} />
        <C k="bollo_exempt" label={L('Indica l\'esenzione dall\'imposta di bollo (art. 82 c.5 CTS) – da confermare con il commercialista', 'Indiquer l\'exonération du droit de timbre (art. 82 al.5 CTS) – à confirmer')} />
      </>}
      {t === 'QUI' && <>
        <F k="desc" label={L('A saldo di (cosa è stato pagato)', 'Pour solde de (objet du paiement)')} span req />
        <F k="paid_on" label={L('Pagato il', 'Payé le')} type="date" />
      </>}
      {t === 'ASP' && <>
        <F k="desc" label={L('Oggetto della spesa', 'Objet de la dépense')} span req />
        <F k="role" label={L('Ruolo del richiedente', 'Fonction du demandeur')} />
        <F k="code" label={L('Codice di spesa', 'Code de dépense')} />
        <F k="supplier" label={L('Fornitore previsto', 'Fournisseur prévu')} />
        <F k="need_by" label={L('Da effettuare entro', 'À effectuer avant le')} type="date" />
        <F k="reason" label={L('Motivazione', 'Motif')} span />
        <C k="advance" label={L('Con anticipo di cassa', 'Avec avance de caisse')} />
      </>}
      {t === 'NDD' && <>
        <F k="desc" label={L('A titolo di', 'Au titre de')} span req />
        <F k="ref" label={L('Riferimento (convenzione, accordo, tranche)', 'Référence (convention, accord, tranche)')} />
        <F k="pay_by" label={L('Da pagare entro', 'À payer avant le')} type="date" />
      </>}
      {t === 'NOT' && <>
        <F k="period" label={L('Periodo della prestazione', 'Période de la prestation')} />
        <div className="field"><label htmlFor="df-rit">{L('Ritenuta d\'acconto %', 'Retenue à la source %')}</label>
          <input className="input num" id="df-rit" name="ritenuta" inputMode="decimal" defaultValue={num(x.ritenuta as number) || '0'} />
          <span className="hint">{L('20% se il prestatore è residente in Italia; 0 per prestazioni rese all\'estero da non residenti. Da confermare con il commercialista.',
            '20 % si le prestataire réside en Italie ; 0 pour des prestations réalisées hors d\'Italie par des non-résidents. À confirmer.')}</span></div>
        <div className="field span2"><span className="flabel">{L('Righe', 'Lignes')}</span>
          <div className="lines">
            <div className="ln lh"><span>{L('Descrizione', 'Description')}</span><span>{L('Quantità', 'Quantité')}</span><span>{L('Prezzo unitario', 'Prix unitaire')}</span></div>
            {Array.from({ length: 6 }, (_, i) => (
              <div className="ln" key={i}>
                <input className="input" name={`l${i}_d`} aria-label={`${L('Descrizione riga', 'Description ligne')} ${i + 1}`} defaultValue={notL[i]?.d ?? ''} />
                <input className="input num" name={`l${i}_q`} inputMode="decimal" aria-label={`${L('Quantità riga', 'Quantité ligne')} ${i + 1}`} defaultValue={num(notL[i]?.q)} />
                <input className="input num" name={`l${i}_p`} inputMode="decimal" aria-label={`${L('Prezzo riga', 'Prix ligne')} ${i + 1}`} defaultValue={num(notL[i]?.p)} />
              </div>))}
          </div></div>
      </>}
      {t === 'NRS' && <>
        <F k="activity" label={L('Attività svolta', 'Activité réalisée')} span />
        <C k="volunteer" label={L('Il richiedente è un volontario (art. 17 CTS: solo spese effettive; senza giustificativo al massimo 10 € al giorno e 150 € al mese)',
          'Le demandeur est bénévole (art. 17 CTS : seulement des frais réels ; sans justificatif, au maximum 10 € par jour et 150 € par mois)')} />
        <div className="field span2"><span className="flabel">{L('Spese', 'Frais')}</span>
          <div className="lines">
            <div className="ln nrs lh"><span>{L('Data', 'Date')}</span><span>{L('Descrizione', 'Description')}</span><span>{L('Importo', 'Montant')}</span><span>{L('Giustificativo', 'Justificatif')}</span></div>
            {Array.from({ length: 8 }, (_, i) => (
              <div className="ln nrs" key={i}>
                <input className="input" type="date" name={`l${i}_date`} aria-label={`${L('Data riga', 'Date ligne')} ${i + 1}`} defaultValue={nrsL[i]?.date ?? ''} />
                <input className="input" name={`l${i}_d`} aria-label={`${L('Descrizione riga', 'Description ligne')} ${i + 1}`} defaultValue={nrsL[i]?.d ?? ''} />
                <input className="input num" name={`l${i}_a`} inputMode="decimal" aria-label={`${L('Importo riga', 'Montant ligne')} ${i + 1}`} defaultValue={num(nrsL[i]?.amt)} />
                <label className="check"><input type="checkbox" name={`l${i}_doc`} defaultChecked={nrsL[i] ? nrsL[i].doc : true} /> {L('sì', 'oui')}</label>
              </div>))}
          </div></div>
      </>}
      <div className="span2 row-actions">
        <button className="btn primary" type="submit">{L('Salva la bozza e vedi l\'anteprima', 'Enregistrer le brouillon et voir l\'aperçu')}</button>
        <Link className="btn ghost" href={back}>{L('Annulla', 'Annuler')}</Link>
        <span className="hint">{L(DOC_TYPES[t].what[0], DOC_TYPES[t].what[1])}</span>
      </div>
    </form>
  );
}
