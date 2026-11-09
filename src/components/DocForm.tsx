'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { buildModel, DIC_TPL, DOC_TYPES, type DocType, type NotLine, type NrsLine, type Org } from '@/lib/doc-model';
import { LINES, pickRate, readDocForm } from '@/lib/doc-form';
import { money } from '@/lib/format';
import { saveDoc } from '@/app/(app)/documenti-emessi/actions';
import { DocPreview } from './DocPreview';

export type IssuableType = Exclude<DocType, 'AUT'>;
export type DocInit = { id?: string; type: IssuableType; lang: string; doc_date: string; movement_id?: string | null; project_id?: string | null;
  counterparty_id?: string | null; party_name?: string | null; party_tax_id?: string | null; party_address?: string | null; amount?: number | string | null;
  currency: string; data: Record<string, unknown> };

// Campi definiti fuori dal componente: se fossero ricreati a ogni aggiornamento dell'anteprima, React
// rimonterebbe gli input e si perderebbe quanto scritto.
type FldProps = { k: string; label: string; type?: string; def?: string; span?: boolean; req?: boolean; list?: string; ph?: string };
function Fld({ k, label, type = 'text', def, span, req, list, ph, x }: FldProps & { x: Record<string, unknown> }) {
  return (
    <div className={`field${span ? ' span2' : ''}`}><label htmlFor={`df-${k}`}>{label}</label>
      <input className={`input${type === 'num' ? ' num' : ''}`} id={`df-${k}`} name={k} type={type === 'num' ? 'text' : type} inputMode={type === 'num' ? 'decimal' : undefined}
             defaultValue={def ?? (x[k] == null ? '' : String(x[k]))} required={req} list={list} placeholder={ph} /></div>);
}
function Chk({ k, label, x }: { k: string; label: string; x: Record<string, unknown> }) {
  return <label className="check span2"><input type="checkbox" name={k} defaultChecked={Boolean(x[k])} /> {label}</label>;
}

