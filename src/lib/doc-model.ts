import { date, money } from './format';

// Modelli dei documenti emessi da YouCount. Lo stesso modello produce l'anteprima nella pagina e il PDF,
// così ciò che si controlla prima dell'emissione è ciò che viene stampato. Testi ripresi dal Gestionale YouSud
// e dalle norme indicate: la conformità va confermata dal commercialista.
export type DocType = 'AUT' | 'RIC' | 'QUI' | 'NOT' | 'NRS' | 'ASP' | 'NDD' | 'DIC' | 'BDC';
export type Lang3 = 'it' | 'fr' | 'both';
export type Org = { name: string; address?: string | null; tax_id?: string | null; iban?: string | null; runts?: string | null; email?: string | null;
  phone?: string | null; web?: string | null; logo?: { mime: 'image/png' | 'image/jpeg'; data: string } | null };
// Importo in due valute: principale (EUR, grande) e secondaria (MGA, piccola). Senza tasso resta solo la valuta del documento.
export type Cell = string | [string, string];
export type Block =
  | { k: 'p'; text: string; soft?: boolean; strong?: boolean }
  | { k: 'table'; head: string[]; rows: Cell[][]; num: number[] }
  | { k: 'totals'; rows: [string, Cell, boolean?][] }
  | { k: 'sig'; labels: [string, string] };
export type Model = { title: string; number: string | null; meta: [string, string][]; blocks: Block[]; org: Org; draftLabel: string; placeDate: string;
  orgLine: string; footer: string; fxNote: string | null };

export const DOC_TYPES: Record<Exclude<DocType, 'AUT'>, { it: string; fr: string; what: [string, string] }> = {
  RIC: { it: 'Ricevuta', fr: 'Reçu', what: ['Per donazioni, quote associative e contributi incassati.', 'Pour dons, cotisations et contributions encaissés.'] },
  QUI: { it: 'Quietanza di pagamento', fr: 'Quittance de paiement', what: ['Firmata da chi riceve un pagamento da YouSud (es. contanti a un fornitore informale).', 'Signée par qui reçoit un paiement de YouSud (ex. espèces à un fournisseur informel).'] },
  NOT: { it: 'Notula di prestazione occasionale', fr: 'Note d\'honoraires (prestation occasionnelle)', what: ['Compenso a un collaboratore senza partita IVA, con eventuale ritenuta d\'acconto.', 'Rémunération d\'un collaborateur sans numéro de TVA, avec retenue éventuelle.'] },
  NRS: { it: 'Nota di rimborso spese', fr: 'Note de remboursement de frais', what: ['Rimborso a volontari e collaboratori delle spese sostenute per YouSud.', 'Remboursement aux bénévoles et collaborateurs des frais engagés pour YouSud.'] },
  ASP: { it: 'Autorizzazione di spesa', fr: 'Autorisation de dépense', what: ['Autorizza in anticipo una spesa con importo massimo.', 'Autorise à l\'avance une dépense avec un montant maximum.'] },
  NDD: { it: 'Nota di debito / richiesta di pagamento', fr: 'Note de débit / demande de paiement', what: ['Chiede il pagamento di una somma per attività istituzionale (fuori campo IVA).', 'Demande le paiement d\'une somme pour activité institutionnelle (hors TVA).'] },
  DIC: { it: 'Dichiarazione / attestazione', fr: 'Déclaration / attestation', what: ['Attestazione di volontariato, riepilogo annuale delle donazioni o dichiarazione libera dell\'associazione.', 'Attestation de bénévolat, récapitulatif annuel des dons ou déclaration libre de l\'association.'] },
  BDC: { it: 'Buono d\'ordine', fr: 'Bon de commande', what: ['Ordina beni o servizi a un fornitore con righe, consegna e condizioni di pagamento.', 'Commande des biens ou services à un fournisseur avec lignes, livraison et conditions de paiement.'] },
};
// Sezioni dell'archivio documenti (le autocertificazioni nascono dal movimento, le altre da «Emetti nuovo documento»)
export const DOC_GROUPS: { k: string; it: string; fr: string; types: DocType[] }[] = [
  { k: 'ricevute', it: 'Ricevute e quietanze', fr: 'Reçus et quittances', types: ['RIC', 'QUI'] },
  { k: 'notule', it: 'Notule', fr: 'Notes d\'honoraires', types: ['NOT'] },
  { k: 'rimborsi', it: 'Note di rimborso', fr: 'Notes de frais', types: ['NRS'] },
  { k: 'autocert', it: 'Autocertificazioni', fr: 'Attestations de dépense', types: ['AUT'] },
  { k: 'autorizz', it: 'Autorizzazioni di spesa', fr: 'Autorisations de dépense', types: ['ASP'] },
  { k: 'dich', it: 'Dichiarazioni', fr: 'Déclarations', types: ['DIC'] },
  { k: 'altri', it: 'Note di debito e ordini', fr: 'Notes de débit et commandes', types: ['NDD', 'BDC'] },
];
export const DIC_TPL = { vol: ['Attestazione di volontariato', 'Attestation de bénévolat'], don: ['Riepilogo annuale delle donazioni', 'Récapitulatif annuel des dons'],
  free: ['Dichiarazione libera', 'Déclaration libre'] } as const;

