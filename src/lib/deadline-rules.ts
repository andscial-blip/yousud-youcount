// Adempimenti ricorrenti per un'ODV con esercizio uguale all'anno solare (ripresi dal Gestionale YouSud).
// Sono promemoria con la fonte indicata, non un parere: date e applicabilità si verificano con il commercialista.
// Una regola con «cond» vale solo se le entrate dell'anno precedente superano la soglia.
export type DlCat = 'pay' | 'inc' | 'ets' | 'fisc' | 'int' | 'prj' | 'doc' | 'altro';
export type Rule = { k: string; m: number; d: number; cat: DlCat; cond?: number; it: string; fr: string; dit: string; dfr: string };

export const DL_CAT: Record<DlCat, [string, string]> = {
  pay: ['Pagamento', 'Paiement'], inc: ['Incasso', 'Encaissement'], ets: ['RUNTS / ETS', 'RUNTS / ETS'], fisc: ['Fiscale', 'Fiscal'],
  int: ['Interna', 'Interne'], prj: ['Progetti e finanziatori', 'Projets et bailleurs'], doc: ['Documenti', 'Documents'], altro: ['Altro', 'Autre'],
};

export const DL_RULES: Rule[] = [
  { k: 'conf', m: 1, d: 15, cat: 'int', it: 'Inviare al commercialista documenti e registro dell\'anno {Y-1}', fr: 'Envoyer au comptable les documents et le registre de {Y-1}',
    dit: 'Scadenza interna: chiusura della contabilità dell\'esercizio precedente.', dfr: 'Échéance interne : clôture de la comptabilité de l\'exercice précédent.' },
  { k: 'cu', m: 3, d: 16, cat: 'fisc', it: 'Certificazione Unica {Y-1} ai collaboratori con ritenuta d\'acconto', fr: 'Certification unique {Y-1} aux collaborateurs avec retenue',
    dit: 'Solo se nel {Y-1} l\'associazione ha pagato compensi con ritenuta (prestazioni occasionali in Italia). Le ritenute si versano con F24 entro il 16 del mese dopo il pagamento.',
    dfr: 'Seulement si en {Y-1} l\'association a payé des rémunérations avec retenue. Les retenues se versent par F24 avant le 16 du mois suivant le paiement.' },
  { k: 'appr', m: 4, d: 30, cat: 'ets', it: 'Approvazione del rendiconto {Y-1} (assemblea)', fr: 'Approbation des comptes {Y-1} (assemblée)',
    dit: 'Termine dello statuto (di solito 4 mesi dalla chiusura): in ogni caso in tempo per il deposito al RUNTS. Verifica lo statuto di YouSud.',
    dfr: 'Délai des statuts (en général 4 mois après la clôture) : à temps pour le dépôt au RUNTS. Vérifiez les statuts de YouSud.' },
  { k: 'runts', m: 6, d: 30, cat: 'ets', it: 'Deposito del rendiconto {Y-1} al RUNTS', fr: 'Dépôt des comptes {Y-1} au RUNTS',
    dit: 'Art. 48 c.3 D.Lgs. 117/2017, con i rendiconti delle raccolte fondi occasionali. Il termine può variare: verificalo ogni anno sul portale RUNTS.',
    dfr: 'Art. 48 al.3 D.Lgs. 117/2017, avec les comptes des collectes occasionnelles. Le délai peut varier : vérifiez-le chaque année sur le portail RUNTS.' },
  { k: 'var', m: 6, d: 30, cat: 'ets', it: 'Aggiornamento dati RUNTS: associati, volontari, lavoratori', fr: 'Mise à jour RUNTS : membres, bénévoles, salariés',
    dit: 'Dati al 31 dicembre {Y-1}, con variazione solo se sono cambiati.', dfr: 'Données au 31 décembre {Y-1}, modification seulement en cas de changement.' },
  { k: 'pub', m: 6, d: 30, cat: 'ets', it: 'Pubblicare i contributi pubblici ricevuti nel {Y-1}', fr: 'Publier les contributions publiques reçues en {Y-1}',
    dit: 'Se dalla pubblica amministrazione sono arrivati 10.000 € o più nell\'anno (L. 124/2017, art. 1 c. 125-129): pubblicazione sul sito dell\'ente.',
    dfr: 'Si 10 000 € ou plus ont été reçus d\'administrations publiques (L. 124/2017, art. 1 al. 125-129) : publication sur le site de l\'organisme.' },
  { k: 'comp', m: 6, d: 30, cat: 'ets', cond: 100000, it: 'Pubblicare i compensi di organi, dirigenti e associati', fr: 'Publier les rémunérations des organes, dirigeants et membres',
    dit: 'Per ETS con entrate oltre 100.000 € (art. 14 c.2 CTS). La norma non fissa il giorno: 30 giugno è un termine interno.',
    dfr: 'Pour les ETS dont les recettes dépassent 100 000 € (art. 14 al.2 CTS). La date du 30 juin est un délai interne.' },
  { k: 'soc', m: 6, d: 30, cat: 'ets', cond: 1000000, it: 'Bilancio sociale: deposito RUNTS e pubblicazione', fr: 'Bilan social : dépôt RUNTS et publication',
    dit: 'Obbligatorio per ETS con entrate oltre 1 milione di euro.', dfr: 'Obligatoire pour les ETS dont les recettes dépassent 1 million d\'euros.' },
  { k: '770', m: 10, d: 31, cat: 'fisc', it: 'Modello 770 per le ritenute {Y-1}', fr: 'Modèle 770 pour les retenues {Y-1}',
    dit: 'Solo se nel {Y-1} sono state operate ritenute d\'acconto.', dfr: 'Seulement si des retenues ont été opérées en {Y-1}.' },
  { k: 'redd', m: 11, d: 30, cat: 'fisc', it: 'Dichiarazione dei redditi enti non commerciali (se dovuta)', fr: 'Déclaration de revenus des organismes non commerciaux (si due)',
    dit: 'Data indicativa: verifica con il commercialista se e quando è dovuta.', dfr: 'Date indicative : vérifiez avec le comptable si et quand elle est due.' },
  { k: 'chius', m: 12, d: 31, cat: 'int', it: 'Chiusura dell\'esercizio: verifica di cassa e riconciliazione delle banche', fr: 'Clôture de l\'exercice : contrôle de caisse et rapprochement bancaire',
    dit: 'Conta della cassa in Italia e in Madagascar, saldi bancari, movimenti da giustificare.', dfr: 'Comptage de caisse Italie et Madagascar, soldes bancaires, mouvements à justifier.' },
];