// Modulo di un documento con anteprima live: l'anteprima si aggiorna mentre si scrive, prima di salvare.
// Senza JavaScript il modulo funziona comunque (righe fisse, quelle vuote si ignorano) e l'anteprima arriva dopo il salvataggio.
export function DocForm({ init, lang, projects, methods, back, org, rates, movementRate, movementRef, signer }: {
  init: DocInit; lang: 'it' | 'fr'; projects: { id: string; name: string }[]; methods: string[]; back: string; org: Org;
  rates: Record<string, number>; movementRate?: number | null; movementRef?: string | null; signer: { name?: string; role?: string } }) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const x = init.data;
  const s = (k: string) => (x[k] == null ? '' : String(x[k]));
  const t = init.type;
  const formRef = useRef<HTMLFormElement>(null);
  const [tpl, setTpl] = useState(s('tpl') || 'vol');
  const [view, setView] = useState<'form' | 'prev'>('form');
  const [md, setMd] = useState<ReturnType<typeof buildModel> | null>(null);
  const [fxInfo, setFxInfo] = useState('');

  const refresh = useCallback(() => {
    const f = formRef.current;
    if (!f) return;
    const p = readDocForm(new FormData(f));
    const fx = pickRate(rates, p.doc_date, movementRate);
    const prj = projects.find((q) => q.id === p.project_id)?.name ?? null;
    setMd(buildModel({ ...p, type: p.type, lang: p.lang as 'it' | 'fr' | 'both', number: null, amount: p.amount, signer_name: signer.name ?? null,
      signer_role: signer.role ?? null, movement_ref: movementRef ?? null, project_name: prj, data: { ...p.data, fx_rate: fx || undefined } }, org));
    const a = Number(p.amount) || 0;
    setFxInfo(!fx ? L('Nessun tasso di cambio per il mese: il documento mostrerà solo la valuta scelta.', 'Aucun taux pour le mois : le document affichera seulement la devise choisie.')
      : `1 € = ${money(fx, 'MGA', lang)}${a ? ` · ${p.currency === 'EUR' ? money(Math.round(a * fx), 'MGA', lang) : money(Math.round((a / fx) * 100) / 100, 'EUR', lang)}` : ''}`
        + (movementRate ? L(' (tasso del movimento)', ' (taux du mouvement)') : L(' (tasso del mese)', ' (taux du mois)')));
  }, [rates, movementRate, projects, signer, movementRef, org, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, [refresh, tpl]);

  const partyLabel = { RIC: L('Ricevuto da', 'Reçu de'), QUI: L('Percipiente (chi riceve il pagamento)', 'Bénéficiaire (qui reçoit le paiement)'),
    NOT: L('Prestatore', 'Prestataire'), NRS: L('Richiedente (volontario o collaboratore)', 'Demandeur (bénévole ou collaborateur)'),
    ASP: L('Richiedente (chi farà la spesa)', 'Demandeur (qui fera la dépense)'), NDD: L('Destinatario (chi deve pagare)', 'Destinataire (qui doit payer)'),
    DIC: tpl === 'vol' ? L('Volontario/a', 'Bénévole') : tpl === 'don' ? L('Donatore', 'Donateur') : L('Destinatario (facoltativo)', 'Destinataire (facultatif)'),
    BDC: L('Fornitore', 'Fournisseur') }[t];
  const lines = (x.lines as (NotLine & NrsLine)[] | undefined) ?? [];
  const num = (v: number | string | null | undefined) => (v == null || v === '' ? '' : String(Number(v)).replace('.', ','));
  const withAmount = t !== 'NOT' && t !== 'NRS' && t !== 'BDC' && (t !== 'DIC' || tpl === 'don');
  const qtyLines = t === 'NOT' || t === 'BDC';

  return (
    <div className="docedit" data-view={view}>
      <div className="segs de-switch" role="tablist" aria-label={L('Vista', 'Vue')}>
        <button type="button" role="tab" aria-selected={view === 'form'} className={view === 'form' ? 'on' : ''} onClick={() => setView('form')}>{L('Modulo', 'Formulaire')}</button>
        <button type="button" role="tab" aria-selected={view === 'prev'} className={view === 'prev' ? 'on' : ''} onClick={() => { refresh(); setView('prev'); }}>{L('Anteprima', 'Aperçu')}</button>
      </div>
      <form ref={formRef} action={saveDoc} className="fgrid de-form" onInput={refresh} onChange={refresh}>
        {init.id && <input type="hidden" name="id" value={init.id} />}
        <input type="hidden" name="type" value={t} />
        {init.movement_id && <input type="hidden" name="movement_id" value={init.movement_id} />}
        {init.counterparty_id && <input type="hidden" name="counterparty_id" value={init.counterparty_id} />}
        <datalist id="df-methods">{methods.map((m) => <option key={m} value={m} />)}</datalist>
        <div className="field"><label htmlFor="df-lang">{L('Lingua del documento', 'Langue du document')}</label>
          <select className="input" id="df-lang" name="lang" defaultValue={init.lang}>
            <option value="it">Italiano</option><option value="fr">Français</option><option value="both">Italiano + Français</option></select></div>
        <Fld x={x} k="doc_date" label={L('Data del documento', 'Date du document')} type="date" def={init.doc_date} req />
        {t === 'DIC' && (
          <div className="field span2"><label htmlFor="df-tpl">{L('Modello', 'Modèle')}</label>
            <select className="input" id="df-tpl" name="tpl" value={tpl} onChange={(e) => setTpl(e.target.value)}>
              {(Object.keys(DIC_TPL) as (keyof typeof DIC_TPL)[]).map((k) => <option key={k} value={k}>{L(DIC_TPL[k][0], DIC_TPL[k][1])}</option>)}</select></div>
        )}
        <Fld x={x} k="party_name" label={partyLabel} def={init.party_name ?? ''} req={t !== 'DIC' || tpl !== 'free'} span />
        <Fld x={x} k="party_tax_id" label={L('Codice fiscale / NIF / documento', 'Code fiscal / NIF / pièce')} def={init.party_tax_id ?? ''} />
        <Fld x={x} k="party_address" label={L('Indirizzo', 'Adresse')} def={init.party_address ?? ''} />
        <div className="field"><label htmlFor="df-prj">{L('Progetto', 'Projet')}</label>
          <select className="input" id="df-prj" name="project_id" defaultValue={init.project_id ?? ''}><option value="">–</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="field"><label htmlFor="df-cur">{L('Valuta di inserimento', 'Devise de saisie')}</label>
          <select className="input" id="df-cur" name="currency" defaultValue={init.currency}><option>EUR</option><option>MGA</option></select></div>

        {withAmount && <Fld x={x} k="amount" label={t === 'ASP' ? L('Importo massimo autorizzato', 'Montant maximum autorisé') : t === 'DIC' ? L('Totale donato nell\'anno', 'Total donné dans l\'année') : L('Importo', 'Montant')} type="num" def={num(init.amount)} req />}
        <p className="hint span2 de-fx" aria-live="polite">{fxInfo}</p>
        {(t === 'RIC' || t === 'QUI' || t === 'NOT' || t === 'ASP' || t === 'BDC') && <Fld x={x} k="method" label={L('Modalità di pagamento', 'Mode de paiement')} list="df-methods" />}

        {t === 'RIC' && <>
          <div className="field"><label htmlFor="df-causale">{L('Causale', 'Motif')}</label>
            <select className="input" id="df-causale" name="causale" defaultValue={s('causale') || 'don'}>
              <option value="don">{L('Erogazione liberale', 'Libéralité (don)')}</option><option value="quota">{L('Quota associativa', 'Cotisation')}</option>
              <option value="contr">{L('Contributo ai progetti', 'Contribution aux projets')}</option><option value="altro">{L('Altro', 'Autre')}</option></select></div>
          <Fld x={x} k="received_on" label={L('Ricevuto il', 'Reçu le')} type="date" />
          <Fld x={x} k="causale_txt" label={L('Dettaglio della causale', 'Détail du motif')} span />
          <Chk x={x} k="deduc" label={L('Aggiungi la nota sulle agevolazioni fiscali per il donatore (art. 83 CTS, solo versamenti tracciabili)', 'Ajouter la note sur les avantages fiscaux du donateur (art. 83 CTS, versements traçables)')} />
          <Chk x={x} k="bollo_exempt" label={L('Indica l\'esenzione dall\'imposta di bollo (art. 82 c.5 CTS) – da confermare con il commercialista', 'Indiquer l\'exonération du droit de timbre (art. 82 al.5 CTS) – à confirmer')} />
        </>}
        {t === 'QUI' && <>
          <Fld x={x} k="desc" label={L('A saldo di (cosa è stato pagato)', 'Pour solde de (objet du paiement)')} span req />
          <Fld x={x} k="paid_on" label={L('Pagato il', 'Payé le')} type="date" />
        </>}
        {t === 'ASP' && <>
          <Fld x={x} k="desc" label={L('Oggetto della spesa', 'Objet de la dépense')} span req />
          <Fld x={x} k="role" label={L('Ruolo del richiedente', 'Fonction du demandeur')} />
          <Fld x={x} k="code" label={L('Codice di spesa', 'Code de dépense')} />
          <Fld x={x} k="supplier" label={L('Fornitore previsto', 'Fournisseur prévu')} />
          <Fld x={x} k="need_by" label={L('Da effettuare entro', 'À effectuer avant le')} type="date" />
          <Fld x={x} k="reason" label={L('Motivazione', 'Motif')} span />
          <Chk x={x} k="advance" label={L('Con anticipo di cassa', 'Avec avance de caisse')} />
        </>}
        {t === 'NDD' && <>
          <Fld x={x} k="desc" label={L('A titolo di', 'Au titre de')} span req />
          <Fld x={x} k="ref" label={L('Riferimento (convenzione, accordo, tranche)', 'Référence (convention, accord, tranche)')} />
          <Fld x={x} k="pay_by" label={L('Da pagare entro', 'À payer avant le')} type="date" />
        </>}
        {t === 'DIC' && <>
          <Fld x={x} k="declarant" label={L('Chi firma (nome e cognome)', 'Signataire (nom et prénom)')} def={s('declarant') || signer.name || ''} />
          {tpl === 'vol' && <>
            <Fld x={x} k="period" label={L('Periodo', 'Période')} ph={L('es. marzo–settembre 2026', 'ex. mars–septembre 2026')} />
            <Fld x={x} k="hours" label={L('Ore (facoltativo)', 'Heures (facultatif)')} type="num" />
            <Fld x={x} k="activity" label={L('Attività svolta', 'Activité réalisée')} span />
          </>}
          {tpl === 'don' && <Fld x={x} k="year" label={L('Anno', 'Année')} def={s('year') || String(new Date().getFullYear() - 1)} />}
          {tpl === 'free' && <>
            <Fld x={x} k="title" label={L('Titolo del documento', 'Titre du document')} span req />
            <div className="field span2"><label htmlFor="df-body">{L('Testo in italiano (riga vuota = nuovo paragrafo)', 'Texte en italien (ligne vide = nouveau paragraphe)')}</label>
              <textarea className="input" id="df-body" name="body" rows={6} defaultValue={s('body')} /></div>
            <div className="field span2"><label htmlFor="df-bodyfr">{L('Testo in francese (per i documenti in francese o bilingui)', 'Texte en français (documents en français ou bilingues)')}</label>
              <textarea className="input" id="df-bodyfr" name="body_fr" rows={6} defaultValue={s('body_fr')} /></div>
          </>}
        </>}
        {t === 'BDC' && <>
          <Fld x={x} k="code" label={L('Codice di spesa', 'Code de dépense')} />
          <Fld x={x} k="delivery_by" label={L('Consegna entro', 'Livraison avant le')} type="date" />
          <Fld x={x} k="delivery_place" label={L('Luogo di consegna', 'Lieu de livraison')} />
          <Fld x={x} k="terms" label={L('Condizioni di pagamento', 'Conditions de paiement')} ph={L('es. alla consegna', 'ex. à la livraison')} />
        </>}
        {t === 'NOT' && <>
          <Fld x={x} k="period" label={L('Periodo della prestazione', 'Période de la prestation')} />
          <div className="field"><label htmlFor="df-rit">{L('Ritenuta d\'acconto %', 'Retenue à la source %')}</label>
            <input className="input num" id="df-rit" name="ritenuta" inputMode="decimal" defaultValue={num(x.ritenuta as number) || '0'} />
            <span className="hint">{L('20% se il prestatore è residente in Italia; 0 per prestazioni rese all\'estero da non residenti. Da confermare con il commercialista.',
              '20 % si le prestataire réside en Italie ; 0 pour des prestations réalisées hors d\'Italie par des non-résidents. À confirmer.')}</span></div>
        </>}
        {qtyLines && (
          <div className="field span2"><span className="flabel">{L('Righe', 'Lignes')}</span>
            <div className="dlines">
              <div className="ln lh"><span>{L('Descrizione', 'Description')}</span><span>{L('Quantità', 'Quantité')}</span><span>{L('Prezzo unitario', 'Prix unitaire')}</span></div>
              {Array.from({ length: LINES[t as 'NOT' | 'BDC'] }, (_, i) => (
                <div className="ln" key={i}>
                  <input className="input" name={`l${i}_d`} aria-label={`${L('Descrizione riga', 'Description ligne')} ${i + 1}`} defaultValue={lines[i]?.d ?? ''} />
                  <input className="input num" name={`l${i}_q`} inputMode="decimal" aria-label={`${L('Quantità riga', 'Quantité ligne')} ${i + 1}`} defaultValue={num(lines[i]?.q)} />
                  <input className="input num" name={`l${i}_p`} inputMode="decimal" aria-label={`${L('Prezzo riga', 'Prix ligne')} ${i + 1}`} defaultValue={num(lines[i]?.p)} />
                </div>))}
            </div></div>
        )}
        {t === 'NRS' && <>
          <Fld x={x} k="activity" label={L('Attività svolta', 'Activité réalisée')} span />
          <Chk x={x} k="volunteer" label={L('Il richiedente è un volontario (art. 17 CTS: solo spese effettive; senza giustificativo al massimo 10 € al giorno e 150 € al mese)',
            'Le demandeur est bénévole (art. 17 CTS : seulement des frais réels ; sans justificatif, au maximum 10 € par jour et 150 € par mois)')} />
          <div className="field span2"><span className="flabel">{L('Spese', 'Frais')}</span>
            <div className="dlines">
              <div className="ln nrs lh"><span>{L('Data', 'Date')}</span><span>{L('Descrizione', 'Description')}</span><span>{L('Importo', 'Montant')}</span><span>{L('Giustificativo', 'Justificatif')}</span></div>
              {Array.from({ length: LINES.NRS }, (_, i) => (
                <div className="ln nrs" key={i}>
                  <input className="input" type="date" name={`l${i}_date`} aria-label={`${L('Data riga', 'Date ligne')} ${i + 1}`} defaultValue={lines[i]?.date ?? ''} />
                  <input className="input" name={`l${i}_d`} aria-label={`${L('Descrizione riga', 'Description ligne')} ${i + 1}`} defaultValue={lines[i]?.d ?? ''} />
                  <input className="input num" name={`l${i}_a`} inputMode="decimal" aria-label={`${L('Importo riga', 'Montant ligne')} ${i + 1}`} defaultValue={num(lines[i]?.amt)} />
                  <label className="check"><input type="checkbox" name={`l${i}_doc`} defaultChecked={lines[i] ? lines[i].doc : true} /> {L('sì', 'oui')}</label>
                </div>))}
            </div></div>
        </>}
        <div className="span2 row-actions">
          <button className="btn primary" type="submit">{L('Salva la bozza', 'Enregistrer le brouillon')}</button>
          <Link className="btn ghost" href={back}>{L('Annulla', 'Annuler')}</Link>
          <span className="hint">{L(DOC_TYPES[t].what[0], DOC_TYPES[t].what[1])} {L('La bozza non ha numero: lo riceve all\'emissione.', 'Le brouillon n\'a pas de numéro : il le reçoit à l\'émission.')}</span>
        </div>
      </form>
      <aside className="de-prev" aria-label={L('Anteprima', 'Aperçu')}>
        <div className="de-prev-h"><b>{L('Anteprima', 'Aperçu')}</b><span className="muted">{L('si aggiorna mentre scrivi', 'mise à jour pendant la saisie')}</span></div>
        {md ? <DocPreview md={md} /> : <div className="docprev skel" style={{ minHeight: 420 }} />}
      </aside>
    </div>
  );
}