const BLANK = '________';
const v = (s: unknown) => (s != null && String(s).trim() ? String(s).trim() : BLANK);
const low = (s: string | null | undefined) => (s && !/^.[A-Z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s ?? '');
const num = (x: unknown) => (typeof x === 'number' ? x : Number(String(x ?? '').replace(',', '.')) || 0);

export type DocData = {
  type: DocType; number: string | null; lang: Lang3; doc_date: string; party_name: string | null; party_tax_id: string | null; party_address: string | null;
  amount: number | string | null; currency: string; data: Record<string, unknown>; signer_name: string | null; signer_role: string | null;
  movement_ref?: string | null; project_name?: string | null; amount_eur?: number | string | null;
  fx?: number | string | null;   // MGA per 1 EUR (tasso del documento, fissato al salvataggio in data.fx_rate)
};
export const docFx = (d: Pick<DocData, 'fx' | 'data' | 'currency' | 'amount' | 'amount_eur'>) => {
  const f = num(d.fx ?? d.data?.fx_rate);
  if (f > 0) return f;
  if (d.currency === 'MGA' && num(d.amount_eur) > 0 && num(d.amount) > 0) return num(d.amount) / num(d.amount_eur);
  return 0;
};

export type NotLine = { d: string; q: number; p: number };
export type NrsLine = { date: string; d: string; amt: number; doc: boolean };
export const notTotals = (lines: NotLine[], rit: number) => {
  const gross = Math.round(lines.reduce((s, l) => s + num(l.q) * num(l.p), 0) * 100) / 100;
  const r = Math.round(gross * (num(rit) / 100) * 100) / 100;
  return { gross, rit: r, net: Math.round((gross - r) * 100) / 100 };
};

export function buildModel(d: DocData, org: Org): Model {
  const ls: ('it' | 'fr')[] = d.lang === 'both' ? ['it', 'fr'] : [d.lang];
  const J = (it: string, fr: string) => (d.lang === 'both' ? `${it} / ${fr}` : d.lang === 'fr' ? fr : it);
  const l0 = ls[0];
  const fx = docFx(d);
  // € grande, MGA piccolo: ogni importo nelle due valute quando c'è il tasso
  const two = (x: unknown, l: 'it' | 'fr' = l0): [string, string] => {
    const a = num(x);
    if (!fx) return [money(a, d.currency, l), ''];
    const eur = d.currency === 'EUR' ? a : a / fx, mga = d.currency === 'MGA' ? a : a * fx;
    return [money(Math.round(eur * 100) / 100, 'EUR', l), money(Math.round(mga), 'MGA', l)];
  };
  const c = (x: unknown, l: 'it' | 'fr' = l0): Cell => { const [a, b] = two(x, l); return b ? [a, b] : a; };
  const m = (x: unknown, l: 'it' | 'fr' = l0) => { if (!num(x)) return BLANK; const [a, b] = two(x, l); return b ? `${a} (${b})` : a; };
  const x = d.data;
  const blocks: Block[] = [];
  // un paragrafo per lingua: il secondo (francese nel bilingue) in grigio
  const P = (fn: (l: 'it' | 'fr') => string) => ls.forEach((l, i) => blocks.push({ k: 'p', text: fn(l), soft: i > 0 }));
  const sign = [d.signer_name, d.signer_role].filter(Boolean).join(', ');
  const party = (l: 'it' | 'fr') => `${v(d.party_name)}${d.party_address ? `, ${d.party_address}` : ''}${d.party_tax_id ? ` (${l === 'it' ? 'C.F./ID' : 'ID'} ${d.party_tax_id})` : ''}`;
  const prj = (l: 'it' | 'fr') => (d.project_name ? (l === 'it' ? `, relativa al progetto «${d.project_name}»` : `, relative au projet « ${d.project_name} »`) : '');
  let title = '';

  if (d.type === 'AUT') {
    title = J('Autocertificazione di spesa', 'Attestation de dépense sur l\'honneur');
    const role = x.declarant_role ? `, ${x.declarant_role},` : ',';
    const where = `${v(x.supplier)}${x.place ? ` (${x.place})` : ''}`;
    P((l) => l === 'it'
      ? `Il/La sottoscritto/a ${v(x.declarant)}${role} in nome e per conto di ${org.name}, consapevole delle conseguenze previste dalla legge in caso di dichiarazioni non veritiere, DICHIARA sotto la propria responsabilità di aver sostenuto in data ${date(String(x.exp_date ?? ''))} presso ${where} la spesa di ${m(d.amount, l)} per: ${v(x.description)}${x.category ? ` (codice ${x.category})` : ''}${prj(l)}, pagata con ${v(low(x.method as string))}.`
      : `Je soussigné(e) ${v(x.declarant)}${role} agissant au nom et pour le compte de ${org.name}, conscient(e) des sanctions prévues en cas de fausse déclaration, ATTESTE SUR L'HONNEUR avoir engagé le ${date(String(x.exp_date ?? ''))} auprès de ${where} la dépense de ${m(d.amount, l)} pour : ${v(x.description)}${x.category_fr ?? x.category ? ` (code ${x.category_fr ?? x.category})` : ''}${prj(l)}, payée par ${v(low((x.method_fr ?? x.method) as string))}.`);
    P((l) => l === 'it'
      ? `Motivo dell'assenza del giustificativo fiscale: ${v(x.reason)}. Si impegna a conservare ogni elemento utile a verificare la spesa.`
      : `Motif d'absence de justificatif fiscal : ${v(x.reason)}. Le/la déclarant(e) s'engage à conserver tout élément permettant de vérifier la dépense.`);
    blocks.push({ k: 'sig', labels: [`${J('Il dichiarante', 'Le/la déclarant(e)')} – ${v(x.declarant)}`, `${J('Visto per approvazione', 'Visa pour approbation')}${sign ? ` – ${sign}` : ''}`] });
  } else if (d.type === 'RIC') {
    title = J('Ricevuta', 'Reçu');
    const caus = ({ don: ['erogazione liberale', 'libéralité (don)'], quota: ['quota associativa', 'cotisation'], contr: ['contributo a sostegno dei progetti', 'contribution en soutien aux projets'],
      altro: [String(x.causale_txt || 'altro'), String(x.causale_txt || 'autre')] } as Record<string, [string, string]>)[String(x.causale ?? 'don')] ?? ['', ''];
    const det = x.causale_txt && x.causale !== 'altro' ? ` – ${x.causale_txt}` : '';
    P((l) => l === 'it'
      ? `${org.name} dichiara di aver ricevuto da ${party(l)} la somma di ${m(d.amount, l)} a titolo di ${caus[0]}${det}, mediante ${v(low(x.method as string))}, in data ${date(String(x.received_on || d.doc_date))}.`
      : `${org.name} déclare avoir reçu de ${party(l)} la somme de ${m(d.amount, l)} au titre de ${caus[1]}${det}, par ${v(low(x.method as string))}, le ${date(String(x.received_on || d.doc_date))}.`);
    if (x.deduc && x.causale === 'don' && !/contant|esp[eè]ces|cash/i.test(String(x.method ?? '')))
      P((l) => l === 'it' ? 'La presente ricevuta può essere utilizzata dal donatore ai fini delle agevolazioni fiscali previste per le erogazioni liberali agli enti del Terzo settore (art. 83 D.Lgs. 117/2017), a condizione che il versamento sia tracciabile.'
        : 'Ce reçu peut être utilisé par le donateur pour les avantages fiscaux prévus en Italie pour les libéralités aux organismes du Tiers secteur (art. 83 D.Lgs. 117/2017), sous réserve que le versement soit traçable.');
    if (x.bollo_exempt) P((l) => l === 'it' ? 'Esente da imposta di bollo ai sensi dell\'art. 82, comma 5, D.Lgs. 117/2017.' : 'Exonéré du droit de timbre (art. 82, al. 5, D.Lgs. 117/2017).');
    blocks.push({ k: 'sig', labels: [`${J('Per ricevuta', 'Pour acquit')}${sign ? ` – ${sign}` : ''}`, J('Timbro dell\'ente', 'Cachet de l\'organisme')] });
  } else if (d.type === 'QUI') {
    title = J('Quietanza di pagamento', 'Quittance de paiement');
    P((l) => l === 'it'
      ? `Il/La sottoscritto/a ${party(l)} dichiara di aver ricevuto da ${org.name} la somma di ${m(d.amount, l)} a saldo di: ${v(x.desc)}${prj(l)}, mediante ${v(low(x.method as string))}, in data ${date(String(x.paid_on || d.doc_date))}, e di non avere altro a pretendere per tale titolo.`
      : `Je soussigné(e) ${party(l)} déclare avoir reçu de ${org.name} la somme de ${m(d.amount, l)} pour solde de : ${v(x.desc)}${prj(l)}, par ${v(low(x.method as string))}, le ${date(String(x.paid_on || d.doc_date))}, et n'avoir rien d'autre à réclamer à ce titre.`);
    blocks.push({ k: 'sig', labels: [`${J('Il percipiente', 'Le bénéficiaire')} – ${v(d.party_name)}`, `${J('Per', 'Pour')} ${org.name}${sign ? ` – ${sign}` : ''}`] });
  } else if (d.type === 'NOT') {
    title = J('Notula di prestazione occasionale', 'Note d\'honoraires – prestation occasionnelle');
    const lines = ((x.lines as NotLine[]) ?? []).filter((r) => r.d || num(r.p));
    const T = notTotals(lines, num(x.ritenuta));
    P((l) => l === 'it'
      ? `Prestatore: ${party(l)}. Committente: ${org.name}${org.tax_id ? ` (C.F.\u00a0${org.tax_id})` : ''}. Prestazione di lavoro autonomo occasionale (art. 2222 c.c.)${prj(l)}${x.period ? `, svolta nel periodo ${x.period}` : ''}.`
      : `Prestataire : ${party(l)}. Donneur d'ordre : ${org.name}. Prestation de travail indépendant occasionnelle${prj(l)}${x.period ? `, réalisée sur la période ${x.period}` : ''}.`);
    blocks.push({ k: 'table', head: [J('Descrizione', 'Description'), J('Q.tà', 'Qté'), J('Prezzo', 'Prix'), J('Importo', 'Montant')],
      rows: lines.map((r) => [r.d, String(num(r.q)), c(r.p), c(num(r.q) * num(r.p))]), num: [1, 2, 3] });
    const tr: [string, Cell, boolean?][] = [[J('Compenso lordo', 'Rémunération brute'), c(T.gross)]];
    if (num(x.ritenuta)) { const [a, b] = two(T.rit); tr.push([`${J('Ritenuta d\'acconto', 'Retenue à la source')} ${num(x.ritenuta)}%`, b ? [`−${a}`, `−${b}`] : `−${a}`]); }
    tr.push([J('Netto a pagare', 'Net à payer'), c(T.net), true]);
    blocks.push({ k: 'totals', rows: tr });
    P((l) => l === 'it' ? 'Il/La sottoscritto/a dichiara che la prestazione è stata resa in modo occasionale, senza vincolo di subordinazione e senza esercizio abituale di attività di lavoro autonomo, e che non è soggetta a IVA per mancanza del requisito dell\'abitualità (art. 5 DPR 633/1972).'
      : 'Le/la soussigné(e) déclare que la prestation a été réalisée de manière occasionnelle, sans lien de subordination et sans exercice habituel d\'une activité indépendante.');
    if (num(x.ritenuta)) P((l) => l === 'it' ? `La ritenuta (art. 25 DPR 600/1973) è trattenuta da ${org.name} e versata con F24 entro il 16 del mese successivo al pagamento.` : `La retenue est prélevée par ${org.name} et versée à l'administration fiscale italienne.`);
    if (d.currency === 'EUR' && T.gross > 77.47) P((l) => l === 'it' ? 'Imposta di bollo di 2,00 € assolta dal prestatore sull\'originale (DPR 642/1972), per importi superiori a 77,47 €.' : 'Droit de timbre italien de 2,00 € à la charge du prestataire au-delà de 77,47 €.');
    blocks.push({ k: 'p', text: `${J('Pagamento', 'Paiement')}: ${v(x.method)}` });
    blocks.push({ k: 'sig', labels: [`${J('Il prestatore', 'Le prestataire')} – ${v(d.party_name)}`, `${J('Per', 'Pour')} ${org.name}${sign ? ` – ${sign}` : ''}`] });
  } else if (d.type === 'NRS') {
    title = J('Nota di rimborso spese', 'Note de remboursement de frais');
    const lines = ((x.lines as NrsLine[]) ?? []).filter((r) => r.d || num(r.amt));
    const tot = Math.round(lines.reduce((s, r) => s + num(r.amt), 0) * 100) / 100;
    P((l) => l === 'it' ? `${x.volunteer ? 'Volontario/a' : 'Richiedente'}: ${party(l)}. Spese sostenute per conto di ${org.name}${prj(l)}${x.activity ? `, per l'attività: ${x.activity}` : ''}.`
      : `${x.volunteer ? 'Bénévole' : 'Demandeur'} : ${party(l)}. Frais engagés pour le compte de ${org.name}${prj(l)}${x.activity ? `, pour l'activité : ${x.activity}` : ''}.`);
    blocks.push({ k: 'table', head: [J('Data', 'Date'), J('Descrizione', 'Description'), J('Giustificativo', 'Justificatif'), J('Importo', 'Montant')],
      rows: lines.map((r) => [date(r.date), r.d, r.doc ? J('allegato', 'joint') : J('autocertificata', 'attestée'), c(r.amt)]), num: [3] });
    blocks.push({ k: 'totals', rows: [[J('Totale da rimborsare', 'Total à rembourser'), c(tot), true]] });
    if (lines.some((r) => !r.doc)) P((l) => l === 'it'
      ? (x.volunteer ? 'Per le spese senza giustificativo il/la sottoscritto/a dichiara, ai sensi dell\'art. 46 del DPR 445/2000, di averle effettivamente sostenute per l\'attività di volontariato, nei limiti dell\'art. 17, comma 4, D.Lgs. 117/2017 (10 € al giorno e 150 € al mese) e secondo la delibera dell\'organo competente.'
        : 'Per le spese senza giustificativo il/la sottoscritto/a dichiara sotto la propria responsabilità di averle effettivamente sostenute per conto dell\'associazione.')
      : 'Pour les frais sans justificatif, le/la soussigné(e) atteste sur l\'honneur les avoir effectivement engagés pour le compte de l\'association.');
    P((l) => l === 'it' ? 'Non si tratta di un compenso: sono rimborsate solo spese effettivamente sostenute e documentate; i rimborsi forfettari ai volontari non sono ammessi (art. 17, c. 3, CTS).' : 'Il ne s\'agit pas d\'une rémunération : seuls les frais réellement engagés sont remboursés.');
    blocks.push({ k: 'sig', labels: [`${J('Il richiedente', 'Le demandeur')} – ${v(d.party_name)}`, `${J('Visto, si autorizza il rimborso', 'Visa, remboursement autorisé')}${sign ? ` – ${sign}` : ''}`] });
  } else if (d.type === 'ASP') {
    title = J('Autorizzazione di spesa', 'Autorisation de dépense');
    P((l) => l === 'it'
      ? `${org.name} autorizza ${party(l)}${x.role ? ` (${x.role})` : ''} a sostenere la seguente spesa${d.project_name ? ` a valere sul progetto «${d.project_name}»` : ''}${x.code ? ` (codice ${x.code})` : ''}: ${v(x.desc)}${x.supplier ? `, presso ${x.supplier}` : ''}, per un importo massimo di ${m(d.amount, l)}, con pagamento ${x.method ? `tramite ${low(String(x.method))}` : 'da concordare'}${x.need_by ? `, da effettuare entro il ${date(String(x.need_by))}` : ''}.`
      : `${org.name} autorise ${party(l)}${x.role ? ` (${x.role})` : ''} à engager la dépense suivante${d.project_name ? ` au titre du projet « ${d.project_name} »` : ''}${x.code ? ` (code ${x.code})` : ''} : ${v(x.desc)}${x.supplier ? `, auprès de ${x.supplier}` : ''}, pour un montant maximum de ${m(d.amount, l)}, avec paiement ${x.method ? `par ${low(String(x.method))}` : 'à convenir'}${x.need_by ? `, à effectuer avant le ${date(String(x.need_by))}` : ''}.`);
    if (x.advance) P((l) => l === 'it' ? 'L\'importo viene consegnato in anticipo e va rendicontato.' : 'Le montant est remis d\'avance et doit être justifié.');
    if (x.reason) P((l) => (l === 'it' ? 'Motivazione: ' : 'Motif : ') + String(x.reason));
    P((l) => l === 'it' ? 'La spesa va documentata con fattura, ricevuta o scontrino intestato all\'associazione; se non è possibile ottenere un documento fiscale, il richiedente emette un\'autocertificazione di spesa. Giustificativo ed eventuale resto vanno consegnati entro 10 giorni dalla spesa. Importi superiori a quello autorizzato richiedono una nuova autorizzazione.'
      : 'La dépense doit être justifiée par une facture, un reçu ou un ticket au nom de l\'association ; s\'il est impossible d\'obtenir un justificatif fiscal, le demandeur émet une attestation sur l\'honneur. Justificatif et éventuel reste sont remis dans les 10 jours suivant la dépense. Tout montant supérieur à celui autorisé nécessite une nouvelle autorisation.');
    blocks.push({ k: 'sig', labels: [`${J('Il richiedente', 'Le demandeur')} – ${v(d.party_name)}`, `${J('Autorizza', 'Autorise')}${sign ? ` – ${sign}` : ''}`] });
  } else if (d.type === 'DIC') {
    const tpl = (String(x.tpl ?? 'free') in DIC_TPL ? String(x.tpl ?? 'free') : 'free') as keyof typeof DIC_TPL;
    title = x.title ? String(x.title) : J(DIC_TPL[tpl][0], DIC_TPL[tpl][1]);
    const pres = `${v(x.declarant ?? sign)}`;
    if (tpl === 'vol') {
      P((l) => l === 'it'
        ? `Il/La sottoscritto/a ${pres}, in qualità di legale rappresentante di ${org.name}${org.tax_id ? ` (C.F.\u00a0${org.tax_id})` : ''}, attesta che ${party(l)} ha svolto attività di volontariato a titolo gratuito presso l'associazione${x.period ? ` nel periodo ${x.period}` : ''}${prj(l)}${x.activity ? `, occupandosi di: ${x.activity}` : ''}${x.hours ? `, per circa ${x.hours} ore` : ''}.`
        : `Je soussigné(e) ${pres}, représentant(e) légal(e) de ${org.name}, atteste que ${party(l)} a exercé une activité de bénévolat à titre gratuit au sein de l'association${x.period ? ` sur la période ${x.period}` : ''}${prj(l)}${x.activity ? `, en s'occupant de : ${x.activity}` : ''}${x.hours ? `, pour environ ${x.hours} heures` : ''}.`);
      P((l) => l === 'it' ? 'L\'attività di volontariato è prestata in modo personale, spontaneo e gratuito, senza fini di lucro (art. 17 D.Lgs. 117/2017). Si rilascia su richiesta dell\'interessato per gli usi consentiti.'
        : 'L\'activité de bénévolat est exercée de manière personnelle, spontanée et gratuite, sans but lucratif. Attestation délivrée à la demande de l\'intéressé(e) pour servir et valoir ce que de droit.');
    } else if (tpl === 'don') {
      P((l) => l === 'it'
        ? `${org.name}${org.tax_id ? ` (C.F.\u00a0${org.tax_id})` : ''}${org.runts ? `, ${org.runts}` : ''}, attesta di aver ricevuto da ${party(l)} nel corso dell'anno ${v(x.year)} erogazioni liberali per complessivi ${m(d.amount, l)}, destinate allo svolgimento delle attività statutarie.`
        : `${org.name}${org.runts ? ` (${org.runts})` : ''} atteste avoir reçu de ${party(l)} au cours de l'année ${v(x.year)} des dons pour un total de ${m(d.amount, l)}, destinés aux activités statutaires.`);
      P((l) => l === 'it' ? 'I versamenti tracciabili danno diritto alle agevolazioni dell\'art. 83 D.Lgs. 117/2017 secondo le condizioni di legge. Da verificare con il commercialista prima dell\'invio.'
        : 'Les versements traçables ouvrent droit aux avantages fiscaux italiens prévus par l\'art. 83 D.Lgs. 117/2017, dans les conditions prévues par la loi.');
    } else {
      ls.forEach((l, i) => { const t = String((l === 'fr' ? x.body_fr || x.body : x.body) ?? ''); (t || BLANK).split(/\n{2,}/).forEach((para) => blocks.push({ k: 'p', text: para.trim(), soft: i > 0 })); });
    }
    blocks.push({ k: 'sig', labels: [`${J('Per', 'Pour')} ${org.name}${x.declarant ? ` – ${x.declarant}` : sign ? ` – ${sign}` : ''}`, J('Timbro dell\'ente', 'Cachet de l\'organisme')] });
  } else if (d.type === 'BDC') {
    title = J('Buono d\'ordine', 'Bon de commande');
    const lines = ((x.lines as NotLine[]) ?? []).filter((r) => r.d || num(r.p));
    const tot = Math.round(lines.reduce((s, r) => s + num(r.q) * num(r.p), 0) * 100) / 100;
    P((l) => l === 'it'
      ? `Fornitore: ${party(l)}. ${org.name} ordina i beni o servizi seguenti${prj(l)}${x.code ? ` (codice di spesa ${x.code})` : ''}.`
      : `Fournisseur : ${party(l)}. ${org.name} commande les biens ou services suivants${prj(l)}${x.code ? ` (code de dépense ${x.code})` : ''}.`);
    blocks.push({ k: 'table', head: [J('Descrizione', 'Description'), J('Q.tà', 'Qté'), J('Prezzo', 'Prix'), J('Importo', 'Montant')],
      rows: lines.map((r) => [r.d, String(num(r.q)), c(r.p), c(num(r.q) * num(r.p))]), num: [1, 2, 3] });
    blocks.push({ k: 'totals', rows: [[J('Totale dell\'ordine', 'Total de la commande'), c(tot), true]] });
    const cond: string[] = [];
    if (x.delivery_by || x.delivery_place) cond.push(ls.map((l) => l === 'it' ? `Consegna${x.delivery_by ? ` entro il ${date(String(x.delivery_by))}` : ''}${x.delivery_place ? ` presso ${x.delivery_place}` : ''}.` : `Livraison${x.delivery_by ? ` avant le ${date(String(x.delivery_by))}` : ''}${x.delivery_place ? ` à ${x.delivery_place}` : ''}.`).join(' / '));
    if (x.method || x.terms) cond.push(ls.map((l) => l === 'it' ? `Pagamento${x.method ? ` tramite ${low(String(x.method))}` : ''}${x.terms ? `, ${x.terms}` : ''}.` : `Paiement${x.method ? ` par ${low(String(x.method))}` : ''}${x.terms ? `, ${x.terms}` : ''}.`).join(' / '));
    cond.forEach((t) => blocks.push({ k: 'p', text: t }));
    P((l) => l === 'it' ? `La fattura o ricevuta va intestata a ${org.name}${org.tax_id ? `, C.F.\u00a0${org.tax_id}` : ''}, con il numero di questo ordine. Importi o quantità diversi vanno concordati prima della consegna.`
      : `La facture ou le reçu doit être établi au nom de ${org.name}, avec le numéro de ce bon de commande. Tout écart de montant ou de quantité doit être convenu avant la livraison.`);
    blocks.push({ k: 'sig', labels: [`${J('Per', 'Pour')} ${org.name}${sign ? ` – ${sign}` : ''}`, `${J('Per accettazione, il fornitore', 'Pour acceptation, le fournisseur')} – ${v(d.party_name)}`] });
  } else {
    title = J('Nota di debito', 'Note de débit');
    P((l) => l === 'it'
      ? `Spettabile ${party(l)}. ${org.name} chiede il pagamento della somma di ${m(d.amount, l)} a titolo di: ${v(x.desc)}${prj(l)}${x.ref ? ` (riferimento: ${x.ref})` : ''}${x.pay_by ? `, entro il ${date(String(x.pay_by))}` : ''}.`
      : `À l'attention de ${party(l)}. ${org.name} demande le paiement de la somme de ${m(d.amount, l)} au titre de : ${v(x.desc)}${prj(l)}${x.ref ? ` (référence : ${x.ref})` : ''}${x.pay_by ? `, avant le ${date(String(x.pay_by))}` : ''}.`);
    if (org.iban) blocks.push({ k: 'p', text: `${J('Coordinate per il pagamento', 'Coordonnées de paiement')}: IBAN ${org.iban} – ${org.name}` });
    P((l) => l === 'it' ? `Operazione fuori campo IVA: ${org.name} è un ente non commerciale e la somma riguarda la sua attività istituzionale (artt. 1 e 4 DPR 633/1972). Documento non fiscale.`
      : `Opération hors champ de la TVA : ${org.name} est un organisme non commercial et la somme concerne son activité institutionnelle. Document non fiscal.`);
    blocks.push({ k: 'sig', labels: [`${J('Per', 'Pour')} ${org.name}${sign ? ` – ${sign}` : ''}`, J('Timbro dell\'ente', 'Cachet de l\'organisme')] });
  }
  const meta: [string, string][] = [[J('N.', 'N°'), d.number ?? J('BOZZA', 'BROUILLON')], [J('Data', 'Date'), date(d.doc_date)]];
  if (d.movement_ref) meta.push([J('Rif. movimento', 'Réf. mouvement'), d.movement_ref]);
  if (d.project_name && d.type !== 'ASP') meta.push([J('Progetto', 'Projet'), d.project_name]);
  const orgLine = [org.address, org.tax_id ? `C.F.\u00a0${org.tax_id}` : null].filter(Boolean).join(' · ');
  const footer = [org.runts, org.email, org.phone?.replace(/ /g, '\u00a0'), org.web].filter(Boolean).join(' · ');
  const fxNote = fx ? J(`Cambio applicato: 1\u00a0€ = ${money(fx, 'MGA', 'it')}`, `Taux appliqué\u00a0: 1\u00a0€ = ${money(fx, 'MGA', 'fr')}`) : null;
  return { title, number: d.number, meta, blocks, org, draftLabel: J('BOZZA – non valida', 'BROUILLON – non valable'), placeDate: J('Luogo e data', 'Lieu et date'),
    orgLine, footer, fxNote };
}