// Soglie sulle entrate dell'esercizio (art. 13 e 14 CTS, come modificati dalla L. 104/2024).
export const THRESHOLDS: { v: number; it: string; fr: string }[] = [
  { v: 60000, it: 'Rendiconto per cassa in forma aggregata (fino a 60.000 €, art. 13 c.2-bis CTS)', fr: 'Compte de caisse sous forme agrégée (jusqu\'à 60 000 €, art. 13 al.2-bis CTS)' },
  { v: 100000, it: 'Pubblicazione dei compensi (oltre 100.000 €, art. 14 c.2 CTS)', fr: 'Publication des rémunérations (au-delà de 100 000 €, art. 14 al.2 CTS)' },
  { v: 300000, it: 'Rendiconto per cassa per enti senza personalità giuridica (fino a 300.000 €, art. 13 c.2 CTS)', fr: 'Compte de caisse pour organismes sans personnalité juridique (jusqu\'à 300 000 €, art. 13 al.2 CTS)' },
  { v: 1000000, it: 'Bilancio sociale (oltre 1 milione, art. 14 c.1 CTS)', fr: 'Bilan social (au-delà d\'1 million, art. 14 al.1 CTS)' },
];

export type RuleItem = { rule_key: string; date: string; cat: DlCat; it: string; fr: string; dit: string; dfr: string; applies: boolean };

// Adempimenti dell'app per gli anni indicati; «applies» è falso quando la soglia non è superata.
export function ruleItems(years: number[], incomeOf: (y: number) => number): RuleItem[] {
  const out: RuleItem[] = [];
  for (const Y of years) for (const r of DL_RULES) {
    const f = (s: string) => s.replace(/\{Y-1\}/g, String(Y - 1));
    out.push({ rule_key: `${r.k}-${Y}`, date: `${Y}-${String(r.m).padStart(2, '0')}-${String(r.d).padStart(2, '0')}`, cat: r.cat,
      it: f(r.it), fr: f(r.fr), dit: f(r.dit), dfr: f(r.dfr), applies: !r.cond || incomeOf(Y - 1) > r.cond });
  }
  return out;
}
