// Icona di un titolo di pannello, ricavata dalle parole del titolo (italiano o francese).
// Così ogni pannello ha la sua icona senza ripeterla in ogni pagina; chi vuole un'icona diversa la passa a mano.
const RULES: [RegExp, string][] = [
  [/da fare|a faire|verific|controll|riconcil|rapproch|chiusur|cloture/, 'check'],
  [/scadenz|echeanc|calendar|period|mese|mois/, 'cal'],
  [/cambi|change|tass|taux/, 'euro'],
  [/preventiv|budget|previst|prevu/, 'wallet'],
  [/progett|projet|centr/, 'brief'],
  [/finanziament|financement|bando|bandi|subvention|donator|donateur/, 'stamp'],
  [/document|ricevut|recu|giustific|justific|allegat|piece/, 'receipt'],
  [/rimbors|rembours|anticip|avance/, 'piggy'],
  [/entrat|recett/, 'trend'],
  [/uscit|spes|depens|cost|cout/, 'chart'],
  [/analis|analys|andament|evolution|confront|compar|rendicont|rapport|report|sintesi|synthese/, 'chart'],
  [/sald|solde|cassa|tresor|conti|compte|liquid|banc|banque/, 'bank'],
  [/movimen|mouvement|registr|journal|righe|lignes|version/, 'list'],
  [/utent|utilisateur|controparti|tiers|person|fornitor|fournisseur|membr/, 'users'],
  [/backup|sauvegard|azzer|reinitial|dimostrativ|demo|zona|danger/, 'safe'],
  [/email|mail|notific/, 'mail'],
  [/sincron|synchron/, 'sync'],
  [/impostazion|parametr|ente|organisation|logo|firma|signat/, 'gear'],
  [/piano dei conti|plan comptable|categori|voci|postes/, 'file'],
  [/password|accesso|acces|sicurezz|securit/, 'lock'],
  [/storn|annull|annul|modific|modifi|nuov|nouv|aggiung|ajout/, 'pen'],
];

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function titleIcon(title: string | null | undefined): string | null {
  if (!title) return null;
  const t = norm(title);
  for (const [re, ic] of RULES) if (re.test(t)) return ic;
  return null;
}
